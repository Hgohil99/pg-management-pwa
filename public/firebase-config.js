// ============================================
// 🔥 FIREBASE CONFIGURATION - PUBLIC VERSION
// ============================================
// Replace with your own Firebase config from:
// Firebase Console → Project Settings → General → Your apps

const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "your-app.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-app.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Only initialize if local config didn't already
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  db.enablePersistence({ synchronizeTabs: true }).catch(err => {
    console.warn('Offline persistence error:', err.code);
  });
  auth.useDeviceLanguage();
}

console.log('✅ Firebase initialized');