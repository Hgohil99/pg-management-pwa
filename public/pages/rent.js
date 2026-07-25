// ============================================
// RENT MANAGEMENT MODULE
// ============================================

async function getRentHTML() {
  const isManager = (window.currentUser.activeRole === 'manager' || window.currentUser.activeRole === 'po');
  const d = new Date();
  const displayMonth = `${String(d.getMonth() + 1).padStart(2, '0')}_${d.getFullYear()}`;
  
  return `
    <div class="page rent-page">
      <h2>Rent Management</h2>
      
      <div class="section">
        <h3>My Rent - ${displayMonth}</h3>
        <div id="my-rent-status">Loading...</div>
      </div>

      <div class="section" id="upload-rent-section">
        <h3>Upload Payment Screenshot</h3>
        <p>Amount: <strong>Rs</strong> <input type="number" id="rent-amount-input" placeholder="Enter amount" min="1" style="width:150px; display:inline-block;"></p>
        <button class="btn-primary" onclick="uploadRent()">Upload & Mark as Paid</button>
      </div>

      <div class="section">
        <h3>My Rent History</h3>
        <div id="old-rent-records">Loading...</div>
      </div>

      ${isManager ? `
      <div id="admin-rent-section">
        <div class="section">
          <h3>All Rent Records - ${displayMonth}</h3>
          <div id="all-rent-records">Loading...</div>
        </div>
      </div>` : ''}
    </div>
  `;
}

async function loadRentPageData() {
  const userId = window.currentUser.uid;
  const d = new Date();
  const monthYear = `${String(d.getMonth() + 1).padStart(2, '0')}_${d.getFullYear()}`;
  const isManager = (window.currentUser.activeRole === 'manager' || window.currentUser.activeRole === 'po');

  if (isManager) { loadAllRentRecords(); }

  const docId = `${userId}_${monthYear}`;
  const rentDoc = await db.collection('rentPayments').doc(docId).get();
  const statusEl = document.getElementById('my-rent-status');

  if (rentDoc.exists) {
    const data = rentDoc.data();
    if (data.status === 'pending') {
      statusEl.innerHTML = '<p style="color:var(--warning);">Rent pending - Please pay and upload screenshot</p>';
      document.getElementById('upload-rent-section').style.display = 'block';
    } else if (data.status === 'paid') {
      statusEl.innerHTML = '<p style="color:var(--primary);">Payment uploaded - Waiting for verification</p>';
      document.getElementById('upload-rent-section').style.display = 'none';
    } else if (data.status === 'verified') {
      statusEl.innerHTML = '<p style="color:var(--success);">Rent verified and received!</p>';
      document.getElementById('upload-rent-section').style.display = 'none';
    }
  } else {
    statusEl.innerHTML = '<p style="color:var(--danger);">No rent record found for this month</p>';
    document.getElementById('upload-rent-section').style.display = 'block';
  }

  loadMyRentHistory(userId);
}

async function loadMyRentHistory(userId) {
  const snapshot = await db.collection('rentPayments')
    .where('userId', '==', userId).orderBy('monthYear', 'desc').limit(12).get();

  const el = document.getElementById('old-rent-records');
  if (!el) return;
  
  if (!snapshot.empty) {
    el.innerHTML = `
      <div class="list-item" style="font-weight:600; border-bottom:2px solid var(--primary);">
        <span>Month</span><span>Amount</span><span>Status</span><span>Paid Date</span><span>Verified Date</span>
      </div>
      ${snapshot.docs.map(doc => {
        const data = doc.data();
        const statusText = { 'pending': 'Pending', 'paid': 'Paid', 'verified': 'Verified' };
        const paidDate = data.paidAt ? formatDisplayDate(data.paidAt.toDate()) : '-';
        const verifiedDate = data.verifiedAt ? formatDisplayDate(data.verifiedAt.toDate()) : '-';
        return `
          <div class="list-item">
            <span>${data.monthYear}</span><span>Rs ${data.amount}</span><span>${statusText[data.status] || data.status}</span><span>${paidDate}</span><span>${verifiedDate}</span>
          </div>
        `;
      }).join('')}
    `;
  } else { el.innerHTML = '<p>No rent records found</p>'; }
}

async function uploadRent() {
  const amount = parseInt(document.getElementById('rent-amount-input').value);
  if (!amount || amount <= 0) { alert('Please enter a valid rent amount'); return; }

  const d = new Date();
  const monthYear = `${String(d.getMonth() + 1).padStart(2, '0')}_${d.getFullYear()}`;
  const userId = window.currentUser.uid;

  const response = await fetch('https://pg-management-pwa.vercel.app/api/cloudinary-sign');
  const signData = await response.json();

  cloudinary.openUploadWidget({
    cloudName: signData.cloudName, uploadSignature: signData.signature,
    uploadSignatureTimestamp: signData.timestamp, apiKey: '776889833388688',
    folder: signData.folder, sources: ['local', 'camera'], multiple: false,
    maxFileSize: 5000000, clientAllowedFormats: ['jpg', 'jpeg', 'png', 'pdf'], theme: 'minimal'
  }, async (error, result) => {
    if (error) { console.error('Upload error:', error); alert('Upload failed.'); return; }
    if (result.event === 'success') {
      const docId = `${userId}_${monthYear}`;
      await db.collection('rentPayments').doc(docId).set({
        userId, userName: window.currentUser.name, monthYear, amount, status: 'paid',
        screenshotUrl: result.info.secure_url,
        paidAt: firebase.firestore.FieldValue.serverTimestamp(), verifiedAt: null
      });
      const managers = await db.collection('users').where('role', 'in', ['manager', 'po']).get();
      managers.forEach(doc => sendNotification(doc.id, 'Rent Payment', `${window.currentUser.name} has paid rent.`, '/'));
      alert('Payment uploaded! Waiting for verification.');
      loadRentPageData();
    }
  });
}

async function loadAllRentRecords() {
  const d = new Date();
  const monthYear = `${String(d.getMonth() + 1).padStart(2, '0')}_${d.getFullYear()}`;
  const snapshot = await db.collection('rentPayments').where('monthYear', '==', monthYear).get();
  const el = document.getElementById('all-rent-records');
  if (!snapshot.empty) {
    el.innerHTML = snapshot.docs.map(doc => {
      const data = doc.data();
      const statusText = { 'pending': 'Pending', 'paid': 'Paid', 'verified': 'Verified' };
      return `<div class="list-item"><span>${data.userName || data.userId}</span><span>Rs ${data.amount}</span><span>${statusText[data.status] || data.status}</span>${data.status === 'paid' ? `<button class="btn-success btn-sm" onclick="verifyRentPayment('${doc.id}')">Verify</button>` : ''}</div>`;
    }).join('');
  } else { el.innerHTML = '<p>No rent records yet</p>'; }
}

async function verifyRentPayment(docId) {
  if (confirm('Mark this payment as verified?')) {
    await db.collection('rentPayments').doc(docId).update({ status: 'verified', verifiedAt: firebase.firestore.FieldValue.serverTimestamp() });
    loadAllRentRecords();
  }
}