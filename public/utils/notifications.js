// ============================================
// 🔔 NOTIFICATIONS MODULE
// ============================================

// Send a notification to Firestore (for in-app display)
async function sendNotification(userId, title, body, url = '/') {
  try {
    await db.collection('notifications').add({
      userId: userId,
      title: title,
      body: body,
      url: url,
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

// Get unread notifications count
async function getUnreadCount(userId) {
  try {
    const snapshot = await db.collection('notifications')
      .where('userId', '==', userId)
      .where('read', '==', false)
      .get();
    return snapshot.size;
  } catch (error) {
    console.error('Error getting notifications:', error);
    return 0;
  }
}

// Mark notification as read
async function markAsRead(notificationId) {
  try {
    await db.collection('notifications').doc(notificationId).update({
      read: true
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
}

// Show browser notification (if permitted)
function showBrowserNotification(title, body) {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body: body,
      icon: '/icons/icon-192x192.png'
    });
  }
}

// Request browser notification permission
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }
  
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

// Listen for new notifications in real-time
function listenForNotifications(userId, callback) {
  return db.collection('notifications')
    .where('userId', '==', userId)
    .where('read', '==', false)
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          callback(change.doc.id, data);
        }
      });
    });
}