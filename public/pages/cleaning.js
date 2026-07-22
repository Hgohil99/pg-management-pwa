// ============================================
// KITCHEN CLEANING MODULE
// ============================================

async function getCleaningHTML() {
  const isManager = (window.currentUser.activeRole === 'manager' || window.currentUser.activeRole === 'po');
  
  return `
    <div class="page cleaning-page">
      <h2>Kitchen Cleaning</h2>
      
      <div class="section">
        <h3>Today's Cleaning (${formatDisplayDate(today())})</h3>
        <div id="today-cleaning">Loading...</div>
      </div>

      <div class="section">
        <h3>Tomorrow's Cleaning (${formatDisplayDate(tomorrow())})</h3>
        <div id="tomorrow-cleaning">Loading...</div>
      </div>

      ${isManager ? `
      <div id="admin-cleaning-section">
        <div class="section">
          <h3>Cleaning Rotation</h3>
          <p style="font-size:12px; color:var(--text-secondary);">Assignments follow the Users list order (only present people)</p>
          <div id="cleaning-queue">Loading...</div>
        </div>
        <div class="section">
          <button class="btn-primary" onclick="assignCleaningManually()">Assign Tomorrow's Cleaning</button>
          <button class="btn-primary" onclick="autoAssignCleaning()" style="margin-top:8px;">Auto-Assign from Present List</button>
        </div>
      </div>` : ''}
    </div>
  `;
}

async function loadCleaningPageData() {
  const userId = window.currentUser.uid;
  const todayDate = today();
  const tomorrowDate = tomorrow();
  const isManager = (window.currentUser.activeRole === 'manager' || window.currentUser.activeRole === 'po');

  if (isManager) { loadCleaningQueue(); }

  const todayDoc = await db.collection('cleaningAssignments').doc(todayDate).get();
  const todayEl = document.getElementById('today-cleaning');
  
  if (todayDoc.exists) {
    const data = todayDoc.data();
    const isMe = (data.finalAssignee || '').toString().toLowerCase() === userId.toLowerCase();
    todayEl.innerHTML = `
      <p><strong>Assigned to:</strong> ${data.finalAssigneeName || data.finalAssignee}</p>
      <p><strong>Status:</strong> ${data.confirmedAt ? 'Confirmed' : 'Pending'}</p>
      ${isMe && !data.confirmedAt ? 
        `<button class="btn-success" onclick="confirmCleaning('${todayDate}')">Confirm</button>
         <button class="btn-danger" onclick="declineCleaning('${todayDate}')">Decline</button>` : ''}
    `;
  } else { todayEl.innerHTML = '<p>No assignment yet</p>'; }

  const tomorrowDoc = await db.collection('cleaningAssignments').doc(tomorrowDate).get();
  const tomorrowEl = document.getElementById('tomorrow-cleaning');
  
  if (tomorrowDoc.exists) {
    const data = tomorrowDoc.data();
    const isMe = (data.finalAssignee || '').toString().toLowerCase() === userId.toLowerCase();
    tomorrowEl.innerHTML = `
      <p><strong>Assigned to:</strong> ${data.finalAssigneeName || data.finalAssignee}</p>
      <p><strong>Status:</strong> ${data.confirmedAt ? 'Confirmed' : 'Pending'}</p>
      ${isMe && !data.confirmedAt ? 
        `<button class="btn-success" onclick="confirmCleaning('${tomorrowDate}')">Confirm</button>
         <button class="btn-danger" onclick="declineCleaning('${tomorrowDate}')">Decline</button>` : ''}
    `;
  } else { tomorrowEl.innerHTML = '<p>Not assigned yet</p>'; }
}

async function confirmCleaning(dateStr) {
  try {
    await db.collection('cleaningAssignments').doc(dateStr).update({ confirmedAt: firebase.firestore.FieldValue.serverTimestamp() });
    alert('Confirmed!');
    loadCleaningPageData();
  } catch (error) { alert('Error: ' + error.message); }
}

async function declineCleaning(dateStr) {
  if (confirm('Are you sure you want to decline? It will be assigned to someone else.')) {
    try {
      await db.collection('cleaningAssignments').doc(dateStr).update({ finalAssignee: null, confirmedAt: null });
      const managers = await db.collection('users').where('role', 'in', ['manager', 'po']).get();
      managers.forEach(doc => {
        sendNotification(doc.id, 'Cleaning Declined', `${window.currentUser.name} declined cleaning duty for ${dateStr}.`, '/');
      });
      alert('Declined. Managers will reassign.');
      loadCleaningPageData();
    } catch (error) { alert('Error: ' + error.message); }
  }
}

async function loadCleaningQueue() {
  const users = await getAllUsers();
  const presentUsers = users.filter(u => u.present).sort((a, b) => (a.order || 0) - (b.order || 0));
  const el = document.getElementById('cleaning-queue');
  
  if (presentUsers.length > 0) {
    el.innerHTML = '<p style="font-size:13px; margin-bottom:8px;">Present people (in order):</p>';
    el.innerHTML += presentUsers.map((user, index) => `
      <div class="list-item">
        <span>${index + 1}. ${user.name}</span>
        <span class="status-dot present"></span>
      </div>
    `).join('');
  } else { el.innerHTML = '<p>No one is present</p>'; }
}

async function autoAssignCleaning() {
  const users = await getAllUsers();
  const presentUsers = users.filter(u => u.present).sort((a, b) => (a.order || 0) - (b.order || 0));
  
  if (presentUsers.length === 0) { alert('No one is present!'); return; }

  const lastAssignment = await db.collection('cleaningAssignments').orderBy('assignedAt', 'desc').limit(1).get();
  let nextIndex = 0;
  if (!lastAssignment.empty) {
    const lastUserId = lastAssignment.docs[0].data().finalAssignee;
    const lastIndex = presentUsers.findIndex(u => u.id === lastUserId);
    if (lastIndex >= 0) { nextIndex = (lastIndex + 1) % presentUsers.length; }
  }

  const user = presentUsers[nextIndex];
  await db.collection('cleaningAssignments').doc(tomorrow()).set({
    cleaningDate: tomorrow(), finalAssignee: user.id, finalAssigneeName: user.name,
    confirmedAt: null, assignedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await sendNotification(user.id, 'Cleaning Duty', `You are assigned for kitchen cleaning tomorrow (${formatDisplayDate(tomorrow())}).`, '/');
  alert('Auto-assigned to ' + user.name + '!');
  loadCleaningPageData();
}

async function assignCleaningManually() {
  const users = await getAllUsers();
  const presentUsers = users.filter(u => u.present).sort((a, b) => (a.order || 0) - (b.order || 0));
  
  if (presentUsers.length === 0) { alert('No one is present tomorrow!'); return; }

  const userList = presentUsers.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
  const selection = prompt('Select person for tomorrow\'s cleaning (enter number):\n\n' + userList);
  
  if (selection) {
    const index = parseInt(selection) - 1;
    if (index >= 0 && index < presentUsers.length) {
      const user = presentUsers[index];
      await db.collection('cleaningAssignments').doc(tomorrow()).set({
        cleaningDate: tomorrow(), finalAssignee: user.id, finalAssigneeName: user.name,
        confirmedAt: null, assignedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await sendNotification(user.id, 'Cleaning Duty', `You are assigned for kitchen cleaning tomorrow (${formatDisplayDate(tomorrow())}).`, '/');
      alert('Assigned to ' + user.name + '!');
      loadCleaningPageData();
    } else { alert('Invalid selection'); }
  }
}