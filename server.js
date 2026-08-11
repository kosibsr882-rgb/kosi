const express    = require('express');
const session    = require('express-session');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path       = require('path');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'fast-mailer-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(express.static(path.join(__dirname, 'public')));

function requireLogin(req, res, next) {
  if (req.session?.loggedIn) return next();
  res.redirect('/');
}

app.get('/', (req, res) => {
  if (req.session?.loggedIn) return res.redirect('/launcher');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/launcher', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'launcher.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const validUser = process.env.ADMIN_USER || 'admin';
  const validPass = process.env.ADMIN_PASS || 'admin123';
  if (username === validUser && password === validPass) {
    req.session.loggedIn = true;
    return res.json({ success: true });
  }
  res.json({ success: false, message: 'Invalid username or password' });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// ✅ Plain text email route
app.post('/api/send-email', requireLogin, async (req, res) => {
  const { senderName, gmailId, appPassword, subject, messageBody, to } = req.body;
  if (!gmailId || !appPassword || !to)
    return res.status(400).json({ success: false, message: 'Missing fields' });

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailId, pass: appPassword }
  });

  try {
    await transporter.sendMail({
      from: senderName ? `"${senderName}" <${gmailId}>` : `"${gmailId}" <${gmailId}>`,
      to,
      subject,
      text: messageBody
    });
    res.json({ success: true });
  } catch (err) {
    console.error(`❌ ${to}:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ HTML email route (bold + large font)
app.post('/api/send-html', requireLogin, async (req, res) => {
  const { senderName, gmailId, appPassword, subject, htmlBody, to } = req.body;

  if (!gmailId || !appPassword || !to || !htmlBody)
    return res.status(400).json({ success: false, message: 'Missing fields' });

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailId, pass: appPassword }
  });

  try {
    await transporter.sendMail({
      from: senderName ? `"${senderName}" <${gmailId}>` : `"${gmailId}" <${gmailId}>`,
      to,
      subject,
      html: `
        <div style="font-family: Bell MT; font-size:18px;">
          <p><b style="font-size:20px;">${htmlBody}</b></p>
        </div>
      `
    });
    res.json({ success: true });
  } catch (err) {
    console.error(`❌ ${to}:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ Bulk 25 recipients route
app.post('/api/send-25', requireLogin, async (req, res) => {
  const { senderName, gmailId, appPassword, subject, messageBody, recipients } = req.body;

  if (!gmailId || !appPassword || !recipients?.length)
    return res.status(400).json({ success: false, message: 'Missing fields' });

  if (recipients.length > 25)
    return res.status(400).json({ success: false, message: 'Max 25 recipients allowed per request' });

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailId, pass: appPassword }
  });

  let results = [];
  for (let to of recipients) {
    try {
      await transporter.sendMail({
        from: senderName ? `"${senderName}" <${gmailId}>` : `"${gmailId}" <${gmailId}>`,
        to,
        subject,
        html: `
          <div style="font-family: Bell MT; font-size:18px;">
            <p><b style="font-size:20px;">Hi ${to},</b></p>
            <p><b style="font-size:18px;">${messageBody}</b></p>
            <p>Regards,<br><b>${senderName || gmailId}</b></p>
          </div>
        `
      });
      results.push({ to, success: true });
    } catch (err) {
      console.error(`❌ ${to}:`, err.message);
      results.push({ to, success: false, error: err.message });
    }
    await new Promise(r => setTimeout(r, 1000)); // 1 sec gap
  }

  res.json({ success: true, results });
});

app.listen(PORT, () => console.log(`🚀 Fast Mailer on port ${PORT}`));
