document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const mailerSection = document.getElementById('mailerSection');
  const sendBtn = document.getElementById('sendBtn');
  const stopBtn = document.getElementById('stopBtn');
  const verifyBtn = document.getElementById('verifyBtn');
  const logsContainer = document.getElementById('logsContainer');
  
  const statusCounts = {
    total: 0,
    success: 0,
    failed: 0
  };

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

  // SMTP Verify Handler
  if (verifyBtn) {
    verifyBtn.addEventListener('click', async () => {
      const email = document.getElementById('senderEmail').value;
      const appPassword = document.getElementById('appPassword').value;
      let cfToken = '';
      
      if (typeof turnstile !== 'undefined') {
        try { cfToken = turnstile.getResponse(); } catch(e) {}
      }

      if (!email || !appPassword) {
        alert('Please enter Gmail and App Password first.');
        return;
      }

      verifyBtn.textContent = 'Verifying...';
      try {
        const res = await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, appPassword, cfToken })
        });
        const data = await res.json();
        if (data.success) {
          alert('✅ SMTP Verified Successfully!');
        } else {
          alert('❌ Verification Failed: ' + data.message);
        }
      } catch (err) {
        alert('Verification request failed.');
      } finally {
        verifyBtn.textContent = 'Verify SMTP';
      }
    });
  }

  // Send Streaming Handler
  if (sendBtn) {
    sendBtn.addEventListener('click', async () => {
      const email = document.getElementById('senderEmail').value;
      const appPassword = document.getElementById('appPassword').value;
      const senderName = document.getElementById('senderName').value;
      const subject = document.getElementById('subject').value;
      const messageBody = document.getElementById('messageBody').value;
      const recipientsRaw = document.getElementById('recipients').value;

      if (!email || !appPassword || !recipientsRaw) {
        alert('Please fill in all mandatory fields.');
        return;
      }

      const recipients = recipientsRaw
        .split('\n')
        .map(r => r.trim())
        .filter(r => r.length > 0);

      if (recipients.length === 0) {
        alert('No valid recipients found.');
        return;
      }

      statusCounts.total = recipients.length;
      statusCounts.success = 0;
      statusCounts.failed = 0;
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
            email,
            appPassword,
            senderName,
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
          buffer = lines.pop(); // Keep unfinished chunk

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const payload = line.replace('data: ', '').trim();
              if (payload === '[DONE]') break;

              try {
                const data = JSON.parse(payload);
                const logItem = document.createElement('div');
                logItem.className = data.success ? 'log-success' : 'log-error';
                
                if (data.success) {
                  statusCounts.success++;
                  logItem.textContent = `[Sent] ${data.recipient}`;
                } else {
                  statusCounts.failed++;
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
