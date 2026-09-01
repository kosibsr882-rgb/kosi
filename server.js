import 'dotenv/config';
import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';
import { promisify } from 'util';

const dnsResolveMx = promisify(dns.resolveMx);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== CONFIGURATION ====================
const CONFIG = {
  PORT: process.env.PORT || 3000,
  SITE_PASSWORD: process.env.SITE_PASSWORD || '',
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY || '',
  
  // Reputation-safe rate limiting
  BATCH_SIZE: 1,                    // 1 email at a time for reputation
  DELAY_BETWEEN_EMAILS: 2000,       // 2 seconds gap (respectful)
  DELAY_BETWEEN_BATCHES: 5000,      // 5 seconds between batches
  MAX_DAILY_PER_SENDER: 500,        // Gmail daily limit respect
  
  // Timeouts
  SMTP_TIMEOUT: 30000,
  CONNECTION_TIMEOUT: 30000,
  
  // Domain validation
  VALIDATE_MX_RECORDS: true
};

// ==================== STATE ====================
const globalSession = { stopRequested: false };
const dailySentCount = new Map(); // Track per-sender daily limits
const app = express();

// ==================== MIDDLEWARE ====================
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ==================== EMAIL VALIDATION ====================
async function validateEmail(email) {
  const errors = [];
  
  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push('Invalid email format');
    return { valid: false, errors };
  }
  
  // Check for role-based emails (lower engagement = spam folder)
  const roleEmails = [
    'noreply@', 'no-reply@', 'admin@', 'postmaster@', 
    'webmaster@', 'hostmaster@', 'abuse@', 'info@', 
    'sales@', 'support@', 'contact@', 'marketing@'
  ];
  
  const lowerEmail = email.toLowerCase();
  if (roleEmails.some(role => lowerEmail.startsWith(role))) {
    errors.push('Role-based emails have lower inbox rates');
  }
  
  // Disposable domain check (common list)
  const disposableDomains = [
    'tempmail.com', '10minutemail.com', 'guerrillamail.com',
    'mailinator.com', 'yopmail.com', 'throwawaymail.com'
  ];
  
  const domain = lowerEmail.split('@')[1];
  if (disposableDomains.includes(domain)) {
    errors.push('Disposable email detected');
  }
  
  // MX Record validation
  if (CONFIG.VALIDATE_MX_RECORDS) {
    try {
      const mxRecords = await dnsResolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        errors.push('No MX records found for domain');
      }
    } catch (err) {
      errors.push('Domain MX lookup failed');
    }
  }
  
  return { 
    valid: errors.length === 0, 
    errors,
    domain 
  };
}

// ==================== TURNSTILE VERIFICATION ====================
async function verifyTurnstileToken(token, remoteIp) {
  if (!token || !CONFIG.TURNSTILE_SECRET_KEY) return true;
  
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
    console.error('Turnstile error:', error.message);
    return false;
  }
}

// ==================== SMTP TRANSPORTER ====================
function createTransporter(email, appPassword) {
  const cleanEmail = email.toLowerCase().trim();
  const cleanPass = appPassword.replace(/\s+/g, '').trim();

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: cleanEmail,
      pass: cleanPass
    },
    // NO POOLING for reputation - fresh connection each time
    pool: false,
    socketTimeout: CONFIG.SMTP_TIMEOUT,
    connectionTimeout: CONFIG.CONNECTION_TIMEOUT,
    
    // Proper TLS for reputation
    tls: {
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2'
    }
  });
}

// ==================== RECIPIENT PARSER ====================
function parseRecipient(input) {
  let email = '';
  let name = '';
  let metadata = {};

  if (typeof input === 'object' && input !== null) {
    email = (input.email || input.recipient || '').trim();
    name = (input.name || input.fullName || input.firstName || '').trim();
    metadata = {
      company: input.company || '',
      tags: input.tags || []
    };
  } else if (typeof input === 'string') {
    const str = input.trim();
    const angleMatch = str.match(/^(?:"?([^"]*)"?\s)?<([^>]+)>$/);
    if (angleMatch) {
      name = angleMatch[1]?.trim() || '';
      email = angleMatch[2].trim();
    } else {
      email = str;
    }
  }

  // Format name
  if (name) {
    name = name.split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  } else if (email.includes('@')) {
    const prefix = email.split('@')[0];
    name = prefix.replace(/[0-9_.-]/g, ' ').trim();
    name = name.split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  const firstName = name ? name.split(' ')[0] : '';
  const domain = email.includes('@') ? email.split('@')[1] : '';

  return { email: email.toLowerCase(), name, firstName, domain, metadata };
}

// ==================== CONTENT PERSONALIZATION ====================
function personalizeContent(template, recipient) {
  if (!template) return '';
  
  const displayName = recipient.name || recipient.firstName || 'there';
  const firstName = recipient.firstName || displayName;

  const replacements = {
    '{{name}}': displayName,
    '{{Name}}': displayName,
    '{{firstName}}': firstName,
    '{{FirstName}}': firstName,
    '{{first_name}}': firstName,
    '{{email}}': recipient.email,
    '{{Email}}': recipient.email,
    '{{domain}}': recipient.domain,
    '{{Domain}}': recipient.domain,
    '{{company}}': recipient.metadata.company || ''
  };

  let content = template;
  Object.entries(replacements).forEach(([key, value]) => {
    content = content.split(key).join(value);
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
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

// ==================== EMAIL BUILDER (INBOX OPTIMIZED) ====================
function buildEmailPayload(senderEmail, senderName, recipient, subject, body, options = {}) {
  const personalizedSubject = personalizeContent(subject, recipient);
  const personalizedBody = personalizeContent(body, recipient);
  
  const isHtml = /<[a-z][\s\S]*>/i.test(personalizedBody);
  const cleanSenderName = (senderName || '').replace(/["\r\n]/g, '').trim();
  const fromField = cleanSenderName ? `"${cleanSenderName}" <${senderEmail}>` : senderEmail;
  const toField = recipient.name ? `"${recipient.name}" <${recipient.email}>` : recipient.email;

  // Clean HTML structure (no zero-width chars, no hidden text)
  let htmlContent = isHtml ? personalizedBody : personalizedBody.replace(/\n/g, '<br>');
  
  // Ensure proper HTML document structure
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${personalizedSubject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${htmlContent}
  ${options.unsubscribeUrl ? `
  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
  <p style="font-size: 13px; color: #666;">
    You're receiving this because you subscribed to our updates.<br>
    <a href="${options.unsubscribeUrl}" style="color: #666;">Unsubscribe</a>
  </p>` : ''}
</body>
</html>`;

  const plainText = htmlToPlainText(personalizedBody) + 
    (options.unsubscribeUrl ? `\n\n---\nUnsubscribe: ${options.unsubscribeUrl}` : '');

  // INBOX-OPTIMIZED HEADERS
  const headers = {
    // Prevent auto-replies to bulk
    'Precedence': 'bulk',
    
    // Identify as marketing/newsletter (honest = better reputation)
    'X-Mailer': 'LegitimateMailer/1.0',
    'X-Priority': '3', // Normal priority (1 = high, often spammy)
    
    // Campaign tracking (helps ESPs understand you're legitimate)
    'X-Campaign-ID': options.campaignId || `campaign-${Date.now()}`,
    
    // List management (CRITICAL for inbox delivery)
    'List-ID': options.listId || `<${senderEmail.split('@')[1]}>`,
    
    // Unsubscribe header (REQUIRED by Gmail for bulk)
    ...(options.unsubscribeUrl ? {
      'List-Unsubscribe': `<${options.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    } : {})
  };

  return {
    from: fromField,
    to: toField,
    replyTo: senderEmail,
    subject: personalizedSubject,
    
    // Proper multipart structure (HTML + Text)
    html: fullHtml,
    text: plainText,
    
    // Encoding
    encoding: 'utf-8',
    
    // Custom headers for deliverability
    headers,
    
    // DKIM will be applied automatically by Gmail SMTP
    // But we ensure proper envelope
    envelope: {
      from: senderEmail,
      to: recipient.email
    }
  };
}

// ==================== STREAM HELPERS ====================
function setupSSE(res) {
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== DAILY LIMIT CHECK ====================
function checkDailyLimit(senderEmail) {
  const today = new Date().toISOString().split('T')[0];
  const key = `${senderEmail}:${today}`;
  const current = dailySentCount.get(key) || 0;
  
  if (current >= CONFIG.MAX_DAILY_PER_SENDER) {
    return { allowed: false, sent: current, limit: CONFIG.MAX_DAILY_PER_SENDER };
  }
  
  dailySentCount.set(key, current + 1);
  return { allowed: true, sent: current + 1, limit: CONFIG.MAX_DAILY_PER_SENDER };
}

// ==================== ROUTES ====================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  if (password === CONFIG.SITE_PASSWORD) {
    return res.json({ success: true, message: 'Authorized' });
  }
  return res.status(401).json({ success: false, message: 'Unauthorized' });
});

app.post('/api/verify', async (req, res) => {
  const { email, appPassword, cfToken } = req.body;
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!email || !appPassword) {
    return res.status(400).json({ success: false, message: 'Credentials required' });
  }

  if (cfToken) {
    const isHuman = await verifyTurnstileToken(cfToken, clientIp);
    if (!isHuman) {
      return res.status(403).json({ success: false, message: 'Verification failed' });
    }
  }

  try {
    const transporter = createTransporter(email, appPassword);
    await transporter.verify();
    return res.json({ success: true, message: 'SMTP verified' });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || 'SMTP Auth Failed'
    });
  }
});

// ==================== MAIN SEND ROUTE (REPUTATION SAFE) ====================
app.post('/api/send-stream', async (req, res) => {
  setupSSE(res);

  const { 
    email, 
    appPassword, 
    senderName, 
    subject, 
    messageBody, 
    recipients, 
    cfToken,
    campaignId,
    listId,
    unsubscribeUrl
  } = req.body;

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // Validation
  if (!email || !appPassword || !Array.isArray(recipients) || recipients.length === 0) {
    sendSSE(res, { success: false, error: 'Invalid request data' });
    res.end();
    return;
  }

  // Turnstile
  if (cfToken) {
    const isHuman = await verifyTurnstileToken(cfToken, clientIp);
    if (!isHuman) {
      sendSSE(res, { success: false, error: 'Security check failed' });
      res.end();
      return;
    }
  }

  const cleanEmail = email.toLowerCase().trim();
  globalSession.stopRequested = false;

  // Check daily limit
  const limitCheck = checkDailyLimit(cleanEmail);
  if (!limitCheck.allowed) {
    sendSSE(res, { 
      success: false, 
      error: `Daily limit reached (${limitCheck.sent}/${limitCheck.limit})` 
    });
    res.end();
    return;
  }

  // Keep-alive
  const keepAlive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch {}
  }, 5000);

  const transporter = createTransporter(email, appPassword);
  const results = { sent: 0, failed: 0, errors: [] };

  try {
    for (let i = 0; i < recipients.length; i++) {
      if (globalSession.stopRequested) {
        sendSSE(res, { success: false, error: 'Stopped by user', partial: true });
        break;
      }

      const rawRecipient = recipients[i];
      const recipient = parseRecipient(rawRecipient);

      // Validate email
      const validation = await validateEmail(recipient.email);
      if (!validation.valid) {
        sendSSE(res, { 
          success: false, 
          recipient: recipient.email, 
          error: `Validation failed: ${validation.errors.join(', ')}` 
        });
        results.failed++;
        continue;
      }

      try {
        // Build clean, inbox-optimized email
        const mailOptions = buildEmailPayload(
          cleanEmail,
          senderName,
          recipient,
          subject,
          messageBody,
          { campaignId, listId, unsubscribeUrl }
        );

        const info = await transporter.sendMail(mailOptions);
        
        results.sent++;
        sendSSE(res, { 
          success: true, 
          recipient: recipient.email, 
          name: recipient.name,
          messageId: info.messageId,
          progress: `${i + 1}/${recipients.length}`
        });

      } catch (err) {
        results.failed++;
        results.errors.push({ email: recipient.email, error: err.message });
        sendSSE(res, { 
          success: false, 
          recipient: recipient.email, 
          error: err.message 
        });
      }

      // REPUTATION-SAFE DELAY (not evasion, but respect)
      if (i < recipients.length - 1) {
        await sleep(CONFIG.DELAY_BETWEEN_EMAILS);
      }
    }

    // Final summary
    sendSSE(res, { 
      success: true, 
      summary: true,
      total: recipients.length,
      sent: results.sent,
      failed: results.failed
    });

  } catch (error) {
    sendSSE(res, { success: false, error: error.message });
  } finally {
    clearInterval(keepAlive);
    sendDone(res);
    res.end();
    
    // Close transporter
    try { await transporter.close(); } catch {}
  }
});

app.post('/api/stop', (req, res) => {
  globalSession.stopRequested = true;
  res.json({ success: true, message: 'Stop requested' });
});

app.listen(CONFIG.PORT, () => {
  console.log(`📧 Inbox-Optimized Mailer running on port ${CONFIG.PORT}`);
});

export default app;
