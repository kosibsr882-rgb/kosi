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

async function sendHtml() {
  const payload = {
    senderName: document.getElementById('senderName').value,
    gmailId: document.getElementById('gmailId').value,
    appPassword: document.getElementById('appPassword').value,
    to: document.getElementById('to').value,
    subject: document.getElementById('subject').value,
    htmlBody: document.getElementById('htmlBody').value
  };
  const res = await fetch('/api/send-html', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  });
  const data = await res.json();
  document.getElementById('msg').innerText = data.success ? '✅ HTML Email sent!' : '❌ ' + data.message;
}
