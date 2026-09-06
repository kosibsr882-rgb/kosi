document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const mailerSection = document.getElementById('mailerSection');
  const addAccountBtn = document.getElementById('addAccountBtn');
  const accountsContainer = document.getElementById('accountsContainer');
  const verifyBtn = document.getElementById('verifyBtn');
  const sendBtn = document.getElementById('sendBtn');
  const stopBtn = document.getElementById('stopBtn');
  const logsContainer = document.getElementById('logsContainer');

  // Auth Handling
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('sitePassword').value;
      
      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();
        
        if (data.success) {
          document.getElementById('authOverlay').style.display = 'none';
          if (mailerSection) mailerSection.style.display = 'block';
        } else {
          alert('Incorrect Password!');
        }
      } catch (err) {
        alert('Authentication error occurred.');
      }
    });
  }

  // Dynamic Add Account Row
  if (addAccountBtn) {
    addAccountBtn.addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'account-row';
      row.innerHTML = `
        <input type="email" placeholder="sender@gmail.com" class="acc-email" required>
        <input type="password" placeholder="16-Char App Password" class="acc-pass" required>
        <input type="text" placeholder="Sender Name (Optional)" class="acc-name">
        <button type="button" class="remove-btn">✕</button>
      `;
      
      row.querySelector('.remove-btn').addEventListener('click', () => {
        row.remove();
      });

      accountsContainer.appendChild(row);
    });
  }

  // Helper to gather all input accounts
  function getAccountsList() {
    const rows = accountsContainer.querySelectorAll('.account-row');
    const accounts = [];
    rows.forEach(row => {
      const email = row.querySelector('.acc-email').value.trim();
      const appPassword = row.querySelector('.acc-pass').value.trim();
      const senderName = row.querySelector('.acc-name').value.trim();
      if (email && appPassword) {
        accounts.push({ email, appPassword, senderName });
      }
    });
    return accounts;
  }

  // Verify All SMTP Accounts
  if (verifyBtn) {
    verifyBtn.addEventListener('click', async () => {
      const accounts = getAccountsList();
      if (accounts.length === 0) {
        alert('Please fill at least one Gmail account and App Password.');
        return;
      }

      let cfToken = '';
      if (typeof turnstile !== 'undefined') {
        try { cfToken = turnstile.getResponse(); } catch(e) {}
      }

      verifyBtn.textContent = 'Verifying All...';
      try {
        const res = await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accounts, cfToken })
        });
        const data = await res.json();
        if (data.success) {
          alert('✅ All SMTP Accounts Verified Successfully!');
        } else {
          alert('❌ Verification Failed: ' + data.message);
        }
      } catch (err) {
        alert('Verification request failed.');
      } finally {
        verifyBtn.textContent = 'Verify All Accounts';
      }
    });
  }

  // Send Streaming Handler with Multi-Account Rotation
  if (sendBtn) {
    sendBtn.addEventListener('click', async () => {
      const accounts = getAccountsList();
      const subject = document.getElementById('subject').value;
      const messageBody = document.getElementById('messageBody').value;
      const recipientsRaw = document.getElementById('recipients').value;

      if (accounts.length === 0) {
        alert('Please add at least one sender Gmail account.');
        return;
      }

      const recipients = recipientsRaw
        .split('\n')
        .map(r => r.trim())
        .filter(r => r.length > 0);

      if (recipients.length === 0) {
        alert('Please add valid recipients.');
        return;
      }

      if (logsContainer) logsContainer.innerHTML = '';
      sendBtn.style.display = 'none';
      if (stopBtn) stopBtn.style.display = 'inline-block';

      let cfToken = '';
      if (typeof turnstile !== 'undefined') {
        try { cfToken = turnstile.getResponse(); } catch(e) {}
      }

      try {
        const response = await fetch('/api/send-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accounts,
            subject,
            messageBody,
            recipients,
            cfToken
          })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const payload = line.replace('data: ', '').trim();
              if (payload === '[DONE]') break;

              try {
                const data = JSON.parse(payload);
                const logItem = document.createElement('div');
                logItem.className = data.success ? 'log-success' : 'log-error';
                
                if (data.success) {
                  logItem.textContent = `[Sent via ${data.sender}] ➔ ${data.recipient}`;
                } else {
                  logItem.textContent = `[Failed] ${data.recipient || 'Unknown'} - ${data.error}`;
                }

                if (logsContainer) {
                  logsContainer.appendChild(logItem);
                  logsContainer.scrollTop = logsContainer.scrollHeight;
                }
              } catch (e) {}
            }
          }
        }
      } catch (err) {
        alert('Streaming connection interrupted.');
      } finally {
        sendBtn.style.display = 'inline-block';
        if (stopBtn) stopBtn.style.display = 'none';
      }
    });
  }

  // Stop Handler
  if (stopBtn) {
    stopBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/stop', { method: 'POST' });
        if (logsContainer) {
          const stopItem = document.createElement('div');
          stopItem.style.color = 'orange';
          stopItem.textContent = '⚠️ Sending stopped by user.';
          logsContainer.appendChild(stopItem);
        }
      } catch (e) {}
      sendBtn.style.display = 'inline-block';
      stopBtn.style.display = 'none';
    });
  }
});
