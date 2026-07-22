// ============================================
// ATTENDANCE MODULE
// ============================================

async function getAttendanceHTML() {
  return `
    <div class="page attendance-page">
      <h2>Attendance</h2>
      
      <div class="section">
        <h3>My Status</h3>
        <p id="my-status">Loading...</p>
      </div>

      <div class="section" id="checkin-section">
        <h3>Check In (Arriving at PG)</h3>
        <label>Date:</label>
        <input type="date" id="checkin-date" value="${today()}" max="${getMaxCheckInDate()}" style="width:100%;">
        <button class="btn-primary" id="checkin-btn" onclick="checkIn()">Check In</button>
        <button class="btn-warning" id="modify-checkin-btn" onclick="modifyCheckIn()" style="display:none;">Modify Check In</button>
      </div>

      <div class="section" id="checkout-section" style="display:none;">
        <h3>Check Out (Leaving PG)</h3>
        <label>Departure Date:</label>
        <input type="date" id="checkout-date" value="${today()}" placeholder="Select departure date" style="width:100%;">
        <label>Return Date (optional):</label>
        <input type="date" id="return-date" placeholder="Select return date (optional)" style="width:100%;">
        <button class="btn-warning" onclick="checkOut()">Check Out</button>
      </div>

      <div class="section">
        <h3>History</h3>
        <div id="attendance-history">Loading...</div>
      </div>
    </div>
  `;
}

function getMaxCheckInDate() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return formatDate(d);
}

async function loadAttendancePageData() {
  const userId = window.currentUser.uid;
  const todayDate = today();

  const userDoc = await db.collection('users').doc(userId).get();
  const myStatusEl = document.getElementById('my-status');
  
  if (userDoc.exists) {
    const data = userDoc.data();
    if (data.present) {
      myStatusEl.innerHTML = '<span style="color:var(--success);"><span class="status-dot present"></span> You are currently IN PG</span>';
      document.getElementById('checkin-section').style.display = 'none';
      document.getElementById('checkout-section').style.display = 'block';
    } else {
      myStatusEl.innerHTML = '<span style="color:var(--danger);"><span class="status-dot absent"></span> You are OUT of PG</span>';
      document.getElementById('checkin-section').style.display = 'block';
      document.getElementById('checkout-section').style.display = 'none';
      
      const todayCheckIn = await db.collection('attendance')
        .where('userId', '==', userId)
        .where('checkInDate', '==', todayDate)
        .get();
      
      if (!todayCheckIn.empty) {
        document.getElementById('checkin-btn').style.display = 'none';
        document.getElementById('modify-checkin-btn').style.display = 'block';
      } else {
        document.getElementById('checkin-btn').style.display = 'block';
        document.getElementById('modify-checkin-btn').style.display = 'none';
      }
    }
  } else {
    myStatusEl.innerHTML = '<span style="color:var(--text-secondary);">No record yet</span>';
  }

  const historySnapshot = await db.collection('attendance')
    .where('userId', '==', userId)
    .orderBy('checkInDate', 'desc')
    .limit(10)
    .get();

  const historyEl = document.getElementById('attendance-history');
  if (!historySnapshot.empty) {
    historyEl.innerHTML = historySnapshot.docs.map(doc => {
      const d = doc.data();
      return `
        <div class="list-item">
          <span>In: ${formatDisplayDate(d.checkInDate)}</span>
          <span>Out: ${d.checkOutDate ? formatDisplayDate(d.checkOutDate) : 'Still in PG'}</span>
          ${d.nextCheckInDate ? `<span>Return: ${formatDisplayDate(d.nextCheckInDate)}</span>` : ''}
        </div>
      `;
    }).join('');
  } else {
    historyEl.innerHTML = '<p>No attendance records yet</p>';
  }
}

async function checkIn() {
  const userId = window.currentUser.uid;
  const date = document.getElementById('checkin-date').value;
  const maxDate = getMaxCheckInDate();

  if (!date) { alert('Please select a date'); return; }
  if (date > maxDate) { alert('You can only check in up to 48 hours in advance'); return; }

  const todayCheckIn = await db.collection('attendance')
    .where('userId', '==', userId)
    .where('checkInDate', '==', date)
    .get();

  if (!todayCheckIn.empty) { alert('You already checked in for this date'); return; }

  try {
    await db.collection('attendance').add({
      userId: userId,
      checkInDate: date,
      checkOutDate: null,
      nextCheckInDate: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (date === today()) {
      await db.collection('users').doc(userId).update({ present: true });
    }

    alert('Checked in successfully!');
    loadAttendancePageData();
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

async function modifyCheckIn() {
  const userId = window.currentUser.uid;
  const newDate = document.getElementById('checkin-date').value;
  const maxDate = getMaxCheckInDate();

  if (!newDate) { alert('Please select a date'); return; }
  if (newDate > maxDate) { alert('You can only check in up to 48 hours in advance'); return; }

  try {
    const todayCheckIn = await db.collection('attendance')
      .where('userId', '==', userId)
      .where('checkInDate', '==', today())
      .get();

    if (!todayCheckIn.empty) {
      await todayCheckIn.docs[0].ref.update({ checkInDate: newDate });
      alert('Check-in modified!');
      loadAttendancePageData();
    }
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

async function checkOut() {
  const userId = window.currentUser.uid;
  const checkoutDate = document.getElementById('checkout-date').value;
  const returnDate = document.getElementById('return-date').value;

  if (!checkoutDate) { alert('Please select departure date'); return; }

  try {
    const activeCheckIn = await db.collection('attendance')
      .where('userId', '==', userId)
      .where('checkOutDate', '==', null)
      .orderBy('checkInDate', 'desc')
      .limit(1)
      .get();

    if (!activeCheckIn.empty) {
      const updateData = { checkOutDate: checkoutDate };
      if (returnDate) updateData.nextCheckInDate = returnDate;
      await activeCheckIn.docs[0].ref.update(updateData);
    }

    await db.collection('users').doc(userId).update({ present: false });

    const tomorrowDate = tomorrow();
    const cleaningDoc = await db.collection('cleaningAssignments').doc(tomorrowDate).get();
    if (cleaningDoc.exists && cleaningDoc.data().finalAssignee === userId && !cleaningDoc.data().confirmedAt) {
      await db.collection('cleaningAssignments').doc(tomorrowDate).update({
        finalAssignee: null, finalAssigneeName: null, confirmedAt: null
      });
      const managers = await db.collection('users').where('role', 'in', ['manager', 'po']).get();
      managers.forEach(doc => {
        sendNotification(doc.id, 'Reassignment Needed', `${window.currentUser.name} checked out. Tomorrow's cleaning needs reassignment.`, '/');
      });
    }

    const todayDateObj = new Date();
    const dayOfWeek = todayDateObj.getDay();
    let thursday = new Date(todayDateObj);
    if (dayOfWeek <= 4) { thursday.setDate(todayDateObj.getDate() + (4 - dayOfWeek)); }
    else { thursday.setDate(todayDateObj.getDate() + (11 - dayOfWeek)); }
    const thursdayStr = formatDate(thursday);
    
    const fvDoc = await db.collection('fvAssignments').doc(thursdayStr).get();
    if (fvDoc.exists) {
      const assignees = fvDoc.data().assignees || [];
      if (assignees.find(a => a.userId === userId && a.status !== 'confirmed')) {
        const managers = await db.collection('users').where('role', 'in', ['manager', 'po']).get();
        managers.forEach(doc => {
          sendNotification(doc.id, 'F&V Reassignment', `${window.currentUser.name} checked out. Thursday's F&V needs reassignment.`, '/');
        });
      }
    }

    let wednesday = new Date(todayDateObj);
    if (dayOfWeek <= 3) { wednesday.setDate(todayDateObj.getDate() + (3 - dayOfWeek)); }
    else { wednesday.setDate(todayDateObj.getDate() + (10 - dayOfWeek)); }
    const wednesdayStr = formatDate(wednesday);
    
    const sabhaDoc = await db.collection('weeklySabha').doc(wednesdayStr).get();
    if (sabhaDoc.exists && !sabhaDoc.data().isFinished) {
      const tasks = sabhaDoc.data().tasks || [];
      if (tasks.filter(t => t.assigneeId === userId && t.status === 'pending').length > 0) {
        const config = await getPGConfig();
        if (config?.currentKaryakarId) {
          await sendNotification(config.currentKaryakarId, 'Sabha Task Reassignment', `${window.currentUser.name} checked out. Their sabha tasks need reassignment.`, '/');
        }
      }
    }

    alert('Checked out successfully!');
    loadAttendancePageData();
  } catch (error) {
    alert('Error: ' + error.message);
  }
}