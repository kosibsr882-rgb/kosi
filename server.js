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
    const { gmailId, appPassword, subject, messageBody, to } = req.body;
    
    if (!gmailId || !appPassword || !to || !messageBody) {
        return res.status(400).json({ success: false, message: 'Required fields are missing' });
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
            from: gmailId.trim(),
            to: to.trim(),
            subject: subject || 'No Subject',
            text: messageBody
        });
        res.json({ success: true });
    } catch (err) {
        console.error('SMTP Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
