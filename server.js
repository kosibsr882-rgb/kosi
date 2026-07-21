const express    = require('express');
const session    = require('express-session');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path       = require('path');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));

// Session Setup for Login Protection
app.use(session({
  secret: process.env.SESSION_SECRET || 'fast-mailer-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 8 } // 8 hours session
}));

app.use(express.static(path.join(__dirname, 'public')));

// Middleware to check authentication
function requireLogin(req, res, next) {
  if (req.session?.loggedIn) return next();
  res.redirect('/');
}

// 1. Root route - Agar logged in hai toh launcher par, nahi toh login.html par bhejega
app.get('/', (req, res) => {
  if (req.session?.loggedIn) return res.redirect('/launcher');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 2. Protected Launcher Route
app.get('/launcher', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'launcher.html'));
});

// 3. Login Action
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

// 4. Logout Action
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// 5. Send Email API (Only accessible after Login)
app.post('/api/send-email', requireLogin, async (req, res) => {
  const { senderName, gmailId, appPassword, subject, messageBody, to } = req.body;

  if (!gmailId || !appPassword || !to || !messageBody) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailId.trim(),
      pass: appPassword.trim()
    }
  });

  try {
    await transporter.sendMail({
      from: senderName ? `"${senderName.trim()}" <${gmailId.trim()}>` : gmailId.trim(),
      to: to.trim(),
      subject: subject ? subject.trim() : 'Notification',
      text: messageBody
    });
    res.json({ success: true });
  } catch (err) {
    console.error(`❌ SMTP Error (${to}):`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Protected Mailer running on port ${PORT}`));
