// ============================================
// 🔥 FIREBASE CONFIGURATION
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyC0XwLcK-23_K6gmfDAxxBD463V46el7Kg",
  authDomain: "pg-management-app-67141.firebaseapp.com",
  projectId: "pg-management-app-67141",
  storageBucket: "pg-management-app-67141.appspot.com",
  messagingSenderId: "753376001182",
  appId: "1:753376001182:web:a3b84dd0fb99f5c65a8f8f"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Global references
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline data
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  console.warn('Offline persistence error:', err.code);
});

// Set auth language to browser default
auth.useDeviceLanguage();

console.log('✅ Firebase initialized');