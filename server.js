import 'dotenv/config';
import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== CONFIGURATION ====================
const CONFIG = {
  PORT: process.env.PORT || 3000,
  SITE_PASSWORD: process.env.SITE_PASSWORD || 'Y##',
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA',
  BATCH_SIZE: 3,
  MAX_SPINTAX_ITERATIONS: 35,
  KEEP_ALIVE_INTERVAL: 4000,
  MIN_BATCH_DELAY: 1800,
  MAX_BATCH_DELAY: 2800,
  MIN_STAGGER_DELAY: 200,
  MAX_STAGGER_DELAY: 350
};

// ==================== STATE MANAGEMENT ====================
const globalSession = { stopRequested: false };
const transporterPool = new Map();

const app = express();

// ==================== MIDDLEWARE ====================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ==================== SENSITIVE WORDS SHIELD ====================
const SENSITIVE_WORDS = [
  'screenshot', 'screenshots', 'report', 'reports', 'seo', 'details',
  'quote', 'quotes', 'information', 'audit', 'ranking', '1st page',
  'first page', 'traffic', 'proposal', 'price', 'pricing', 'guarantee',
  'free', 'deal', 'offer', 'urgent', 'leads', 'cheap', 'cost'
];

function applyKeywordShield(text) {
  if (!text) return '';
  let shielded = String(text);

  SENSITIVE_WORDS.forEach(word => {
    const regex = new RegExp(`\\b(${word})\\b`, 'gi');
    shielded = shielded.replace(regex, (match) => {
      return match.length >= 2 ? match[0] + '&zwnj;' + match.slice(1) : match;
    });
  });

  return shielded;
}

// ==================== TURNSTILE VERIFICATION ====================
async function verifyTurnstileToken(token, remoteIp) {
  if (!token || CONFIG.TURNSTILE_SECRET_KEY.startsWith('1x0000000000000000000000000000000AA')) {
    return true;
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', CONFIG.TURNSTILE_SECRET_KEY);
    formData.append('response', token);
    if (remoteIp) formData.append('remoteip', remoteIp);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
      headers: { 'content-type': 'application/x-www-form-urlencoded' }
    });

    const outcome = await response.json();
    return outcome.success === true;
  } catch (error) {
    console.error('Turnstile verification error:', error.message);
    return false;
  }
}

// ==================== SMTP TRANSPORTER POOL ====================
function getGmailTransporter(email, appPassword) {
  const cleanEmail = email.toLowerCase().trim();
  const cleanPass = appPassword.replace(/\s+/g, '').trim();
  const poolKey = `gmail_pool_${cleanEmail}`;

  if (!transporterPool.has(poolKey)) {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: cleanEmail,
        pass: cleanPass
      },
      pool: true,
      maxConnections: 3,
      maxMessages: 1000,
      socketTimeout: 35000,
      connectionTimeout: 35000
    });

    transporterPool.set(poolKey, transporter);
  }

  return transporterPool.get(poolKey);
}

// ==================== RECIPIENT PARSER ====================
function parseRecipient(input) {
  let email = '';
  let rawName = '';

  if (typeof input === 'object' && input !== null) {
    email = (input.email || input.recipient || '').trim();
    rawName = (input.name || input.fullName || input.first_name || '').trim();
  } else if (typeof input === 'string') {
    const str = input.trim();
    
    // Format: "Name" <email@domain.com>
    const angleMatch = str.match(/^(?:"?([^"]*)"?\s)?<([^>]+)>$/);
    if (angleMatch) {
      rawName = angleMatch[1]?.trim() || '';
      email = angleMatch[2].trim();
    }
    // Format: email@domain.com, Name
    else if (str.includes(',')) {
      const parts = str.split(',');
      if (parts[0].includes('@')) {
        email = parts[0].trim();
        rawName = parts[1].trim();
      } else {
        rawName = parts[0].trim();
        email = parts[1].trim();
      }
    }
    // Plain email
    else {
      email = str;
    }
  }

  // Derive name from email prefix if not provided
  if (!rawName && email.includes('@')) {
    const prefix = email.split('@')[0];
    rawName = prefix.replace(/[0-9_.-]/g, ' ').trim();
  }

  // Format name properly
  const formattedName = rawName
    ? rawName.split(/\s+/).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    : '';

  const firstName = formattedName ? formattedName.split(' ')[0] : '';
  const domain = email.includes('@') ? email.split('@')[1] : '';

  return {
    email: email.toLowerCase(),
    name: formattedName,
    firstName,
    domain
  };
}

// ==================== SPINTAX ENGINE ====================
function parseSpintax(text) {
  if (!text) return '';
  let result = String(text);
  const regex = /\{([^{}]+)\}/s;
  let iterations = 0;

  while (regex.test(result) && iterations < CONFIG.MAX_SPINTAX_ITERATIONS) {
    result = result.replace(regex, (_, choices) => {
      if (!choices.includes('|')) return choices;
      const options = choices.split('|');
      const pick = options[Math.floor(Math.random() * options.length)];
      return pick?.trim() || '';
    });
    iterations++;
  }

  return result.replace(/[\{\}]/g, '').trim();
}

// ==================== CONTENT PERSONALIZATION ====================
function personalizeContent(template, recipient) {
  if (!template) return '';
  
  let content = parseSpintax(template);
  const displayName = recipient.name || recipient.firstName || 'there';
  const displayFirstName = recipient.firstName || displayName;

  const replacements = {
    '{Name}': displayName,
    '{name}': displayName,
    '{FirstName}': displayFirstName,
    '{firstName}': displayFirstName,
    '{First_Name}': displayFirstName,
    '{first_name}': displayFirstName,
    '{Email}': recipient.email,
    '{email}': recipient.email,
    '{Domain}': recipient.domain,
    '{domain}': recipient.domain
  };

  Object.entries(replacements).forEach(([key, value]) => {
    content = content.replace(new RegExp(key, 'g'), value);
  });

  return content;
}

// ==================== HTML TO PLAIN TEXT ====================
function htmlToPlainText(html) {
  if (!html) return '';
  
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&zwnj;/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

// ==================== EMAIL BUILDER ====================
function buildEmailPayload(senderEmail, senderName, recipient, subject, body) {
  const personalizedSubject = personalizeContent(subject, recipient);
  const personalizedBody = personalizeContent(body, recipient);
  const isHtml = /<[a-z][\s\S]*>/i.test(personalizedBody);

  let htmlBody = isHtml ? personalizedBody : personalizedBody.replace(/\n/g, '<br>');
  htmlBody = applyKeywordShield(htmlBody);

  const cleanSenderName = (senderName || '').replace(/["\r\n]/g, '').trim();
  const fromField = cleanSenderName ? `"${cleanSenderName}" <${senderEmail}>` : senderEmail;
  const toField = recipient.name ? `"${recipient.name}" <${recipient.email}>` : recipient.email;

  const formattedHtml = `
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, div, span { font-size: 16.5px !important; font-family: Calibri, 'Segoe UI', Arial, sans-serif !important; line-height: 1.7 !important; }
  </style>
  <div style="margin-top: 18px; line-height: 1.7;">
  <![endif]-->
  <div dir="ltr" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; color: #0f172a; line-height: 1.65; margin-top: 16px; padding-top: 2px;">
    ${htmlBody}
  </div>
  <!--[if mso]>
  </div>
  <![endif]-->`;

  return {
    from: fromField,
    to: toField,
    replyTo: senderEmail,
    date: new Date(),
    subject: personalizedSubject || 'No Subject',
    html: formattedHtml,
    text: `\n\n${htmlToPlainText(personalizedBody)}`,
    textEncoding: 'quoted-printable',
    encoding: 'utf-8'
  };
}

// ==================== STREAM HELPERS ====================
function setupSSEHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
}

function sendSSE(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function sendDone(res) {
  res.write('data: [DONE]\n\n');
}

function getRandomDelay(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}

// ==================== ROUTES ====================

// Home
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Auth
app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  
  if (password === CONFIG.SITE_PASSWORD) {
    return res.json({ success: true, message: 'Authorized' });
  }
  
  return res.status(401).json({ success: false, message: 'Unauthorized Password' });
});

// Verify SMTP
app.post('/api/verify', async (req, res) => {
  const { email, appPassword, cfToken } = req.body;
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!email || !appPassword) {
    return res.status(400).json({ success: false, message: 'Credentials required' });
  }

  if (cfToken) {
    const isHuman = await verifyTurnstileToken(cfToken, clientIp);
    if (!isHuman) {
      return res.status(403).json({ success: false, message: 'Security Verification Failed' });
    }
  }

  try {
    const transporter = getGmailTransporter(email, appPassword);
    await transporter.verify();
    return res.json({ success: true, message: 'SMTP verified successfully' });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || 'SMTP Auth Failed. Check 16-char App Password.'
    });
  }
});

// Send Stream
app.post('/api/send-stream', async (req, res) => {
  setupSSEHeaders(res);

  const { email, appPassword, senderName, subject, messageBody, recipients, cfToken } = req.body;
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // Validation
  if (!email || !appPassword || !Array.isArray(recipients) || recipients.length === 0) {
    sendSSE(res, { success: false, error: 'Invalid Request Data' });
    res.end();
    return;
  }

  // Turnstile check
  if (cfToken) {
    const isHuman = await verifyTurnstileToken(cfToken, clientIp);
    if (!isHuman) {
      sendSSE(res, { success: false, error: 'Turnstile Verification Failed' });
      res.end();
      return;
    }
  }

  const cleanEmail = email.toLowerCase().trim();
  globalSession.stopRequested = false;

  // Keep-alive ping
  const keepAlive = setInterval(() => {
    try { res.write(': keep-alive\n\n'); } catch {}
  }, CONFIG.KEEP_ALIVE_INTERVAL);

  const transporter = getGmailTransporter(email, appPassword);

  try {
    for (let i = 0; i < recipients.length; i += CONFIG.BATCH_SIZE) {
      if (globalSession.stopRequested) {
        sendSSE(res, { success: false, error: 'Stopped by User' });
        break;
      }

      const batch = recipients.slice(i, i + CONFIG.BATCH_SIZE);

      const sendPromises = batch.map(async (rawRecipient, idx) => {
        const recipient = parseRecipient(rawRecipient);
        
        if (!recipient.email) {
          return { success: false, recipient: '', error: 'Invalid Email' };
        }

        try {
          // Micro-stagger inside batch
          if (idx > 0) {
            await new Promise(r => setTimeout(r, getRandomDelay(
              CONFIG.MIN_STAGGER_DELAY, 
              CONFIG.MAX_STAGGER_DELAY
            )));
          }

          const mailOptions = buildEmailPayload(
            cleanEmail, 
            senderName, 
            recipient, 
            subject, 
            messageBody
          );

          await transporter.sendMail(mailOptions);
          
          return { 
            success: true, 
            recipient: recipient.email, 
            name: recipient.name 
          };

        } catch (err) {
          return { 
            success: false, 
            recipient: recipient.email, 
            error: err.message 
          };
        }
      });

      const results = await Promise.allSettled(sendPromises);

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.recipient) {
          sendSSE(res, result.value);
        }
      }

      // Batch delay (except last batch)
      if (i + CONFIG.BATCH_SIZE < recipients.length) {
        await new Promise(r => setTimeout(r, getRandomDelay(
          CONFIG.MIN_BATCH_DELAY, 
          CONFIG.MAX_BATCH_DELAY
        )));
      }
    }
  } catch (error) {
    sendSSE(res, { success: false, error: error.message });
  } finally {
    clearInterval(keepAlive);
    sendDone(res);
    res.end();
  }
});

// Stop
app.post('/api/stop', (req, res) => {
  globalSession.stopRequested = true;
  res.json({ success: true, message: 'Sending process stopped' });
});

// ==================== START SERVER ====================
app.listen(CONFIG.PORT, () => {
  console.log(`🚀 Mailer server running on port ${CONFIG.PORT}`);
});

export default app;
