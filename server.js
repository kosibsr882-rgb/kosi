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
  secret: process.env.SESSION_SECRET || 'fast-mailer-secret',
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
  if (req.session?.loggedIn) return res.redirect('/launcher.html');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    req.session.loggedIn = true;
    return res.json({ success: true });
  }
  res.json({ success: false, message: 'Invalid username or password' });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// ✅ Bulk 25 recipients route
app.post('/api/send-25', requireLogin, async (req, res) => {
  const { senderName, subject, messageBody, recipients } = req.body;

  if (!process.env.GMAIL_ID || !process.env.GMAIL_PASS || !recipients?.length)
    return res.status(400).json({ success: false, message: 'Missing fields' });

  if (recipients.length > 25)
    return res.status(400).json({ success: false, message: 'Max 25 recipients allowed per request' });

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_ID, pass: process.env.GMAIL_PASS }
  });

  let results = [];
  for (let to of recipients) {
    try {
      await transporter.sendMail({
        from: senderName ? `"${senderName}" <${process.env.GMAIL_ID}>` : `"${process.env.GMAIL_ID}" <${process.env.GMAIL_ID}>`,
        to,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; font-size:16px;">
            <p><b style="font-size:18px;">Hi ${to},</b></p>
            <p><b style="font-size:16px;">${messageBody}</b></p>
            <p>Regards,<br><b>${senderName || process.env.GMAIL_ID}</b></p>
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

app.listen(PORT, () => console.log(`🚀 Fast Mailer running on port ${PORT}`));
