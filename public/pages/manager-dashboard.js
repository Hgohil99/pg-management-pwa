// ============================================
// MANAGER DASHBOARD
// ============================================

let dashboardListeners = [];

async function getManagerDashboardHTML() {
  return `
    <div class="admin-dashboard">
      <h2>Dashboard</h2>
      
      <div class="stats-grid">
        <div class="stat-card" onclick="loadPage('attendance')">
          <h4>Present Today</h4>
          <span class="stat-number" id="stat-present">...</span>
        </div>
        <div class="stat-card" onclick="loadPage('rent')">
          <h4>Pending Rent</h4>
          <span class="stat-number" id="stat-rent">...</span>
        </div>
        <div class="stat-card" onclick="loadPage('expenses')">
          <h4>Unsettled</h4>
          <span class="stat-number" id="stat-expenses">...</span>
        </div>
      </div>

      <div class="section" id="pending-approvals-section">
        <h3>Pending Approvals</h3>
        <div id="pending-approvals">Loading...</div>
      </div>

      <div class="section" id="rent-verification-section">
        <h3>Rent to Verify</h3>
        <div id="rent-verification">Loading...</div>
      </div>

      <div class="section">
        <h3>Quick Actions</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; max-width:400px; margin:0 auto;">
          <button class="btn-primary" onclick="loadPage('attendance')" style="max-width:100%;">Attendance</button>
          <button class="btn-primary" onclick="loadPage('sabha')" style="max-width:100%;">Sabha</button>
          <button class="btn-primary" onclick="loadPage('users')" style="max-width:100%;">Users</button>
          <button class="btn-primary" onclick="loadPage('cleaning')" style="max-width:100%;">Cleaning</button>
          <button class="btn-primary" onclick="loadPage('fv')" style="max-width:100%; grid-column:1/-1; justify-self:center;">F&V Queue</button>
          ${window.currentUser?.role === 'po' ? `
          <button class="btn-danger" onclick="resetAllData()" style="max-width:100%; grid-column:1/-1; justify-self:center; margin-top:12px;">Reset All Data</button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function cleanupDashboardListeners() {
  dashboardListeners.forEach(unsub => unsub());
  dashboardListeners = [];
}

async function loadAdminDashboardData() {
  cleanupDashboardListeners();
  const d = new Date();
  const monthYear = `${String(d.getMonth() + 1).padStart(2, '0')}_${d.getFullYear()}`;

  const unsub1 = db.collection('users')
    .where('active', '==', true)
    .where('present', '==', true)
    .onSnapshot(snapshot => {
      const el = document.getElementById('stat-present');
      if (el) el.textContent = snapshot.size;
    });
  dashboardListeners.push(unsub1);

  const unsub2 = db.collection('rentPayments')
    .where('monthYear', '==', monthYear)
    .where('status', '==', 'paid')
    .onSnapshot(snapshot => {
      const el = document.getElementById('stat-rent');
      if (el) el.textContent = snapshot.size;
      loadRentVerificationList();
    });
  dashboardListeners.push(unsub2);

  const unsub3 = db.collection('expenses')
    .where('status', 'in', ['pending_settlement', 'partially_settled'])
    .onSnapshot(snapshot => {
      let total = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        total += (data.totalAmount - (data.settledAmount || 0));
      });
      const el = document.getElementById('stat-expenses');
      if (el) el.textContent = '\u20B9' + total;
    });
  dashboardListeners.push(unsub3);

  const unsub4 = db.collection('users')
    .where('approved', '==', false)
    .onSnapshot(snapshot => {
      const approvalsEl = document.getElementById('pending-approvals');
      if (!approvalsEl) return;
      
      if (!snapshot.empty) {
        const pending = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        approvalsEl.innerHTML = pending.map(user => `
          <div class="list-item">
            <div>
              <span style="font-weight:500;">${user.name || user.email}</span>
              <span style="font-size:12px; color:var(--text-secondary);">${user.email}</span>
              ${user.mobile ? `<span style="font-size:12px; color:var(--text-secondary);">${user.mobile}</span>` : ''}
            </div>
            <div>
              <button class="btn-success btn-sm" onclick="approveResident('${user.id}')">Approve</button>
              <button class="btn-danger btn-sm" onclick="rejectResident('${user.id}')">Reject</button>
            </div>
          </div>
        `).join('');
      } else {
        approvalsEl.innerHTML = '<p>No pending approvals</p>';
      }
    });
  dashboardListeners.push(unsub4);
}

async function loadRentVerificationList() {
  const d = new Date();
  const monthYear = `${String(d.getMonth() + 1).padStart(2, '0')}_${d.getFullYear()}`;
  
  const snapshot = await db.collection('rentPayments')
    .where('monthYear', '==', monthYear)
    .where('status', '==', 'paid')
    .limit(10)
    .get();
  
  const rentVerifyEl = document.getElementById('rent-verification');
  if (rentVerifyEl && !snapshot.empty) {
    rentVerifyEl.innerHTML = snapshot.docs.map(doc => {
      const data = doc.data();
      return `
        <div class="list-item">
          <span>${data.userName || data.userId} - \u20B9${data.amount}</span>
          ${data.screenshotUrl && data.screenshotUrl !== 'uploaded' ? 
            `<a href="${data.screenshotUrl}" target="_blank" class="btn-sm">View</a>` : ''}
          <button class="btn-success btn-sm" onclick="verifyRentPayment('${doc.id}')">Verify</button>
        </div>
      `;
    }).join('');
  } else if (rentVerifyEl) {
    rentVerifyEl.innerHTML = '<p>No rent to verify</p>';
  }
}

async function approveResident(userId) {
  if (confirm('Approve this user as Resident?')) {
    await db.collection('users').doc(userId).update({
      approved: true, role: 'resident', active: true, order: 9999
    });
    await sendNotification(userId, 'Account Approved', 'Your account has been approved! Welcome to PG Manager.', '/');
    alert('Resident approved! They can now login.');
  }
}

async function rejectResident(userId) {
  if (confirm('Are you sure you want to reject this user? This will delete their account.')) {
    await db.collection('users').doc(userId).delete();
  }
}

async function verifyRentPayment(docId) {
  if (confirm('Mark this payment as verified?')) {
    await db.collection('rentPayments').doc(docId).update({
      status: 'verified', verifiedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
}

async function showSetKaryakarDialog() {
  const users = await getAllUsers();
  const userList = users.map((u, i) => `${i + 1}. ${u.name}`).join('\n');
  const selection = prompt('Enter the name of the new Karyakar:\n\n' + userList);
  if (selection) {
    const user = users.find(u => u.name.toLowerCase() === selection.toLowerCase().trim());
    if (user) {
      await updatePGConfig({ currentKaryakarId: user.id });
      alert('Karyakar updated to ' + user.name);
      loadPage('sabha');
    } else {
      alert('User not found. Please enter exact name.');
    }
  }
}

async function resetAllData() {
  if (!confirm('WARNING: This will delete ALL data (rent, expenses, attendance, assignments, notifications). Users and PG Config will be kept. This CANNOT be undone. Continue?')) return;
  const collections = ['attendance', 'rentPayments', 'expenses', 'cleaningAssignments', 'fvAssignments', 'weeklySabha', 'notifications'];
  try {
    for (const col of collections) {
      const snapshot = await db.collection(col).get();
      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
    alert('All data has been reset!');
    location.reload();
  } catch (error) {
    alert('Error: ' + error.message);
  }
}