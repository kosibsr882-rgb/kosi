document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const bulkForm = document.getElementById('bulkEmailForm');
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

  if (bulkForm) {
    bulkForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(bulkForm);
      const recipients = formData.get('recipients').split(',').map(r => r.trim());

      const payload = {
        senderName: formData.get('senderName'),
        gmailId: formData.get('gmailId'),
        appPassword: formData.get('appPassword'),
        subject: formData.get('subject'),
        messageBody: formData.get('messageBody'),
        recipients
      };

      const res = await fetch('/api/send-bulk-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      const progressBar = document
