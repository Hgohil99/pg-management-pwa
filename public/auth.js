// ============================================
// 🔐 AUTHENTICATION MODULE
// ============================================

const IDLE_TIMEOUT = 15 * 60 * 1000;
const WARNING_BEFORE = 60 * 1000;
let idleTimer;
let warningTimer;

window.addEventListener('load', () => {
  if (auth.isSignInWithEmailLink(window.location.href)) {
    handleEmailLinkSignIn();
  }
});

function resetIdleTimer() {
  clearTimeout(idleTimer);
  clearTimeout(warningTimer);
  
  warningTimer = setTimeout(() => {
    if (confirm('⚠️ You will be logged out in 1 minute due to inactivity. Click OK to stay logged in.')) {
      resetIdleTimer();
    }
  }, IDLE_TIMEOUT - WARNING_BEFORE);
  
  idleTimer = setTimeout(() => {
    auth.signOut();
    window.currentUser = null;
    location.reload();
  }, IDLE_TIMEOUT);
}

['click', 'touchstart', 'scroll', 'keydown'].forEach(event => {
  document.addEventListener(event, resetIdleTimer);
});

window.addEventListener('beforeunload', () => {
  auth.signOut();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    setTimeout(() => {
      if (document.hidden) {
        auth.signOut();
        location.reload();
      }
    }, 5 * 60 * 1000);
  }
});

function showRegister() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('register-page').style.display = 'flex';
}

function showLogin() {
  document.getElementById('register-page').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
}

// Register form handler
document.getElementById('register-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const mobile = document.getElementById('reg-mobile').value.trim();
  const password = document.getElementById('reg-password').value;
  const messageEl = document.getElementById('register-message');

  if (!name || !email || !mobile || !password) {
    messageEl.innerHTML = '<p style="color:red;">All fields are required</p>';
    return;
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    messageEl.innerHTML = '<p style="color:red;">Please enter a valid email address</p>';
    return;
  }

  // Validate mobile (10 digits, Indian format)
  const cleanMobile = mobile.replace(/[\s\+\-]/g, '');
  const mobileRegex = /^[6-9]\d{9}$/;
  if (!mobileRegex.test(cleanMobile)) {
    messageEl.innerHTML = '<p style="color:red;">Please enter a valid 10-digit mobile number</p>';
    return;
  }

  // Validate password length
  if (password.length < 6) {
    messageEl.innerHTML = '<p style="color:red;">Password must be at least 6 characters</p>';
    return;
  }

  // Check if mobile already exists
  try {
    const mobileCheck = await db.collection('users').where('mobile', '==', mobile).get();
    if (!mobileCheck.empty) {
      messageEl.innerHTML = '<p style="color:orange;">⚠️ This mobile number is already registered. Please <a href="#" onclick="showLogin()" style="color:#4CAF50;">Sign In</a> instead.</p>';
      return;
    }
  } catch (error) {
    console.error('Mobile check error:', error);
  }

  // Check if name already exists
  try {
    const allUsers = await db.collection('users').get();
    const nameExists = allUsers.docs.some(doc => {
      const existingName = (doc.data().name || '').toLowerCase().trim();
      return existingName === name.toLowerCase();
    });
    if (nameExists) {
      messageEl.innerHTML = '<p style="color:orange;">⚠️ This name is already registered. If this is you, please <a href="#" onclick="showLogin()" style="color:#4CAF50;">Sign In</a>.</p>';
      return;
    }
  } catch (error) {
    console.error('Name check error:', error);
  }

  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const userId = userCredential.user.uid;

    await db.collection('users').doc(userId).set({
      name: name, email: email, mobile: cleanMobile,
      role: 'resident', activeRole: 'resident',
      approved: false, active: true, present: false,
      order: 9999,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      removedAt: null
    });

    document.getElementById('register-form').reset();
    messageEl.innerHTML = '<p style="color:green;">✅ Account created! Wait for Manager approval.</p>';
    
    await auth.signOut();
    setTimeout(() => {
      showLogin();
      document.getElementById('login-message').innerHTML = '<p style="color:orange;">⏳ Your request is pending with Manager for approval.</p>';
    }, 1500);
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      messageEl.innerHTML = '<p style="color:orange;">⚠️ This email is already registered. Please <a href="#" onclick="showLogin()" style="color:#4CAF50;">Sign In</a> instead.</p>';
    } else {
      messageEl.innerHTML = `<p style="color:red;">❌ ${error.message}</p>`;
    }
  }
});

// Auth state listener
auth.onAuthStateChanged(async (user) => {
  const loadingScreen = document.getElementById('loading-screen');
  const loginPage = document.getElementById('login-page');
  const registerPage = document.getElementById('register-page');
  const pendingPage = document.getElementById('pending-page');
  const appContainer = document.getElementById('app-container');

  loadingScreen.style.display = 'flex';
  loginPage.style.display = 'none';
  registerPage.style.display = 'none';
  pendingPage.style.display = 'none';
  appContainer.style.display = 'none';

  if (user) {
    try {
      const userDoc = await db.collection('users').doc(user.uid).get();
      
      if (!userDoc.exists) {
        await auth.signOut();
        loadingScreen.style.display = 'none';
        loginPage.style.display = 'flex';
        return;
      }

      const userData = userDoc.data();
      
      if (!userData.approved) {
        loadingScreen.style.display = 'none';
        pendingPage.style.display = 'flex';
        db.collection('users').doc(user.uid).onSnapshot(doc => {
          if (doc.exists && doc.data().approved) { location.reload(); }
        });
        return;
      }

      window.currentUser = {
        uid: user.uid, email: user.email, name: userData.name,
        mobile: userData.mobile, role: userData.role,
        activeRole: userData.activeRole || userData.role,
        approved: userData.approved, active: userData.active,
        present: userData.present
      };

      // Check if force logout was requested
      const lastForceLogout = userData.forceLogout ? userData.forceLogout.toMillis() : 0;
      const lastLogin = user.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime).getTime() : 0;
      if (lastForceLogout > lastLogin) {
        await auth.signOut();
        location.reload();
        return;
      }

      resetIdleTimer();
      await initPGApp(userData);
      loadingScreen.style.display = 'none';
      appContainer.style.display = 'block';
    } catch (error) {
      console.error('Auth error:', error);
      loadingScreen.style.display = 'none';
      loginPage.style.display = 'flex';
    }
  } else {
    loadingScreen.style.display = 'none';
    loginPage.style.display = 'flex';
  }
});

// Login form handler
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const loginMessage = document.getElementById('login-message');
  
  if (!email || !password) {
    loginMessage.innerHTML = '<p style="color:red;">Please enter email and password</p>';
    return;
  }

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    console.error('Login error:', error);
    if (error.code === 'auth/user-not-found') {
      loginMessage.innerHTML = '<p style="color:orange;">Account not found. Please <a href="#" onclick="showRegister()" style="color:#4CAF50;">Register</a> first.</p>';
    } else if (error.code === 'auth/wrong-password') {
      loginMessage.innerHTML = '<p style="color:red;">❌ Wrong password. Please try again.</p>';
    } else if (error.code === 'auth/invalid-credential') {
      loginMessage.innerHTML = '<p style="color:red;">❌ Invalid email or password.</p>';
    } else {
      loginMessage.innerHTML = `<p style="color:red;">❌ ${error.message}</p>`;
    }
  }
});

async function handleEmailLinkSignIn() {
  let email = window.localStorage.getItem('emailForSignIn');
  if (!email) { email = prompt('Please enter your email address to confirm sign-in:'); if (!email) return; }
  try {
    await auth.signInWithEmailLink(email, window.location.href);
    window.localStorage.removeItem('emailForSignIn');
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch (error) {
    console.error('Email link sign-in failed:', error);
    alert('Sign-in failed. Please try again.');
  }
}

function logout() {
  clearTimeout(idleTimer);
  clearTimeout(warningTimer);
  auth.signOut().then(() => { window.currentUser = null; location.reload(); })
    .catch(error => console.error('Logout error:', error));
}

function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') { input.type = 'text'; btn.textContent = '🙈'; }
  else { input.type = 'password'; btn.textContent = '👁️'; }
}

// Forgot password
async function resetPassword() {
  const email = document.getElementById('login-email').value.trim();
  if (!email) {
    alert('Please enter your email address first');
    return;
  }
  try {
    await auth.sendPasswordResetEmail(email);
    alert('Password reset link sent! Check your email (also check spam folder).');
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      alert('No account found with this email. Please register first.');
    } else {
      alert('Error: ' + error.message);
    }
  }
}