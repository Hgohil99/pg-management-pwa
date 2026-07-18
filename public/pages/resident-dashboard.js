// ============================================
// 🏠 RESIDENT DASHBOARD
// ============================================

async function getResidentDashboardHTML() {
  const user = window.currentUser;
  
  return `
    <div class="dashboard">
      <h2>Welcome, ${user.name}! 👋</h2>
      
      <!-- Quick Actions -->
      <div class="quick-actions">
        <div class="action-card" onclick="loadPage('attendance')">
          <span class="action-icon">📋</span>
          <span>Attendance</span>
        </div>
        <div class="action-card" onclick="loadPage('rent')">
          <span class="action-icon">💰</span>
          <span>Pay Rent</span>
        </div>
        <div class="action-card" onclick="loadPage('expenses')">
          <span class="action-icon">🧾</span>
          <span>Add Expense</span>
        </div>
        <div class="action-card" onclick="loadPage('sabha')">
          <span class="action-icon">📝</span>
          <span>My Tasks</span>
        </div>
      </div>

      <!-- Today's Duties -->
      <div class="section" id="today-duties">
        <h3>📌 Today's Duties</h3>
        <p>Loading...</p>
      </div>

      <!-- Recent Activity -->
      <div class="section" id="recent-activity">
        <h3>🕐 Recent Activity</h3>
        <p>Loading...</p>
      </div>
    </div>
  `;
}

// Load resident dashboard data
async function loadResidentDashboardData() {
  const userId = window.currentUser.uid;
  const todayDate = today();

  // Check today's cleaning assignment
  const cleaningDoc = await db.collection('cleaningAssignments').doc(todayDate).get();
  const dutiesEl = document.getElementById('today-duties');
  
  if (dutiesEl) {
    let dutiesHTML = '';
    
    if (cleaningDoc.exists) {
      const data = cleaningDoc.data();
      if (data.finalAssignee === userId) {
        dutiesHTML += '<p>🧹 You are assigned for <strong>Kitchen Cleaning</strong> today!</p>';
      }
    }

    // Check F&V assignment
    const fvDoc = await db.collection('fvAssignments').doc(todayDate).get();
    if (fvDoc.exists) {
      const data = fvDoc.data();
      const isAssigned = data.assignees?.some(a => a.userId === userId && a.status === 'confirmed');
      if (isAssigned) {
        dutiesHTML += '<p>🥬 You are assigned for <strong>F&V Purchase</strong> today!</p>';
      }
    }

    dutiesEl.innerHTML = dutiesHTML || '<p>No duties assigned for today 🎉</p>';
  }
}