// ============================================
// 🥬 FRUITS & VEGETABLES MODULE
// ============================================

async function getFVHTML() {
  const isManager = (window.currentUser.activeRole === 'manager' || window.currentUser.activeRole === 'po');
  
  return `
    <div class="page fv-page">
      <h2>🥬 Fruits & Vegetables</h2>
      
      <div class="section">
        <h3>📌 This Week's F&V Duty</h3>
        <div id="this-week-fv">Loading...</div>
      </div>

      ${isManager ? `
      <div id="admin-fv-section">
        <div class="section">
          <h3>👥 F&V Rotation</h3>
          <p style="font-size:12px; color:#666;">Assignments follow the Users list order (only present people)</p>
          <div id="fv-queue">Loading...</div>
        </div>
        <div class="section">
          <button class="btn-primary" onclick="assignFVManually()">🔄 Assign F&V Manually</button>
          <button class="btn-primary" onclick="autoAssignFV()" style="margin-top:8px;">🤖 Auto-Assign from Present List</button>
        </div>
      </div>` : ''}
    </div>
  `;
}

async function loadFVPageData() {
  const userId = window.currentUser.uid;
  const isManager = (window.currentUser.activeRole === 'manager' || window.currentUser.activeRole === 'po');

  if (isManager) { loadFVQueue(); }

  const todayDate = new Date();
  const dayOfWeek = todayDate.getDay();
  let thursday = new Date(todayDate);
  if (dayOfWeek <= 4) { thursday.setDate(todayDate.getDate() + (4 - dayOfWeek)); }
  else { thursday.setDate(todayDate.getDate() + (11 - dayOfWeek)); }
  const thursdayStr = formatDate(thursday);

  const fvDoc = await db.collection('fvAssignments').doc(thursdayStr).get();
  const el = document.getElementById('this-week-fv');
  
  if (fvDoc.exists) {
    const data = fvDoc.data();
    const assignees = data.assignees || [];
    el.innerHTML = `
      <p><strong>Date:</strong> ${formatDisplayDate(thursdayStr)}</p>
      ${assignees.map(a => {
        const isMe = (a.userId || '').toString().toLowerCase() === userId.toLowerCase();
        return `
          <div class="list-item">
            <span>👤 ${a.userName || a.userId}</span>
            <span>Status: ${a.status === 'confirmed' ? '✅' : a.status === 'declined' ? '❌' : '⏳'}</span>
            ${isMe && a.status === 'pending' ? 
              `<button class="btn-success btn-sm" onclick="confirmFV('${thursdayStr}', '${a.userId}')">Confirm ✅</button>
               <button class="btn-danger btn-sm" onclick="declineFV('${thursdayStr}', '${a.userId}')">Decline ❌</button>` : ''}
          </div>
        `;
      }).join('')}
    `;
  } else {
    el.innerHTML = '<p>No F&V assignment yet for this week</p>';
  }
}

async function confirmFV(dateStr, userId) {
  try {
    const docRef = db.collection('fvAssignments').doc(dateStr);
    const doc = await docRef.get();
    const assignees = doc.data().assignees.map(a => {
      if ((a.userId || '').toString().toLowerCase() === userId.toLowerCase()) {
        return { ...a, status: 'confirmed', confirmedAt: new Date().toISOString() };
      }
      return a;
    });
    await docRef.update({ assignees });
    alert('✅ Confirmed!');
    loadFVPageData();
  } catch (error) { alert('Error: ' + error.message); }
}

async function declineFV(dateStr, userId) {
  if (confirm('Are you sure you want to decline?')) {
    try {
      const docRef = db.collection('fvAssignments').doc(dateStr);
      const doc = await docRef.get();
      const assignees = doc.data().assignees.map(a => {
        if ((a.userId || '').toString().toLowerCase() === userId.toLowerCase()) {
          return { ...a, status: 'declined' };
        }
        return a;
      });
      await docRef.update({ assignees });
      const managers = await db.collection('users').where('role', 'in', ['manager', 'po']).get();
      managers.forEach(doc => {
        sendNotification(doc.id, 'F&V Declined', `${window.currentUser.name} declined F&V duty. Needs replacement.`, '/');
      });
      alert('Declined. Managers will reassign.');
      loadFVPageData();
    } catch (error) { alert('Error: ' + error.message); }
  }
}

async function loadFVQueue() {
  const users = await getAllUsers();
  const presentUsers = users.filter(u => u.present).sort((a, b) => (a.order || 0) - (b.order || 0));
  const el = document.getElementById('fv-queue');
  if (presentUsers.length > 0) {
    el.innerHTML = '<p style="font-size:13px; margin-bottom:8px;">Present people (in order):</p>';
    el.innerHTML += presentUsers.map((user, index) => `
      <div class="list-item"><span>${index + 1}. ${user.name}</span><span>🟢</span></div>
    `).join('');
  } else {
    el.innerHTML = '<p>No one is present</p>';
  }
}

async function autoAssignFV() {
  const users = await getAllUsers();
  const presentUsers = users.filter(u => u.present).sort((a, b) => (a.order || 0) - (b.order || 0));
  if (presentUsers.length === 0) { alert('No one is present!'); return; }

  const todayDate = new Date();
  const dayOfWeek = todayDate.getDay();
  let thursday = new Date(todayDate);
  if (dayOfWeek <= 4) { thursday.setDate(todayDate.getDate() + (4 - dayOfWeek)); }
  else { thursday.setDate(todayDate.getDate() + (11 - dayOfWeek)); }
  const thursdayStr = formatDate(thursday);

  const lastAssignment = await db.collection('fvAssignments').orderBy('createdAt', 'desc').limit(1).get();
  let startIndex = 0;
  if (!lastAssignment.empty) {
    const lastAssignees = lastAssignment.docs[0].data().assignees || [];
    if (lastAssignees.length > 0) {
      const lastIndex = presentUsers.findIndex(u => u.id === lastAssignees[lastAssignees.length - 1].userId);
      if (lastIndex >= 0) { startIndex = (lastIndex + 1) % presentUsers.length; }
    }
  }

  const assigneeCount = presentUsers.length <= 3 ? 1 : 2;
  const selectedUsers = [];
  for (let i = 0; i < assigneeCount; i++) {
    const index = (startIndex + i) % presentUsers.length;
    if (!selectedUsers.find(u => u.id === presentUsers[index].id)) {
      selectedUsers.push(presentUsers[index]);
    }
  }

  await db.collection('fvAssignments').doc(thursdayStr).set({
    date: thursdayStr,
    assignees: selectedUsers.map(u => ({ userId: u.id, userName: u.name, status: 'pending' })),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  for (const user of selectedUsers) {
    const partner = selectedUsers.find(u => u.id !== user.id);
    const msg = partner ? `Partner: ${partner.name}` : 'You are the only one assigned';
    await sendNotification(user.id, 'F&V Duty', `🥬 You are assigned for F&V purchase this Thursday (${formatDisplayDate(thursdayStr)}). ${msg} Please plan accordingly.`, '/');
  }

  alert(`✅ Auto-assigned to ${selectedUsers.map(u => u.name).join(' & ')}!`);
  loadFVPageData();
}

async function assignFVManually() {
  const users = await getAllUsers();
  const presentUsers = users.filter(u => u.present).sort((a, b) => (a.order || 0) - (b.order || 0));
  if (presentUsers.length === 0) { alert('No one is present!'); return; }

  const todayDate = new Date();
  const dayOfWeek = todayDate.getDay();
  let thursday = new Date(todayDate);
  if (dayOfWeek <= 4) { thursday.setDate(todayDate.getDate() + (4 - dayOfWeek)); }
  else { thursday.setDate(todayDate.getDate() + (11 - dayOfWeek)); }
  const thursdayStr = formatDate(thursday);

  const userList = presentUsers.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
  const assigneeCount = presentUsers.length <= 3 ? 1 : 2;

  if (assigneeCount === 1) {
    const selection = prompt('Select 1 person for F&V (enter number):\n\n' + userList);
    if (!selection) return;
    const index = parseInt(selection) - 1;
    if (index >= 0 && index < presentUsers.length) {
      const user = presentUsers[index];
      await db.collection('fvAssignments').doc(thursdayStr).set({
        date: thursdayStr,
        assignees: [{ userId: user.id, userName: user.name, status: 'pending' }],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await sendNotification(user.id, 'F&V Duty', `🥬 You are assigned for F&V purchase this Thursday (${formatDisplayDate(thursdayStr)}). Please plan accordingly.`, '/');
      alert('✅ Assigned to ' + user.name + '!');
    }
  } else {
    const sel1 = prompt('Select FIRST person for F&V (enter number):\n\n' + userList);
    if (!sel1) return;
    const sel2 = prompt('Select SECOND person for F&V (enter number):\n\n' + userList);
    if (!sel2) return;
    const i1 = parseInt(sel1) - 1;
    const i2 = parseInt(sel2) - 1;
    if (i1 >= 0 && i1 < presentUsers.length && i2 >= 0 && i2 < presentUsers.length && i1 !== i2) {
      const u1 = presentUsers[i1];
      const u2 = presentUsers[i2];
      await db.collection('fvAssignments').doc(thursdayStr).set({
        date: thursdayStr,
        assignees: [
          { userId: u1.id, userName: u1.name, status: 'pending' },
          { userId: u2.id, userName: u2.name, status: 'pending' }
        ],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await sendNotification(u1.id, 'F&V Duty', `🥬 You are assigned for F&V purchase this Thursday (${formatDisplayDate(thursdayStr)}). Partner: ${u2.name}. Please plan accordingly.`, '/');
      await sendNotification(u2.id, 'F&V Duty', `🥬 You are assigned for F&V purchase this Thursday (${formatDisplayDate(thursdayStr)}). Partner: ${u1.name}. Please plan accordingly.`, '/');
      alert('✅ Assigned to ' + u1.name + ' & ' + u2.name + '!');
    } else { alert('Invalid selection'); }
  }
  loadFVPageData();
}