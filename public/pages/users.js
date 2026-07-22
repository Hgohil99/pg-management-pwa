// ============================================
// USERS MANAGEMENT PAGE
// ============================================

let allUsers = [];
let currentTab = 'all';
let editMode = false;
let usersListener = null;

async function getUsersHTML() {
  const isManager = (window.currentUser.activeRole === 'manager' || window.currentUser.activeRole === 'po');
  
  return `
    <div class="page users-page">
      <h2>Users</h2>
      
      <div class="section" style="text-align:center;">
        <p style="font-size:16px;"><span class="status-dot present"></span> <strong id="present-count">...</strong> people present today</p>
      </div>
      
      <div class="tab-bar">
        <button class="tab-btn active" onclick="switchTab('all')">All Residents</button>
        <button class="tab-btn" onclick="switchTab('present')">Present</button>
        ${isManager ? `<button class="tab-btn" onclick="switchTab('removed')">Removed</button>` : ''}
      </div>

      <div id="tab-all" class="tab-content">
        <div class="section">
          ${isManager ? `<button class="btn-primary" onclick="toggleEditMode()" id="edit-btn" style="margin-bottom:8px;">Edit List</button>` : ''}
          <div id="all-users-list">Loading...</div>
          ${isManager ? `<button class="btn-primary" onclick="saveUserOrder()" id="save-btn" style="display:none;">Save Order</button>` : ''}
        </div>
      </div>

      <div id="tab-present" class="tab-content" style="display:none;">
        <div class="section">
          <div id="present-users-list">Loading...</div>
        </div>
      </div>

      ${isManager ? `
      <div id="tab-removed" class="tab-content" style="display:none;">
        <div class="section">
          <div id="removed-users-list">Loading...</div>
        </div>
      </div>` : ''}
    </div>
  `;
}

function toggleEditMode() {
  editMode = !editMode;
  const editBtn = document.getElementById('edit-btn');
  const saveBtn = document.getElementById('save-btn');
  if (editMode) {
    editBtn.textContent = 'Cancel Edit';
    saveBtn.style.display = 'block';
  } else {
    editBtn.textContent = 'Edit List';
    saveBtn.style.display = 'none';
  }
  loadAllUsersList();
}

async function loadUsersData() {
  const isManager = (window.currentUser.activeRole === 'manager' || window.currentUser.activeRole === 'po');
  if (usersListener) usersListener();
  
  usersListener = db.collection('users')
    .where('approved', '==', true)
    .where('active', '==', true)
    .orderBy('order', 'asc')
    .onSnapshot(snapshot => {
      allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const presentCount = allUsers.filter(u => u.present).length;
      const countEl = document.getElementById('present-count');
      if (countEl) countEl.textContent = presentCount;
      loadAllUsersList();
      loadPresentUsersList();
      if (isManager) loadRemovedUsersList();
    });
}

function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
  const btn = document.querySelector('[onclick="switchTab(\'' + tabName + '\')"]');
  if (btn) btn.classList.add('active');
  const tabEl = document.getElementById('tab-' + tabName);
  if (tabEl) tabEl.style.display = 'block';
}

function loadAllUsersList() {
  const el = document.getElementById('all-users-list');
  const isManager = (window.currentUser.activeRole === 'manager' || window.currentUser.activeRole === 'po');
  
  if (allUsers.length === 0) {
    el.innerHTML = '<p>No users yet</p>';
    return;
  }

  el.innerHTML = allUsers.map((user, index) => `
    <div class="list-item" style="font-size:13px;">
      <span style="font-weight:500;">${index + 1}. ${user.name}</span>
      ${isManager ? `<span class="user-role-badge ${user.role}">${user.role}</span>` : ''}
      <span ${isManager && editMode ? `onclick="togglePresence('${user.id}')" style="cursor:pointer; font-size:12px;" title="Tap to toggle"` : ''}>
        <span class="status-dot ${user.present ? 'present' : 'absent'}"></span> ${user.present ? 'Present' : 'Absent'}
      </span>
      ${user.mobile ? `<span>${user.mobile}</span>` : ''}
      ${isManager ? `<span style="font-size:11px; color:var(--text-secondary);">${user.email}</span>` : ''}
      ${isManager && editMode ? `
      <div style="display:flex; gap:4px; margin-top:4px;">
        ${window.currentUser.role === 'po' && user.role === 'resident' ? `<button class="btn-sm" onclick="makeManager('${user.id}')" style="background:var(--warning); color:white;">Promote</button>` : ''}
        ${window.currentUser.role === 'po' && user.role === 'manager' ? `<button class="btn-sm" onclick="makeResident('${user.id}')" style="background:var(--primary); color:white;">Demote</button>` : ''}
        <button class="btn-sm" onclick="moveUserUp('${user.id}', ${index})">Up</button>
        <button class="btn-sm" onclick="moveUserDown('${user.id}', ${index})">Down</button>
        <button class="btn-sm" onclick="resetUserPassword('${user.id}', '${user.email}')" style="background:var(--text-secondary); color:white;" title="Reset Password">Reset PW</button>
        <button class="btn-danger btn-sm" onclick="removeUser('${user.id}')">Remove</button>
      </div>` : ''}
    </div>
  `).join('');
}

async function togglePresence(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;
  const newPresence = !user.present;
  try {
    await db.collection('users').doc(userId).update({ present: newPresence });
    if (newPresence) {
      await db.collection('attendance').add({
        userId: userId, checkInDate: today(), checkOutDate: null, nextCheckInDate: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      const activeCheckIn = await db.collection('attendance')
        .where('userId', '==', userId).where('checkOutDate', '==', null)
        .orderBy('checkInDate', 'desc').limit(1).get();
      if (!activeCheckIn.empty) await activeCheckIn.docs[0].ref.update({ checkOutDate: today() });
    }
  } catch (error) { alert('Error: ' + error.message); }
}

function moveUserUp(userId, index) { if (index === 0) return; [allUsers[index], allUsers[index - 1]] = [allUsers[index - 1], allUsers[index]]; loadAllUsersList(); }
function moveUserDown(userId, index) { if (index === allUsers.length - 1) return; [allUsers[index], allUsers[index + 1]] = [allUsers[index + 1], allUsers[index]]; loadAllUsersList(); }

async function saveUserOrder() {
  if (!confirm('Save current order?')) return;
  try {
    const batch = db.batch();
    allUsers.forEach((user, i) => { batch.update(db.collection('users').doc(user.id), { order: i + 1 }); });
    await batch.commit();
    editMode = false;
    document.getElementById('edit-btn').textContent = 'Edit List';
    document.getElementById('save-btn').style.display = 'none';
    loadAllUsersList();
    alert('Order saved!');
  } catch (error) { alert('Error: ' + error.message); }
}

async function removeUser(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!confirm('Remove ' + (user?.name || userId) + ' from PG?')) return;
  try { await db.collection('users').doc(userId).update({ active: false, removedAt: firebase.firestore.FieldValue.serverTimestamp() }); }
  catch (error) { alert('Error: ' + error.message); }
}

function loadPresentUsersList() {
  const el = document.getElementById('present-users-list');
  const presentUsers = allUsers.filter(u => u.present);
  if (presentUsers.length === 0) { el.innerHTML = '<p>No one is currently in PG</p>'; return; }
  el.innerHTML = presentUsers.map((user, index) => `
    <div class="list-item" style="font-size:13px;">
      <span style="font-weight:500;">${index + 1}. ${user.name}</span>
      ${user.mobile ? `<span>${user.mobile}</span>` : ''}
    </div>
  `).join('');
}

async function loadRemovedUsersList() {
  const el = document.getElementById('removed-users-list');
  const snapshot = await db.collection('users').where('active', '==', false).orderBy('removedAt', 'desc').get();
  if (snapshot.empty) { el.innerHTML = '<p>No removed users</p>'; return; }
  el.innerHTML = snapshot.docs.map(doc => {
    const data = doc.data();
    const daysAgo = data.removedAt ? Math.floor((Date.now() - data.removedAt.toMillis()) / 86400000) : '?';
    return `<div class="list-item"><span>${data.name}</span><span>Removed ${daysAgo} days ago</span><button class="btn-success btn-sm" onclick="reactivateUser('${doc.id}')">Restore</button></div>`;
  }).join('');
}

async function reactivateUser(userId) {
  if (!confirm('Restore this user?')) return;
  try { await db.collection('users').doc(userId).update({ active: true, removedAt: null, order: allUsers.length + 1 }); }
  catch (error) { alert('Error: ' + error.message); }
}

async function makeManager(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user || !confirm('Promote ' + user.name + ' to Manager?')) return;
  try { await db.collection('users').doc(userId).update({ role: 'manager', activeRole: 'manager' }); alert(user.name + ' is now a Manager!'); }
  catch (error) { alert('Error: ' + error.message); }
}

async function makeResident(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user || !confirm('Demote ' + user.name + ' to Resident?')) return;
  try { await db.collection('users').doc(userId).update({ role: 'resident', activeRole: 'resident' }); alert(user.name + ' is now a Resident!'); }
  catch (error) { alert('Error: ' + error.message); }
}

async function resetUserPassword(userId, email) {
  if (!confirm(`Send password reset email to ${email}?`)) return;
  try { await auth.sendPasswordResetEmail(email); alert(`Password reset link sent to ${email}`); }
  catch (error) { alert('Error: ' + error.message); }
}