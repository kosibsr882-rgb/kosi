async function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const res = await fetch('/login', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({username,password})
  });
  const data = await res.json();
  if(data.success) {
    window.location.href='/launcher.html';
  } else {
    document.getElementById('msg').innerText = data.message;
  }
}

async function send25() {
  const recipients = document.getElementById('recipients').value.split(',').map(r => r.trim());
  const payload = {
    senderName: document.getElementById('senderName').value,
    gmailId: document.getElementById('gmailId').value,
    appPassword: document.getElementById('appPassword').value,
    subject: document.getElementById('subject').value,
    messageBody: document.getElementById('messageBody').value,
    recipients
  };
  const res = await fetch('/api/send-25', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  });
  const data = await res.json();
  document.getElementById('msg').innerText = data.success ? '✅ Sent to all!' : '❌ ' + data.message;
}
