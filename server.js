const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

app.post('/api/send-email', async (req, res) => {
    const { gmailId, appPassword, subject, messageBody, to } = req.body;

    // 1. Connection pool ko hata diya hai, lekin transporter ko simple rakha hai
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailId, pass: appPassword }
    });

    try {
        // 2. HTML ki jagah sirf TEXT bhej rahe hain (Ye spam filter ko 80% kam kar deta hai)
        await transporter.sendMail({
            from: gmailId,
            to: to,
            subject: subject,
            text: messageBody,text, // Sirf plain text, koi HTML nahi
            headers: {
                'X-Priority': '3',
                'X-Mailer': 'Gmail' // Email ko original Gmail client jaisa dikhata hai
            }
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.listen(3000, () => console.log('Server running...'));
