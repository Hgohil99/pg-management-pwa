function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format date for display (e.g., "5 June 2026")
function formatDisplayDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
}

// Get today's date in YYYY-MM-DD
function today() {
  return formatDate(new Date());
}

// Get tomorrow's date in YYYY-MM-DD
function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatDate(d);
}

// Get day name (e.g., "Monday")
function getDayName(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'long' });
}

// Get current month in YYYY-MM format
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Show/hide loading spinner in an element
function showLoading(elementId) {
  document.getElementById(elementId).innerHTML = '<div class="spinner"></div>';
}

// Show error message
function showError(elementId, message) {
  document.getElementById(elementId).innerHTML = `<p style="color:red;">❌ ${message}</p>`;
}

// Show success message
function showSuccess(elementId, message) {
  document.getElementById(elementId).innerHTML = `<p style="color:green;">✅ ${message}</p>`;
}

// Generate a simple unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}