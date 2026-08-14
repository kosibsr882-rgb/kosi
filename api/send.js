// api/send.js
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { senderName, gmailId, appPassword, subject, messageBody, recipients } = req.body;

  if (!gmailId || !appPassword || !recipients || !subject || !messageBody) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailId, pass: appPassword }
  });

  try {
    const results = await Promise.all(
      recipients.map(async (to) => {
        try {
          await transporter.sendMail({
            from: senderName ? `"${senderName}" <${gmailId}>` : gmailId,
            to,
            subject,
            html: `
              <div style="background-color:#f5deb3; padding:40px; font-family:'Bell MT', serif; font-size:40px; font-weight:bold; color:#222; line-height:1.6;">
                ${messageBody.replace(/\n/g, '<br>')}
              </div>
            `
          });
          return { to, success: true };
        } catch (err) {
          return { to, success: false, error: err.message };
        }
      })
    );

    return res.status(200).json({ success: true, results });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
