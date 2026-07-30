<!DOCTYPE html>
<html>
<head>
  <title>Fast Mailer - Bulk Launcher</title>
  <link rel="stylesheet" href="style.css">
  <style>
    body { font-family: Arial, sans-serif; background:#f4f4f4; }
    .container { width:500px; margin:50px auto; background:#fff; padding:20px; border-radius:8px; box-shadow:0 0 10px rgba(0,0,0,0.1); }
    h2 { text-align:center; font-size:28px; font-weight:bold; }
    input, textarea, button { width:100%; padding:12px; margin:10px 0; border:1px solid #ccc; border-radius:5px; font-size:16px; }
    button { background:#007bff; color:#fff; font-size:18px; font-weight:bold; cursor:pointer; }
    button:hover { background:#0056b3; }
    #progressBar { width:100%; background:#ddd; border-radius:5px; margin-top:15px; }
    #progressBar div { height:20px; width:0%; background:#28a745; border-radius:5px; text-align:center; color:#fff; font-size:12px; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Send Bulk Email</h2>
    <form id="bulkEmailForm">
      <input type="text" name="senderName" placeholder="Sender Name">
      <input type="email" name="gmailId" placeholder="Your Gmail ID" required>
      <input type="password" name="appPassword" placeholder="App Password" required>
      <input type="text" name="subject" placeholder="Subject" required>
      <textarea name="messageBody" placeholder="Message" rows="5" required></textarea>
      <textarea name="recipients" placeholder="Enter recipient emails separated by commas" rows="5" required></textarea>
      <button type="submit">Send Bulk Email</button>
    </form>
    <button id="logoutBtn">Logout</button>
    <div id="progressBar"><div></div></div>
    <p id="bulkMessage"></p>
    <ul id="statusList"></ul>
  </div>

  <script>
    const bulkForm = document.getElementById('bulkEmailForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const progressBar = document.querySelector('#progressBar div');
    const statusList = document.getElementById('statusList');

    bulkForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      statusList.innerHTML = '';
      progressBar.style.width = '0%';
      progressBar.textContent = '';

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
      if (data.success) {
        data.results.forEach((r, i) => {
          const li = document.createElement('li');
          li.textContent = r.success ? `✅ Sent to ${r.to}` : `❌ Failed to ${r.to}: ${r.error}`;
          statusList.appendChild(li);
          const percent = Math.round(((i+1)/data.results.length)*100);
          progressBar.style.width = percent + '%';
          progressBar.textContent = percent + '%';
        });
        document.getElementById('bulkMessage').textContent = 'Bulk emails processed!';
      } else {
        document.getElementById('bulkMessage').textContent = 'Error sending bulk emails';
      }
    });

    logoutBtn.addEventListener('click', async () => {
      await fetch('/logout', { method: 'POST' });
      window.location.href = '/';
    });
  </script>
</body>
</html>
