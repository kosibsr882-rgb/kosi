const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Only POST allowed' });
  }

  const { gmailId, appPassword, subject, messageBody, recipients } = req.body;

  if (!gmailId || !appPassword || !recipients) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailId, pass: appPassword }
  });

  try {
    const info = await transporter.sendMail({
      from: gmailId,
      to: recipients, // array of emails (up to 25)
      subject,
      text: messageBody
    });

    res.json({ success: true, sent: info.accepted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
