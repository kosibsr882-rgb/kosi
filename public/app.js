// Handle login
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const emailForm = document.getElementById('emailForm');
  const logoutBtn = document.getElementById('logoutBtn');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(loginForm);
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(formData))
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = '/launcher';
      } else {
        document.getElementById('loginMessage').textContent = data.message;
      }
    });
  }

  if (emailForm) {
    emailForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(emailForm);
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(formData))
      });
      const data = await res.json();
      document.getElementById('emailMessage').textContent = data.success
        ? '✅ Email sent successfully!'
        : `❌ Error: ${data.message}`;
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await fetch('/logout', { method: 'POST' });
      window.location.href = '/';
    });
  }
});
