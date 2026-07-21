// ============================================
// 🧾 EXPENSE TRACKER MODULE
// ============================================

async function getExpensesHTML() {
  const isManager = (window.currentUser.activeRole === 'manager' || window.currentUser.activeRole === 'po');
  
  return `
    <div class="page expenses-page">
      <h2>🧾 Expense Tracker</h2>
      
      <div class="section">
        <h3>➕ Add New Expense</h3>
        <select id="expense-category">
          <option value="vegetables">🥬 Vegetables</option>
          <option value="milk">🥛 Milk</option>
          <option value="dairy">🧈 Dairy</option>
          <option value="groceries">🛒 Groceries</option>
          <option value="other">📦 Other</option>
        </select>
        <input type="number" id="expense-amount" placeholder="Amount (₹)" min="1">
        <input type="text" id="expense-desc" placeholder="Description">
        <input type="date" id="expense-date" value="${today()}">
        <button class="btn-primary" onclick="addExpense()">Add Expense 💾</button>
      </div>

      <div class="section">
        <h3>📋 My Expenses</h3>
        <div class="tab-bar">
          <button class="tab-btn active" onclick="switchExpenseTab('pending')">⏳ Pending</button>
          <button class="tab-btn" onclick="switchExpenseTab('settled')">✅ Settled</button>
        </div>
        <div id="my-pending-expenses">Loading...</div>
        <div id="my-settled-expenses" style="display:none;">Loading...</div>
      </div>

      ${isManager ? `
      <div id="admin-expenses-section">
        <div class="section">
          <h3>💵 Pending Settlement</h3>
          <div id="unsettled-expenses">Loading...</div>
        </div>
        <div class="section">
          <h3>✅ Recently Settled</h3>
          <div id="settled-expenses">Loading...</div>
        </div>
      </div>` : ''}
    </div>
  `;
}

function switchExpenseTab(tab) {
  document.querySelectorAll('#my-pending-expenses, #my-settled-expenses').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  
  if (tab === 'pending') {
    document.getElementById('my-pending-expenses').style.display = 'block';
    document.querySelector('[onclick="switchExpenseTab(\'pending\')"]').classList.add('active');
  } else {
    document.getElementById('my-settled-expenses').style.display = 'block';
    document.querySelector('[onclick="switchExpenseTab(\'settled\')"]').classList.add('active');
  }
}

async function loadExpensesPageData() {
  const userId = window.currentUser.uid;
  const isManager = (window.currentUser.activeRole === 'manager' || window.currentUser.activeRole === 'po');

  if (isManager) {
    loadUnsettledExpenses();
    loadSettledExpenses();
  }

  // My pending (including partially settled)
  const pendingSnapshot = await db.collection('expenses')
    .where('userId', '==', userId)
    .where('status', 'in', ['pending_settlement', 'partially_settled'])
    .orderBy('date', 'desc')
    .get();

  const pendingEl = document.getElementById('my-pending-expenses');
  if (!pendingSnapshot.empty) {
    pendingEl.innerHTML = pendingSnapshot.docs.map(doc => {
      const data = doc.data();
      const settled = data.settledAmount || 0;
      const remaining = data.totalAmount - settled;
      return `
        <div class="list-item" style="font-size:13px;">
          <span>${data.category} - ${data.description || ''}</span>
          <span>Total: ₹${data.totalAmount}</span>
          ${settled > 0 ? `<span>Settled: ₹${settled}</span>` : ''}
          <span>Pending: ₹${remaining}</span>
          <span>⏳</span>
        </div>
      `;
    }).join('');
  } else {
    pendingEl.innerHTML = '<p>No pending expenses</p>';
  }

  // My settled (fully)
  const settledSnapshot = await db.collection('expenses')
    .where('userId', '==', userId)
    .where('status', '==', 'settled')
    .orderBy('settledAt', 'desc')
    .get();

  const settledEl = document.getElementById('my-settled-expenses');
  if (!settledSnapshot.empty) {
    settledEl.innerHTML = settledSnapshot.docs.map(doc => {
      const data = doc.data();
      return `
        <div class="list-item" style="font-size:13px;">
          <span>${data.category} - ${data.description || ''}</span>
          <span>₹${data.totalAmount}</span>
          <span>${data.settledAt ? formatDisplayDate(data.settledAt.toDate()) : ''}</span>
          <span>✅</span>
        </div>
      `;
    }).join('');
  } else {
    settledEl.innerHTML = '<p>No settled expenses</p>';
  }
}

async function addExpense() {
  const category = document.getElementById('expense-category').value;
  const amount = parseInt(document.getElementById('expense-amount').value);
  const description = document.getElementById('expense-desc').value.trim();
  const date = document.getElementById('expense-date').value;

  if (category === 'other' && !description) {
    alert('Please enter a description for the "Other" category');
    return;
  }

  if (!amount || amount <= 0) {
    alert('Please enter a valid amount');
    return;
  }

  try {
    await db.collection('expenses').add({
      userId: window.currentUser.uid,
      userName: window.currentUser.name,
      category: category,
      totalAmount: amount,
      settledAmount: 0,
      description: description,
      date: date,
      status: 'pending_settlement',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      settledAt: null
    });

    alert('✅ Expense added!');
    document.getElementById('expense-amount').value = '';
    document.getElementById('expense-desc').value = '';
    loadExpensesPageData();
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

async function loadUnsettledExpenses() {
  const snapshot = await db.collection('expenses')
    .where('status', 'in', ['pending_settlement', 'partially_settled'])
    .orderBy('date', 'desc')
    .get();

  const el = document.getElementById('unsettled-expenses');
  let totalPending = 0;

  if (!snapshot.empty) {
    el.innerHTML = snapshot.docs.map(doc => {
      const data = doc.data();
      const settled = data.settledAmount || 0;
      const remaining = data.totalAmount - settled;
      totalPending += remaining;
      return `
        <div class="list-item">
          <span>${data.userName}: ${data.category}</span>
          <span>Total: ₹${data.totalAmount}</span>
          ${settled > 0 ? `<span>Settled: ₹${settled}</span>` : ''}
          <span>Left: ₹${remaining}</span>
          <input type="number" id="settle-amount-${doc.id}" placeholder="Amount" min="1" max="${remaining}" style="width:80px;">
          <button class="btn-success btn-sm" onclick="settleExpense('${doc.id}')">Settle</button>
        </div>
      `;
    }).join('');
    el.innerHTML += `<p><strong>Total Pending: ₹${totalPending}</strong></p>`;
  } else {
    el.innerHTML = '<p>No unsettled expenses 🎉</p>';
  }
}

async function loadSettledExpenses() {
  const snapshot = await db.collection('expenses')
    .where('status', '==', 'settled')
    .orderBy('settledAt', 'desc')
    .limit(20)
    .get();

  const el = document.getElementById('settled-expenses');
  if (!snapshot.empty) {
    el.innerHTML = snapshot.docs.map(doc => {
      const data = doc.data();
      return `
        <div class="list-item">
          <span>${data.userName}: ${data.category}</span>
          <span>₹${data.totalAmount}</span>
          <span>✅ ${data.settledAt ? formatDisplayDate(data.settledAt.toDate()) : ''}</span>
        </div>
      `;
    }).join('');
  } else {
    el.innerHTML = '<p>No settled expenses yet</p>';
  }
}

// Settle expense (partial or full)
async function settleExpense(docId) {
  const amountInput = document.getElementById(`settle-amount-${docId}`);
  const settleAmount = amountInput ? parseInt(amountInput.value) : 0;

  const doc = await db.collection('expenses').doc(docId).get();
  if (!doc.exists) return;
  
  const data = doc.data();
  const currentSettled = data.settledAmount || 0;
  const totalAmount = data.totalAmount;
  const remaining = totalAmount - currentSettled;
  
  // If no amount entered, settle full remaining
  const amount = settleAmount > 0 ? settleAmount : remaining;
  
  if (amount <= 0 || amount > remaining) {
    alert(`Please enter an amount between 1 and ${remaining}`);
    return;
  }

  const newSettled = currentSettled + amount;
  const newStatus = newSettled >= totalAmount ? 'settled' : 'partially_settled';

  if (!confirm(`Settle ₹${amount}? (Total settled will be ₹${newSettled}/${totalAmount})`)) return;

  await db.collection('expenses').doc(docId).update({
    settledAmount: newSettled,
    status: newStatus,
    settledAt: newStatus === 'settled' ? firebase.firestore.FieldValue.serverTimestamp() : null
  });

  // Clean up old fully settled expenses (14 days)
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const oldExpenses = await db.collection('expenses')
    .where('status', '==', 'settled')
    .where('settledAt', '<=', fourteenDaysAgo)
    .get();

  if (!oldExpenses.empty) {
    const batch = db.batch();
    oldExpenses.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  loadUnsettledExpenses();
  loadSettledExpenses();
}