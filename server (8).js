const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'fast-mailer-secret-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(express.static(path.join(__dirname, 'public')));

const requireLogin = (req, res, next) => {
    if (req.session?.loggedIn) return next();
    res.redirect('/');
};

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/launcher', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'launcher.html')));

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === (process.env.ADMIN_USER || 'admin') && password === (process.env.ADMIN_PASS || 'admin123')) {
        req.session.loggedIn = true;
        return res.json({ success: true });
    }
    res.json({ success: false, message: 'Invalid credentials' });
});

app.post('/api/send-email', requireLogin, async (req, res) => {
    const { senderName, gmailId, appPassword, subject, messageBody, to } = req.body;

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailId, pass: appPassword }
    });

    try {
        // Spam protection headers
        await transporter.sendMail({
            from: `"${senderName}" <${gmailId}>`,
            to: to,
            subject: subject,
            html: messageBody, // Quill HTML support
            headers: {
                'X-Mailer': 'Nodemailer',
                'Precedence': 'list', // Personal touch
                'X-Priority': '3 (Normal)',
                'List-Unsubscribe': `<mailto:${gmailId}?subject=unsubscribe>` 
            }
        });
        res.json({ success: true });
    } catch (err) {
        console.error('SMTP Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to send' });
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
