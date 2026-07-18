// ============================================
// 👥 USERS MANAGEMENT PAGE
// ============================================

let allUsers = [];
let currentTab = 'all';
let editMode = false;
let usersListener = null;

async function getUsersHTML() {
  const isManager = (window.currentUser.activeRole === 'manager' || window.currentUser.activeRole === 'po');
  
  return `
    <div class="page users-page">
      <h2>👥 Users</h2>
      
      <!-- Present Count -->
      <div class="section" style="text-align:center;">
        <p style="font-size:18px;">🟢 <strong id="present-count">...</strong> people present today</p>
      </div>
      
      <!-- Tabs -->
      <div class="tab-bar">
        <button class="tab-btn active" onclick="switchTab('all')">📋 All Residents</button>
        <button class="tab-btn" onclick="switchTab('present')">🟢 Present</button>
        ${isManager ? `<button class="tab-btn" onclick="switchTab('removed')">🗑️ Removed</button>` : ''}
      </div>

      <!-- List 1: All Residents -->
      <div id="tab-all" class="tab-content">
        <div class="section">
          ${isManager ? `<button class="btn-primary" onclick="toggleEditMode()" id="edit-btn" style="margin-bottom:8px;">✏️ Edit List</button>` : ''}
          <div id="all-users-list">Loading...</div>
          ${isManager ? `<button class="btn-primary" onclick="saveUserOrder()" id="save-btn" style="display:none;">💾 Save Order</button>` : ''}
        </div>
      </div>

      <!-- List 2: Present People -->
      <div id="tab-present" class="tab-content" style="display:none;">
        <div class="section">
          <div id="present-users-list">Loading...</div>
        </div>
      </div>

      <!-- List 3: Removed Users -->
      ${isManager ? `
      <div id="tab-removed" class="tab-content" style="display:none;">
        <div class="section">
          <div id="removed-users-list">Loading...</div>
        </div>
      </div>` : ''}
    </div>
  `;
}

// Toggle edit mode
function toggleEditMode() {
  editMode = !editMode;
  const editBtn = document.getElementById('edit-btn');
  const saveBtn = document.getElementById('save-btn');
  
  if (editMode) {
    editBtn.textContent = '❌ Cancel Edit';
    saveBtn.style.display = 'block';
  } else {
    editBtn.textContent = '✏️ Edit List';
    saveBtn.style.display = 'none';
  }
  
  loadAllUsersList();
}

// Load users data with real-time listener
async function loadUsersData() {
  const isManager = (window.currentUser.activeRole === 'manager' || window.currentUser.activeRole === 'po');
  
  if (usersListener) usersListener();
  
  usersListener = db.collection('users')
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

// Switch tab
function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
  
  const btn = document.querySelector('[onclick="switchTab(\'' + tabName + '\')"]');
  if (btn) btn.classList.add('active');
  const tabEl = document.getElementById('tab-' + tabName);
  if (tabEl) tabEl.style.display = 'block';
}

// Load All Users list
function loadAllUsersList() {
  const el = document.getElementById('all-users-list');
  const isManager = (window.currentUser.activeRole === 'manager' || window.currentUser.activeRole === 'po');
  
  if (allUsers.length === 0) {
    el.innerHTML = '<p>No users yet</p>';
    return;
  }

  el.innerHTML = allUsers.map((user, index) => `
    <div class="list-item" style="font-size:13px;">
      <span>${index + 1}. ${user.name}</span>
      ${isManager ? `<span class="user-role-badge ${user.role}">${user.role}</span>` : ''}
      <span class="user-status" ${isManager && editMode ? `onclick="togglePresence('${user.id}')" style="cursor:pointer;" title="Tap to toggle"` : ''}>${user.present ? '🟢' : '🔴'}</span>
      ${user.mobile ? `<span>📱 ${user.mobile}</span>` : ''}
      ${isManager ? `<span style="font-size:11px;">📧 ${user.email}</span>` : ''}
      ${isManager && editMode ? `
      <div style="display:flex; gap:4px; margin-top:4px;">
        ${window.currentUser.role === 'po' && user.role === 'resident' ? `<button class="btn-sm" onclick="makeManager('${user.id}')" style="background:#FF9800; color:white;">👑</button>` : ''}
        ${window.currentUser.role === 'po' && user.role === 'manager' ? `<button class="btn-sm" onclick="makeResident('${user.id}')" style="background:#2196F3; color:white;">⬇️</button>` : ''}
        <button class="btn-sm" onclick="moveUserUp('${user.id}', ${index})">⬆️</button>
        <button class="btn-sm" onclick="moveUserDown('${user.id}', ${index})">⬇️</button>
        <button class="btn-danger btn-sm" onclick="removeUser('${user.id}')">🗑️</button>
      </div>` : ''}
    </div>
  `).join('');
}

// Toggle user presence
async function togglePresence(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;
  
  const newPresence = !user.present;
  
  try {
    await db.collection('users').doc(userId).update({ present: newPresence });
    
    if (newPresence) {
      await db.collection('attendance').add({
        userId: userId,
        checkInDate: today(),
        checkOutDate: null,
        nextCheckInDate: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      const activeCheckIn = await db.collection('attendance')
        .where('userId', '==', userId)
        .where('checkOutDate', '==', null)
        .orderBy('checkInDate', 'desc')
        .limit(1)
        .get();
      
      if (!activeCheckIn.empty) {
        await activeCheckIn.docs[0].ref.update({ checkOutDate: today() });
      }
    }
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

// Move user up in order
function moveUserUp(userId, index) {
  if (index === 0) return;
  [allUsers[index], allUsers[index - 1]] = [allUsers[index - 1], allUsers[index]];
  loadAllUsersList();
}

// Move user down in order
function moveUserDown(userId, index) {
  if (index === allUsers.length - 1) return;
  [allUsers[index], allUsers[index + 1]] = [allUsers[index + 1], allUsers[index]];
  loadAllUsersList();
}

// Save user order to Firestore
async function saveUserOrder() {
  if (!confirm('Save current order?')) return;
  
  try {
    const batch = db.batch();
    allUsers.forEach((user, i) => {
      batch.update(db.collection('users').doc(user.id), { order: i + 1 });
    });
    await batch.commit();
    
    editMode = false;
    document.getElementById('edit-btn').textContent = '✏️ Edit List';
    document.getElementById('save-btn').style.display = 'none';
    loadAllUsersList();
    
    alert('✅ Order saved!');
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

// Remove user
async function removeUser(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!confirm('Remove ' + (user?.name || userId) + ' from PG?')) return;
  
  try {
    await db.collection('users').doc(userId).update({
      active: false,
      removedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

// Load Present Users list
function loadPresentUsersList() {
  const el = document.getElementById('present-users-list');
  const presentUsers = allUsers.filter(u => u.present);
  
  if (presentUsers.length === 0) {
    el.innerHTML = '<p>No one is currently in PG</p>';
    return;
  }

  el.innerHTML = presentUsers.map((user, index) => `
    <div class="list-item" style="font-size:13px;">
      <span>${index + 1}. ${user.name}</span>
      ${user.mobile ? `<span>📱 ${user.mobile}</span>` : ''}
    </div>
  `).join('');
}

// Load Removed Users list
async function loadRemovedUsersList() {
  const el = document.getElementById('removed-users-list');
  
  const snapshot = await db.collection('users')
    .where('active', '==', false)
    .orderBy('removedAt', 'desc')
    .get();
  
  if (snapshot.empty) {
    el.innerHTML = '<p>No removed users</p>';
    return;
  }

  el.innerHTML = snapshot.docs.map(doc => {
    const data = doc.data();
    const daysAgo = data.removedAt ? Math.floor((Date.now() - data.removedAt.toMillis()) / 86400000) : '?';
    return `
      <div class="list-item">
        <span>${data.name}</span>
        <span>Removed ${daysAgo} days ago</span>
        <button class="btn-success btn-sm" onclick="reactivateUser('${doc.id}')">↩️ Restore</button>
      </div>
    `;
  }).join('');
}

// Reactivate user
async function reactivateUser(userId) {
  if (!confirm('Restore this user?')) return;
  
  try {
    await db.collection('users').doc(userId).update({
      active: true,
      removedAt: null,
      order: allUsers.length + 1
    });
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

// PO: Make Manager
async function makeManager(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;
  if (!confirm('Promote ' + user.name + ' to Manager?')) return;
  
  try {
    await db.collection('users').doc(userId).update({ role: 'manager', activeRole: 'manager' });
    alert('✅ ' + user.name + ' is now a Manager!');
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

// PO: Make Resident
async function makeResident(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;
  if (!confirm('Demote ' + user.name + ' to Resident?')) return;
  
  try {
    await db.collection('users').doc(userId).update({ role: 'resident', activeRole: 'resident' });
    alert('✅ ' + user.name + ' is now a Resident!');
  } catch (error) {
    alert('Error: ' + error.message);
  }
}