// ============================================
// MY ACTIVITY PAGE
// ============================================

let activityListeners = [];

async function getMyActivityHTML() {
  const user = window.currentUser;
  const isManagerOrPO = user.role === 'manager' || user.role === 'po';
  const displayRole = user.activeRole || user.role;
  
  return `
    <div class="page activity-page">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:0.75rem;">
        <h2>Activity</h2>
        ${isManagerOrPO ? `<span style="background:var(--primary); color:white; padding:2px 10px; border-radius:12px; font-size:11px; font-weight:500;">${displayRole.toUpperCase()}</span>` : ''}
      </div>
      
      <div class="section clickable" onclick="loadPage('attendance')">
        <h3>Attendance Status</h3>
        <div id="my-attendance-status">Loading...</div>
      </div>

      <div class="section">
        <h3>Recent Notifications</h3>
        <div id="my-notifications-list">Loading...</div>
      </div>

      <div class="section clickable" onclick="loadPage('cleaning')">
        <h3>Today's Duties</h3>
        <div id="my-duties">Loading...</div>
      </div>

      <div class="section clickable" onclick="loadPage('expenses')">
        <h3>Recent Expenses</h3>
        <div id="my-expenses-list">Loading...</div>
      </div>

      <div class="section clickable" onclick="loadPage('rent')">
        <h3>Rent Status</h3>
        <div id="my-rent-status-card">Loading...</div>
      </div>

      <div class="section clickable" onclick="loadPage('sabha')">
        <h3>Sabha Tasks</h3>
        <div id="my-sabha-tasks-list">Loading...</div>
      </div>
    </div>
  `;
}

async function loadMyActivityData() {
  cleanupActivityListeners();
  const userId = window.currentUser.uid;
  const todayDate = today();
  const d = new Date();
  const monthYear = `${String(d.getMonth() + 1).padStart(2, '0')}_${d.getFullYear()}`;

  const unsub1 = db.collection('users').doc(userId).onSnapshot(doc => {
    const el = document.getElementById('my-attendance-status');
    if (!el || !doc.exists) return;
    const data = doc.data();
    if (data.present) {
      el.innerHTML = '<p style="color:var(--success); font-size:16px;"><span class="status-dot present"></span> You are currently <strong>IN PG</strong></p>';
    } else {
      el.innerHTML = '<p style="color:var(--danger); font-size:16px;"><span class="status-dot absent"></span> You are currently <strong>OUT of PG</strong></p>';
    }
    el.innerHTML += '<p style="font-size:11px; color:var(--primary); margin-top:4px;">Click to view details</p>';
  });
  activityListeners.push(unsub1);

  const unsub2 = db.collection('notifications').where('userId', '==', userId).limit(5).onSnapshot(snapshot => {
    const el = document.getElementById('my-notifications-list');
    if (!el) return;
    if (!snapshot.empty) {
      el.innerHTML = snapshot.docs.map(doc => {
        const data = doc.data();
        return `<div class="list-item"><span>${data.title}</span><span style="font-size:11px; color:var(--text-secondary);">${data.body}</span></div>`;
      }).join('');
    } else {
      el.innerHTML = '<p>No notifications yet</p>';
    }
  });
  activityListeners.push(unsub2);

  loadTodayDuties(userId, todayDate);

  const unsub4 = db.collection('expenses').where('userId', '==', userId).orderBy('date', 'desc').limit(3).onSnapshot(snapshot => {
    const el = document.getElementById('my-expenses-list');
    if (!el) return;
    if (!snapshot.empty) {
      el.innerHTML = snapshot.docs.map(doc => {
        const data = doc.data();
        return `<div class="list-item"><span>${data.category} - \u20B9${data.amount}</span><span>${data.status === 'settled' ? 'Settled' : 'Pending'}</span></div>`;
      }).join('');
    } else {
      el.innerHTML = '<p>No expenses yet</p>';
    }
    el.innerHTML += '<p style="font-size:11px; color:var(--primary); margin-top:4px;">Click to view all</p>';
  });
  activityListeners.push(unsub4);

  const docId = `${userId}_${monthYear}`;
  const unsub5 = db.collection('rentPayments').doc(docId).onSnapshot(doc => {
    const el = document.getElementById('my-rent-status-card');
    if (!el) return;
    if (doc.exists) {
      const data = doc.data();
      if (data.status === 'pending') {
        el.innerHTML = '<p style="color:var(--warning);"><strong>Rent Pending</strong> - Please pay</p>';
      } else if (data.status === 'paid') {
        el.innerHTML = '<p style="color:var(--primary);"><strong>Rent Paid</strong> - Waiting for verification</p>';
      } else if (data.status === 'verified') {
        el.innerHTML = '<p style="color:var(--success);"><strong>Rent Verified</strong> - All clear!</p>';
      }
      el.innerHTML += `<p style="font-size:13px; color:var(--text-secondary);">Amount: \u20B9${data.amount} | Month: ${data.monthYear}</p>`;
    } else {
      el.innerHTML = '<p style="color:var(--danger);">No rent record for this month</p>';
    }
    el.innerHTML += '<p style="font-size:11px; color:var(--primary); margin-top:4px;">Click to view details</p>';
  });
  activityListeners.push(unsub5);

  loadSabhaTasks(userId);
}

function cleanupActivityListeners() {
  activityListeners.forEach(unsub => unsub());
  activityListeners = [];
}

async function loadTodayDuties(userId, todayDate) {
  const dutiesEl = document.getElementById('my-duties');
  if (!dutiesEl) return;
  let dutiesHTML = '';

  const cleaningDoc = await db.collection('cleaningAssignments').doc(todayDate).get();
  if (cleaningDoc.exists) {
    const data = cleaningDoc.data();
    if ((data.finalAssignee || '').toString().toLowerCase() === userId.toLowerCase()) {
      dutiesHTML += `<p>Kitchen Cleaning - ${data.confirmedAt ? 'Confirmed' : 'Pending'}</p>`;
    }
  }

  const todayDateObj = new Date();
  const dayOfWeek = todayDateObj.getDay();
  let thursday = new Date(todayDateObj);
  if (dayOfWeek <= 4) thursday.setDate(todayDateObj.getDate() + (4 - dayOfWeek));
  else thursday.setDate(todayDateObj.getDate() + (11 - dayOfWeek));
  const thursdayStr = formatDate(thursday);
  
  const fvDoc = await db.collection('fvAssignments').doc(thursdayStr).get();
  if (fvDoc.exists) {
    const myAssignment = fvDoc.data().assignees?.find(a => (a.userId || '').toString().toLowerCase() === userId.toLowerCase());
    if (myAssignment) {
      dutiesHTML += `<p>F&V Purchase (${formatDisplayDate(thursdayStr)}) - ${myAssignment.status === 'confirmed' ? 'Confirmed' : 'Pending'}</p>`;
    }
  }

  dutiesEl.innerHTML = dutiesHTML || '<p>No duties assigned for today</p>';
  dutiesEl.innerHTML += '<p style="font-size:11px; color:var(--primary); margin-top:4px;">Click to view details</p>';
}

async function loadSabhaTasks(userId) {
  const todayDateObj = new Date();
  const dayOfWeek = todayDateObj.getDay();
  let wednesday = new Date(todayDateObj);
  if (dayOfWeek <= 3) wednesday.setDate(todayDateObj.getDate() + (3 - dayOfWeek));
  else wednesday.setDate(todayDateObj.getDate() + (10 - dayOfWeek));
  const wednesdayStr = formatDate(wednesday);

  const sabhaDoc = await db.collection('weeklySabha').doc(wednesdayStr).get();
  const sabhaEl = document.getElementById('my-sabha-tasks-list');
  if (!sabhaEl) return;
  
  if (sabhaDoc.exists && sabhaDoc.data().isFinished) {
    const tasks = sabhaDoc.data().tasks || [];
    const myTasks = tasks.filter(t => t.assigneeId === userId);
    if (myTasks.length > 0) {
      sabhaEl.innerHTML = myTasks.map(t => `
        <div class="list-item">
          <span>${t.taskDescription}</span>
          <span>${t.status === 'accepted' ? 'Accepted' : t.status === 'declined' ? 'Declined' : 'Pending'}</span>
        </div>
      `).join('');
    } else {
      sabhaEl.innerHTML = '<p>No tasks assigned to you this week</p>';
    }
  } else {
    sabhaEl.innerHTML = '<p>No sabha tasks yet</p>';
  }
  sabhaEl.innerHTML += '<p style="font-size:11px; color:var(--primary); margin-top:4px;">Click to view details</p>';
}