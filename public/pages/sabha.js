// ============================================
// 📝 WEEKLY SABHA MODULE
// ============================================

async function getSabhaHTML() {
  const userId = window.currentUser.uid;
  const isManager = window.currentUser.role === 'manager' || window.currentUser.role === 'po';
  
  const config = await getPGConfig();
  const isKaryakar = config?.currentKaryakarId === userId;
  
  return `
    <div class="page sabha-page">
      <h2>📝 Weekly Sabha</h2>
      
      <div class="section">
        <h3>👤 Current Karyakar</h3>
        <p id="karyakar-info">Loading...</p>
        ${isManager ? `<button class="btn-primary" onclick="showSetKaryakarDialog()">Change Karyakar</button>` : ''}
      </div>

      <div class="section">
        <h3>📋 This Week's Sabha Tasks</h3>
        <div id="sabha-tasks">Loading...</div>
      </div>

      <div id="karyakar-section" style="display:none;">
        <div class="section">
          <h3>✍️ Assign Tasks</h3>
          <div id="task-assignment-form">Loading...</div>
          <button class="btn-primary" onclick="finishSabha()">✅ Finish Assignment</button>
        </div>
      </div>

      <div class="section">
        <h3>👤 My Assigned Tasks</h3>
        <div id="my-sabha-tasks">Loading...</div>
      </div>
    </div>
  `;
}

async function loadSabhaPageData() {
  const userId = window.currentUser.uid;
  const config = await getPGConfig();
  const isKaryakar = config?.currentKaryakarId === userId;
  const isManager = window.currentUser.role === 'manager' || window.currentUser.role === 'po';

  const karyakarId = config?.currentKaryakarId;
  const karyakarInfo = document.getElementById('karyakar-info');
  if (karyakarId) {
    const karyakarDoc = await db.collection('users').doc(karyakarId).get();
    const karyakarName = karyakarDoc.exists ? karyakarDoc.data().name : karyakarId;
    karyakarInfo.innerHTML = `<strong>${karyakarName}</strong> is the current Karyakar`;
  } else {
    karyakarInfo.innerHTML = 'No Karyakar assigned yet';
  }

  const todayDate = new Date();
  const dayOfWeek = todayDate.getDay();
  let wednesday = new Date(todayDate);
  if (dayOfWeek <= 3) { wednesday.setDate(todayDate.getDate() + (3 - dayOfWeek)); }
  else { wednesday.setDate(todayDate.getDate() + (10 - dayOfWeek)); }
  const wednesdayStr = formatDate(wednesday);

  const sabhaDoc = await db.collection('weeklySabha').doc(wednesdayStr).get();
  const tasksEl = document.getElementById('sabha-tasks');

  if (sabhaDoc.exists) {
    const data = sabhaDoc.data();
    
    if (data.isFinished) {
      tasksEl.innerHTML = '<p>✅ Tasks have been assigned!</p>';
      tasksEl.innerHTML += (data.tasks || []).map(t => `
        <div class="list-item">
          <span>👤 ${t.assigneeName || t.assigneeId}: ${t.taskDescription}</span>
          <span>${t.status === 'accepted' ? '✅' : t.status === 'declined' ? '❌' : '⏳'}</span>
        </div>
      `).join('');
    } else {
      tasksEl.innerHTML = '<p>⏳ Tasks not yet assigned. Waiting for Karyakar.</p>';
    }

    const myTasks = (data.tasks || []).filter(t => t.assigneeId === userId);
    const myTasksEl = document.getElementById('my-sabha-tasks');
    if (myTasks.length > 0) {
      myTasksEl.innerHTML = myTasks.map(t => `
        <div class="list-item">
          <span>📌 ${t.taskDescription}</span>
          <span>Status: ${t.status === 'accepted' ? '✅ Accepted' : t.status === 'declined' ? '❌ Declined' : '⏳ Pending'}</span>
          ${t.status === 'pending' ? `
            <div>
              <button class="btn-success btn-sm" onclick="acceptSabhaTask('${wednesdayStr}', '${t.assigneeId}', '${t.taskDescription.replace(/'/g, "\\'")}')">Accept ✅</button>
              <button class="btn-danger btn-sm" onclick="declineSabhaTask('${wednesdayStr}', '${t.assigneeId}', '${t.taskDescription.replace(/'/g, "\\'")}')">Decline ❌</button>
            </div>
          ` : ''}
        </div>
      `).join('');
    } else {
      myTasksEl.innerHTML = '<p>No tasks assigned to you</p>';
    }

    if (isKaryakar && !data.isFinished) {
      document.getElementById('karyakar-section').style.display = 'block';
      loadTaskAssignmentForm();
    }
  } else {
    tasksEl.innerHTML = '<p>No sabha created yet for this week</p>';
    document.getElementById('my-sabha-tasks').innerHTML = '<p>No tasks yet</p>';
    if (isKaryakar) {
      document.getElementById('karyakar-section').style.display = 'block';
      loadTaskAssignmentForm();
    }
  }
}

async function acceptSabhaTask(dateStr, userId, taskDesc) {
  try {
    const docRef = db.collection('weeklySabha').doc(dateStr);
    const doc = await docRef.get();
    const tasks = (doc.data().tasks || []).map(t => {
      if (t.assigneeId === userId && t.taskDescription === taskDesc) {
        return { ...t, status: 'accepted' };
      }
      return t;
    });
    await docRef.update({ tasks });
    const config = await getPGConfig();
    if (config?.currentKaryakarId) {
      await sendNotification(config.currentKaryakarId, 'Task Accepted', `${window.currentUser.name} accepted task: ${taskDesc}`, '/');
    }
    alert('✅ Task accepted!');
    loadSabhaPageData();
  } catch (error) { alert('Error: ' + error.message); }
}

async function declineSabhaTask(dateStr, userId, taskDesc) {
  if (!confirm('Are you sure you want to decline this task?')) return;
  try {
    const docRef = db.collection('weeklySabha').doc(dateStr);
    const doc = await docRef.get();
    const tasks = (doc.data().tasks || []).map(t => {
      if (t.assigneeId === userId && t.taskDescription === taskDesc) {
        return { ...t, status: 'declined' };
      }
      return t;
    });
    await docRef.update({ tasks });
    const config = await getPGConfig();
    if (config?.currentKaryakarId) {
      await sendNotification(config.currentKaryakarId, 'Task Declined', `${window.currentUser.name} declined task: ${taskDesc}`, '/');
    }
    alert('Task declined.');
    loadSabhaPageData();
  } catch (error) { alert('Error: ' + error.message); }
}

async function loadTaskAssignmentForm() {
  const users = await getAllUsers();
  const formEl = document.getElementById('task-assignment-form');
  formEl.innerHTML = users.map(user => `
    <div class="list-item">
      <span><strong>${user.name}</strong></span>
      <input type="text" id="task-${user.id}" placeholder="Enter task..." style="flex:1; margin-left:10px;">
    </div>
  `).join('');
}

async function finishSabha() {
  const todayDate = new Date();
  const dayOfWeek = todayDate.getDay();
  let wednesday = new Date(todayDate);
  if (dayOfWeek <= 3) { wednesday.setDate(todayDate.getDate() + (3 - dayOfWeek)); }
  else { wednesday.setDate(todayDate.getDate() + (10 - dayOfWeek)); }
  const wednesdayStr = formatDate(wednesday);

  const users = await getAllUsers();
  const tasks = [];

  users.forEach(user => {
    const taskInput = document.getElementById(`task-${user.id}`);
    if (taskInput && taskInput.value.trim()) {
      const sanitizedTask = taskInput.value.trim()
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      
      tasks.push({
        assigneeId: user.id,
        assigneeName: user.name,
        taskDescription: sanitizedTask,
        status: 'pending'
      });
    }
  });

  if (tasks.length === 0) { alert('Please assign at least one task'); return; }

  try {
    await db.collection('weeklySabha').doc(wednesdayStr).set({
      date: wednesdayStr,
      karyakarId: window.currentUser.uid,
      isFinished: true,
      tasks: tasks,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    for (const task of tasks) {
      await sendNotification(task.assigneeId, 'Sabha Task', `You have been assigned: ${task.taskDescription}`, '/');
    }

    alert('✅ Sabha tasks assigned successfully!');
    loadSabhaPageData();
  } catch (error) { alert('Error: ' + error.message); }
}