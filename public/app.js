// ============================================
// 📱 MAIN APPLICATION LOGIC
// ============================================

let currentPage = 'my-activity';

async function initPGApp(userData) {
  const bottomNav = document.getElementById('bottom-nav');
  const role = userData.role;
  const activeRole = userData.activeRole || role;
  
  const config = await getPGConfig();
  const isKaryakar = config?.currentKaryakarId === window.currentUser?.uid;
  const isManagerOrPO = role === 'manager' || role === 'po';
  const isAdminMode = (activeRole === 'manager' || activeRole === 'po') && isManagerOrPO;
  
  let navItems = [];

  if (isAdminMode) {
    // PO/Manager mode - only admin tasks
    navItems = [
      { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
      { id: 'users', label: 'Users', icon: '👥' },
      { id: 'rent', label: 'Verify Rent', icon: '💰' },
      { id: 'expenses', label: 'Settle Expenses', icon: '🧾' },
      { id: 'cleaning', label: 'Cleaning', icon: '🧹' },
      { id: 'fv', label: 'F&V', icon: '🥬' },
    ];
    if (isKaryakar) {
      navItems.push({ id: 'sabha', label: 'Sabha', icon: '📝' });
    }
  } else {
    // Resident mode
    navItems = [
      { id: 'my-activity', label: 'Activity', icon: '👤' },
      { id: 'users', label: 'Users', icon: '👥' },
      { id: 'attendance', label: 'Attendance', icon: '📋' },
      { id: 'rent', label: 'Rent', icon: '💰' },
      { id: 'expenses', label: 'Expenses', icon: '🧾' },
      { id: 'cleaning', label: 'Cleaning', icon: '🧹' },
      { id: 'fv', label: 'F&V', icon: '🥬' },
    ];
    if (isKaryakar) {
      navItems.push({ id: 'sabha', label: 'Sabha', icon: '📝' });
    }
  }

  bottomNav.style.display = 'none';

  const hamburgerItems = document.getElementById('hamburger-menu-items');
  if (hamburgerItems) {
    hamburgerItems.innerHTML = navItems.map(item => `
      <button class="menu-item" onclick="loadPage('${item.id}'); toggleMenu();" style="display:block; width:100%; padding:10px; border:none; background:none; text-align:left; font-size:14px; cursor:pointer; border-radius:8px; margin:2px 0;">
        ${item.icon} ${item.label}
      </button>
    `).join('');
    
    hamburgerItems.innerHTML += `
      <hr style="border:0; border-top:1px solid #eee; margin:8px 0;">
      <button class="menu-item" onclick="logout()" style="display:block; width:100%; padding:10px; border:none; background:none; text-align:left; font-size:14px; cursor:pointer; border-radius:8px; color:#f44336;">
        🚪 Logout
      </button>
    `;
  }

  loadPage(isAdminMode ? 'dashboard' : 'my-activity');
  updateRoleSwitchUI();
  requestNotificationPermission();
}

async function loadPage(pageName) {
  currentPage = pageName;
  const mainContent = document.getElementById('main-content');
  const pageTitle = document.getElementById('page-title');
  
  mainContent.innerHTML = '<div class="spinner"></div>';

  const titles = {
    'my-activity': 'My Activity',
    'users': 'Users',
    'dashboard': 'Dashboard',
    'attendance': 'Attendance',
    'rent': 'Rent',
    'expenses': 'Expenses',
    'cleaning': 'Cleaning',
    'fv': 'F&V',
    'sabha': 'Sabha'
  };
  pageTitle.textContent = titles[pageName] || 'PG Manager';

  try {
    switch(pageName) {
      case 'my-activity':
        mainContent.innerHTML = await getMyActivityHTML();
        loadMyActivityData();
        break;
      case 'users':
        mainContent.innerHTML = await getUsersHTML();
        loadUsersData();
        break;
      case 'dashboard':
        mainContent.innerHTML = await getManagerDashboardHTML();
        loadAdminDashboardData();
        break;
      case 'attendance':
        mainContent.innerHTML = await getAttendanceHTML();
        loadAttendancePageData();
        break;
      case 'rent':
        mainContent.innerHTML = await getRentHTML();
        loadRentPageData();
        break;
      case 'expenses':
        mainContent.innerHTML = await getExpensesHTML();
        loadExpensesPageData();
        break;
      case 'cleaning':
        mainContent.innerHTML = await getCleaningHTML();
        loadCleaningPageData();
        break;
      case 'fv':
        mainContent.innerHTML = await getFVHTML();
        loadFVPageData();
        break;
      case 'sabha':
        mainContent.innerHTML = await getSabhaHTML();
        loadSabhaPageData();
        break;
      default:
        mainContent.innerHTML = '<h2>Page not found</h2>';
    }
  } catch (error) {
    console.error('Error loading page:', error);
    mainContent.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
  }
}

function toggleMenu() {
  const menu = document.getElementById('hamburger-menu');
  if (menu.style.display === 'none' || menu.style.display === '') {
    menu.style.display = 'block';
  } else {
    menu.style.display = 'none';
  }
}

document.addEventListener('click', function(e) {
  const menu = document.getElementById('hamburger-menu');
  const menuBtn = document.getElementById('menu-btn');
  if (menu && menuBtn && !menu.contains(e.target) && e.target !== menuBtn) {
    menu.style.display = 'none';
  }
});

function toggleProfile() {
  const dropdown = document.getElementById('profile-dropdown');
  const user = window.currentUser;
  
  if (dropdown.style.display === 'none' || dropdown.style.display === '') {
    document.getElementById('profile-name').textContent = '👤 ' + (user?.name || 'User');
    document.getElementById('profile-email').textContent = '📧 ' + (user?.email || '');
    document.getElementById('profile-role').textContent = '🔑 Active: ' + (user?.activeRole || user?.role || '');
    dropdown.style.display = 'block';
    updateThemeToggleUI();
    updateRoleSwitchUI();
  } else {
    dropdown.style.display = 'none';
  }
}

document.addEventListener('click', function(e) {
  const dropdown = document.getElementById('profile-dropdown');
  const profileBtn = document.getElementById('profile-btn');
  if (dropdown && profileBtn) {
    if (!dropdown.contains(e.target) && e.target !== profileBtn) {
      dropdown.style.display = 'none';
    }
  }
});

function updateRoleSwitchUI() {
  const section = document.getElementById('role-switch-section');
  const toggle = document.getElementById('role-switch-toggle');
  const dot = document.getElementById('role-switch-dot');
  const label = document.getElementById('role-switch-label');
  
  if (!section || !toggle) return;
  
  const user = window.currentUser;
  const isManagerOrPO = user?.role === 'manager' || user?.role === 'po';
  
  if (!isManagerOrPO) {
    section.style.display = 'none';
    return;
  }
  
  section.style.display = 'block';
  const isAdminMode = user?.activeRole === user?.role;
  
  if (isAdminMode) {
    toggle.style.background = '#4CAF50';
    dot.style.left = '22px';
    label.textContent = '👑 Switch to Resident';
  } else {
    toggle.style.background = '#ccc';
    dot.style.left = '2px';
    label.textContent = '👤 Switch to ' + (user?.role === 'po' ? 'PO' : 'Manager');
  }
}

async function toggleRoleMode() {
  const user = window.currentUser;
  const isManagerOrPO = user?.role === 'manager' || user?.role === 'po';
  if (!isManagerOrPO) return;
  
  const isAdminMode = user?.activeRole === user?.role;
  const newActiveRole = isAdminMode ? 'resident' : user?.role;
  
  try {
    await db.collection('users').doc(user.uid).update({
      activeRole: newActiveRole
    });
    
    window.currentUser.activeRole = newActiveRole;
    location.reload();
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

(function() {
  const savedTheme = localStorage.getItem('pg-theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
  }
  updateThemeToggleUI();
})();

function toggleTheme() {
  const body = document.body;
  body.classList.toggle('dark-mode');
  
  if (body.classList.contains('dark-mode')) {
    localStorage.setItem('pg-theme', 'dark');
  } else {
    localStorage.setItem('pg-theme', 'light');
  }
  updateThemeToggleUI();
}

function updateThemeToggleUI() {
  const toggle = document.getElementById('theme-toggle');
  const dot = document.getElementById('theme-toggle-dot');
  const label = document.getElementById('theme-label');
  if (!toggle || !dot) return;
  
  if (document.body.classList.contains('dark-mode')) {
    toggle.style.background = '#4CAF50';
    dot.style.left = '22px';
    if (label) label.textContent = '☀️ Light Mode';
  } else {
    toggle.style.background = '#ccc';
    dot.style.left = '2px';
    if (label) label.textContent = '🌙 Dark Mode';
  }
}