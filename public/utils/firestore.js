// ============================================
// 📦 COMMON FIRESTORE OPERATIONS
// ============================================

// Get all approved users (residents + managers)
async function getAllUsers() {
  const snapshot = await db.collection('users')
    .where('approved', '==', true)
    .where('active', '==', true)
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Get all pending users
async function getPendingUsers() {
  const snapshot = await db.collection('users')
    .where('approved', '==', false)
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Approve a user
async function approveUser(userId) {
  await db.collection('users').doc(userId).update({
    approved: true,
    role: 'resident'
  });
}

// Reject a user (delete their account)
async function rejectUser(userId) {
  await db.collection('users').doc(userId).delete();
}

// Update user role
async function updateUserRole(userId, role) {
  await db.collection('users').doc(userId).update({ role });
}

// Get PG config
async function getPGConfig() {
  const doc = await db.collection('pgConfig').doc('global').get();
  return doc.exists ? doc.data() : null;
}

// Update PG config
async function updatePGConfig(data) {
  await db.collection('pgConfig').doc('global').set(data, { merge: true });
}

// Get available people for a specific date
async function getAvailablePeople(dateStr) {
  const users = await getAllUsers();
  const available = [];
  
  for (const user of users) {
    const checkIns = await db.collection('attendance')
      .where('userId', '==', user.id)
      .where('checkInDate', '<=', dateStr)
      .orderBy('checkInDate', 'desc')
      .limit(1)
      .get();
    
    if (!checkIns.empty) {
      const record = checkIns.docs[0].data();
      if (!record.checkOutDate || record.checkOutDate >= dateStr) {
        available.push({ id: user.id, name: user.name });
      }
    }
  }
  
  return available;
}