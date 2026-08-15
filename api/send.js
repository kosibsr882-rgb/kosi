const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Only POST allowed' });
  }

  const { gmailId, appPassword, subject, messageBody, recipients } = req.body;

  if (!gmailId || !appPassword || !recipients) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  // transporter setup
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailId, pass: appPassword }
  });

  try {
    // recipients = array of emails
    const info = await transporter.sendMail({
      from: gmailId,
      to: recipients, // array or comma-separated string
      subject,
      text: messageBody
    });

    console.log('✅ Emails sent:', info.accepted);
    res.json({ success: true, sent: info.accepted });
  } catch (err) {
    console.error('❌ Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
