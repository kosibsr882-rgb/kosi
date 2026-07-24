const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'fast-mailer-secret-key-99',
    resave: false,
    saveUninitialized: true
}));

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'kosi123'; // Aap apna password yahan change kar sakte hain

// Auth Middleware
function isAuthenticated(req, res, next) {
    if (req.session && req.session.loggedIn) {
        return next();
    }
    res.redirect('/');
}

// Routes
app.get('/', (req, res) => {
    if (req.session && req.session.loggedIn) {
        return res.sendFile(path.join(__dirname, 'public', 'launcher.html'));
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
        req.session.loggedIn = true;
        return res.json({ success: true });
    }
    res.status(401).json({ success: false, message: 'Invalid username or password' });
});

app.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

app.get('/launcher', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'launcher.html'));
});

// Send Email API with Anti-Spam Headers
app.post('/api/send-email', isAuthenticated, async (req, res) => {
    const { senderName, gmailId, appPassword, subject, messageBody, to } = req.body;

    if (!gmailId || !appPassword || !subject || !messageBody || !to) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: gmailId,
                pass: appPassword
            }
        });

        await transporter.sendMail({
            from: senderName ? `"${senderName}" <${gmailId}>` : `"${gmailId}" <${gmailId}>`,
            to,
            subject,
            html: `<div style="font-family: Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6;">
                <p>${messageBody.replace(/\n/g, '<br>')}</p>
                <br>
                <p style="font-size: 12px; color: #666;">If this is not relevant to you, please feel free to ignore this message.</p>
            </div>`,
            headers: {
                'X-Mailer': 'Microsoft Outlook 16.0',
                'X-Priority': '3'
            }
        });

        res.json({ success: true });
    } catch (err) {
        console.error('Mail Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Fast Mailer on port ${PORT}`);
});
