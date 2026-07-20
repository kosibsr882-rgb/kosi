const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

app.post('/api/send-email', async (req, res) => {
    const { gmailId, appPassword, subject, messageBody, to } = req.body;

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailId, pass: appPassword }
    });

    try {
                await transporter.sendMail({
            from: gmailId,
            to: to,
            subject: subject,
            text: messageBody, // Sirf plain text, koi HTML nahi
            headers: {
                'X-Priority': '3',
                'X-Mailer': 'Gmail' //             }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.listen(3000, () => console.log('Server running...'));
