import 'dotenv/config';
import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_PASSWORD = process.env.SITE_PASSWORD || 'Y##';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============== HELPERS ==============

function parseRecipient(input) {
  let email = '', name = '';
  
  if (typeof input === 'object' && input) {
    email = (input.email || input.recipient || '').trim();
    name = (input.name || input.firstName || '').trim();
  } else if (typeof input === 'string') {
    const match = input.trim().match(/^(?:"?([^"]*)"?\s)?<([^>]+)>$/);
    if (match) { name = match[1]?.trim() || ''; email = match[2].trim(); }
    else email = input.trim();
  }
  
  if (!name && email.includes('@')) {
    name = email.split('@')[0].replace(/[0-9_.-]/g, ' ');
    name = name.split(/\s+/).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  }
  
  return { 
    email: email.toLowerCase(), 
    name, 
    firstName: name ? name.split(' ')[0] : '',
    domain: email.includes('@') ? email.split('@')[1] : ''
  };
}

function personalize(text, r) {
  if (!text) return '';
  const name = r.name || r.firstName || 'there';
  return text
    .replace(/\{Name\}/gi, name)
    .replace(/\{FirstName\}/gi, r.firstName || name)
    .replace(/\{Email\}/gi, r.email)
    .replace(/\{Domain\}/gi, r.domain);
}

function htmlToText(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function buildMail(sender, senderName, r, subject, body, unsub) {
  const sub = personalize(subject, r);
  const htmlBody = personalize(body, r);
  const from = senderName ? `"${senderName}" <${sender}>` : sender;
  const to = r.name ? `"${r.name}" <${r.email}>` : r.email;
  
  const html = `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:600px;margin:0 auto;padding:20px;">
${htmlBody}
${unsub ? `<hr style="border:none;border-top:1px solid #e0e0e0;margin:30px 0;">
<p style="font-size:13px;color:#666;"><a href="${unsub}">Unsubscribe</a></p>` : ''}
</body></html>`;

  return {
    from, to, replyTo: sender,
    subject: sub || 'No Subject',
    html, text: htmlToText(htmlBody),
    headers: {
      'Precedence': 'bulk',
      'List-ID': `<${sender.split('@')[1]}>`,
      ...(unsub ? {
        'List-Unsubscribe': `<${unsub}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      } : {})
    }
  };
}

// ============== ROUTES ==============

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  res.json({ success: password === SITE_PASSWORD });
});

app.post('/api/verify', async (req, res) => {
  const { email, appPassword } = req.body;
  if (!email || !appPassword) return res.status(400).json({ success: false, message: 'Credentials required' });
  
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 587, secure: false, requireTLS: true,
      auth: { user: email.toLowerCase().trim(), pass: appPassword.replace(/\s/g, '') }
    });
    await transporter.verify();
    res.json({ success: true, message: 'SMTP verified' });
  } catch (err) {
    res.status(401).json({ success: false, message: err.message });
  }
});

app.post('/api/send-stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const { email, appPassword, senderName, subject, messageBody, recipients, unsubscribeUrl } = req.body;
  if (!email || !appPassword || !Array.isArray(recipients) || !recipients.length) {
    res.write(`data: ${JSON.stringify({ error: 'Invalid data' })}\n\n`);
    return res.end();
  }

  const sender = email.toLowerCase().trim();
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 587, secure: false, requireTLS: true,
    auth: { user: sender, pass: appPassword.replace(/\s/g, '') },
    pool: false
  });

  const keepAlive = setInterval(() => res.write(': ping\n\n'), 5000);

  for (let i = 0; i < recipients.length; i++) {
    const r = parseRecipient(recipients[i]);
    if (!r.email) {
      res.write(`data: ${JSON.stringify({ success: false, recipient: '', error: 'Invalid email' })}\n\n`);
      continue;
    }

    try {
      const mail = buildMail(sender, senderName, r, subject, messageBody, unsubscribeUrl);
      await transporter.sendMail(mail);
      res.write(`data: ${JSON.stringify({ success: true, recipient: r.email, name: r.name })}\n\n`);
    } catch (err) {
      res.write(`data: ${JSON.stringify({ success: false, recipient: r.email, error: err.message })}\n\n`);
    }

    if (i < recipients.length - 1) await new Promise(r => setTimeout(r, 2000));
  }

  clearInterval(keepAlive);
  res.write('data: [DONE]\n\n');
  res.end();
  transporter.close();
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
