app.post('/api/send-email', requireLogin, async (req, res) => {
  const { senderName, gmailId, appPassword, subject, messageBody, to } = req.body;

  if (!gmailId || !appPassword || !to || !subject || !messageBody) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  // Rate limiting: 1 mail per second
  const now = Date.now();
  if (now - lastSentTime < 1000) {
    return res.status(429).json({ success: false, message: 'Wait 1 second before sending again' });
  }
  lastSentTime = now;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailId, pass: appPassword }
  });

  try {
    await transporter.sendMail({
      from: senderName ? `"${senderName}" <${gmailId}>` : gmailId,
      to,
      subject,
      text: messageBody,
      html: `<div style="font-size:20px; font-family:Arial; color:#222;">
               <strong>${messageBody}</strong>
             </div>`,
      headers: {
        'X-Mailer': 'FastMailer',
        'List-Unsubscribe': '<mailto:unsubscribe@yourdomain.com>'
      }
    });
    res.json({ success: true });
  } catch (err) {
    console.error(`❌ Failed to send to ${to}:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});
