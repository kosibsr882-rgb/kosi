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
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    return res.json({ success: true });
  });
});

function randomTag() {
  return Math.random().toString(36).substring(2, 6);
}

const phrases = [
  "Hope you're doing well!",
  "Wishing you a productive day!",
  "Just reaching out with this quick note.",
  "Sharing this update with you.",
  "Here’s something important for you.",
  "Glad to connect with you today.",
  "Sending this message with best regards.",
  "Hope this finds you in good health.",
  "A quick update for your attention.",
  "Please take a moment to read this."
];

app.post('/api/send-25-emails', requireLogin, async (req, res) => {
  const { senderName, gmailId, appPassword, subject, messageBody, recipients } = req.body;

  if (!gmailId || !appPassword || !recipients || !subject || !messageBody) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailId, pass: appPassword }
  });

  async function sendWithDelay(to, index) {
    return new Promise(resolve => {
      setTimeout(async () => {
        try {
          const variation = phrases[index % phrases.length];
          const finalSubject = `${subject} [${randomTag()}]`;
          const finalBody = `${variation}\n\n${messageBody}`;

          await transporter.sendMail({
            from: senderName ? `"${senderName}" <${gmailId}>` : gmailId,
            to,
            subject: finalSubject,
            text: finalBody,
            html: `<div style="font-size:18px; font-family:Arial; color:#222;">
                     <p>${variation}</p>
                     <p>${messageBody}</p>
                   </div>`
          });
          console.log(`✅ Mail ${index+1} sent to ${to}`);
          resolve({ to, success: true });
        } catch (err) {
          console.error(`❌ Mail ${index+1} failed to ${to}:`, err.message);
          resolve({ to, success: false, error: err.message });
        }
      }, index * 1000); 
    });
  }

  const results = await Promise.all(recipients.map((to, i) => sendWithDelay(to, i)));

  res.json({ success: true, results });
});

app.listen(PORT, () => console.log(`🚀 Fast Mailer running on port ${PORT}`));
