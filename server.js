// server.js
const express    = require('express');
const session    = require('express-session');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path       = require('path');
const { createCanvas } = require('canvas');
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

// Helper: generate parchment-style image with Bell MT font and wrapping
function generateImage(text) {
  const width = 800, height = 600;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background parchment color
  ctx.fillStyle = '#f5deb3';
  ctx.fillRect(0, 0, width, height);

  // Text style: Bold + Bell MT + Medium size
  ctx.font = 'bold 30px "Bell MT"';
  ctx.fillStyle = '#222';

  // Word wrapping
  const words = text.split(' ');
  let line = '';
  let y = 100;
  const lineHeight = 40;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > width - 100 && n > 0) {
      ctx.fillText(line, 50, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, 50, y);

  return canvas.toBuffer('image/png');
}

// API: send 20 mails to 20 recipients with image body
app.post('/api/send-20-emails', requireLogin, async (req, res) => {
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
          const imageBuffer = generateImage(messageBody);

          await transporter.sendMail({
            from: senderName ? `"${senderName}" <${gmailId}>` : gmailId,
            to,
            subject,
            html: `<p>See attached letter:</p><img src="cid:letterimg${index}"/>`,
            attachments: [{
              filename: `letter${index+1}.png`,
              content: imageBuffer,
              cid: `letterimg${index}`
            }]
          });
          console.log(`✅ Mail ${index+1} sent to ${to}`);
          resolve({ to, success: true });
        } catch (err) {
          console.error(`❌ Mail ${index+1} failed to ${to}:`, err.message);
          resolve({ to, success: false, error: err.message });
        }
      }, index * 1000); // 1 second gap
    });
  }

  const results = await Promise.all(recipients.map((to, i) => sendWithDelay(to, i)));

  res.json({ success: true, results });
});

app.listen(PORT, () => console.log(`🚀 Fast Mailer running on port ${PORT}`));
