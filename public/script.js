// Login form handling
const loginForm = document.getElementById('loginForm');
const errorMsg = document.getElementById('errorMsg');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (data.success) {
    window.location.href = '/launcher';
  } else {
    errorMsg.textContent = data.message || 'Invalid credentials!';
  }
});

// Email form handling (only on launcher)
if (document.getElementById('emailForm')) {
  const emailForm = document.getElementById('emailForm');
  const statusMsg = document.getElementById('statusMsg');

  emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusMsg.textContent = 'Sending...';

    const senderName = document.getElementById('senderName').value;
    const gmailId = document.getElementById('gmailId').value;
    const appPassword = document.getElementById('appPassword').value;
    const to = document.getElementById('to').value;
    const subject = document.getElementById('subject').value;
    const messageBody = document.getElementById('messageBody').value;

    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderName, gmailId, appPassword, to, subject, messageBody }),
    });
    const data = await res.json();
    if (data.success) {
      statusMsg.textContent = 'Email sent successfully!';
    } else {
      statusMsg.textContent = 'Error: ' + (data.message || 'Failed to send email.');
    }
  });

  // Logout button
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/logout', { method: 'POST' });
    window.location.href = '/';
  });
}
