const express = require('express');
const session = require('express-session');
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'super-secret-key-2026',
    resave: false,
    saveUninitialized: false
}));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === (process.env.ADMIN_USER || 'admin') && password === (process.env.ADMIN_PASS || 'admin123')) {
        req.session.loggedIn = true;
        return res.json({ success: true });
    }
    res.json({ success: false });
});

app.post('/api/send-email', async (req, res) => {
    if (!req.session.loggedIn) return res.status(401).send();
    const { senderName, gmailId, appPassword, subject, messageBody, to } = req.body;
    
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailId, pass: appPassword },
        pool: true // Spam-protection feature
    });

    try {
        await transporter.sendMail({
            from: `"${senderName}" <${gmailId}>`,
            to, subject, html: messageBody,
            headers: { 'List-Unsubscribe': `<mailto:${gmailId}>`, 'Precedence': 'bulk' }
        });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.listen(PORT, () => console.log(`🚀 Fast Mailer running on port ${PORT}`));
