const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/send-email', async (req, res) => {
    const { senderName, gmailId, appPassword, subject, messageBody, to } = req.body;
    
    if (!gmailId || !appPassword || !to || !messageBody) {
        return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
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
        console.error('SMTP Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Official Mailer Service running on port ${PORT}`));
