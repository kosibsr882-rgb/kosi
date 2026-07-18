const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(bodyParser.json({ limit: '500kb' })); 
app.use(bodyParser.urlencoded({ extended: true, limit: '500kb' }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'secure-random-string-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', 
        httpOnly: true, 
        maxAge: 1000 * 60 * 60 * 2 
    }
}));

app.use(express.static(path.join(__dirname, 'public')));

// Authentication
const requireLogin = (req, res, next) => {
    req.session?.loggedIn ? next() : res.redirect('/');
};

app.get('/', (req, res) => req.session?.loggedIn ? res.redirect('/launcher') : res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/launcher', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'launcher.html')));

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === (process.env.ADMIN_USER || 'admin') && password === (process.env.ADMIN_PASS || 'admin123')) {
        req.session.loggedIn = true;
        return res.json({ success: true });
    }
    res.status(401).json({ success: false, message: 'Unauthorized' });
});

app.post('/api/send-email', requireLogin, async (req, res) => {
    const { senderName, gmailId, appPassword, subject, messageBody, to } = req.body;

    if (!gmailId || !appPassword || !to) return res.status(400).json({ success: false });

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailId, pass: appPassword },
        pool: true // Connection pool enable kiya taki spam filter kam ho
    });

    try {
        // Spam-reducing headers
        await transporter.sendMail({
            from: `"${senderName || 'Notification'}" <${gmailId}>`,
            to: to,
            subject: subject,
            html: messageBody,
            headers: {
                'X-Mailer': 'Modern-Mailer-v2',
                'Precedence': 'bulk',
                'List-Unsubscribe': `<mailto:${gmailId}>`
            }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'SMTP Error' });
    }
});

app.listen(PORT, () => console.log(`🚀 Server active on port ${PORT}`));
