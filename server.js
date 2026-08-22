import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import nodemailer from "nodemailer";
import path from "path";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "fast-mailer-secret-2026",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(express.static(path.join(process.cwd(), "public")));

function requireLogin(req, res, next) {
  if (req.session?.loggedIn) return next();
  res.redirect("/");
}

app.get("/", (req, res) => {
  if (req.session?.loggedIn) return res.redirect("/launcher");
  res.sendFile(path.join(process.cwd(), "public", "login.html"));
});

app.get("/launcher", requireLogin, (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "launcher.html"));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const validUser = process.env.ADMIN_USER || "admin";
  const validPass = process.env.ADMIN_PASS || "admin123";
  if (username === validUser && password === validPass) {
    req.session.loggedIn = true;
    return res.json({ success: true });
  }
  res.json({ success: false, message: "Invalid username or password" });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.post("/api/send-email", requireLogin, async (req, res) => {
  const { senderName, gmailId, appPassword, subject, messageBody, to } = req.body;
  if (!gmailId || !appPassword || !to)
    return res.status(400).json({ success: false, message: "Missing fields" });

  const transporter = nodemailer.createTransport({
    service: "gmail",
    pool: true,
    maxConnections: 2,
    maxMessages: 30,
    rateDelta: 3000, // 3s delay per mail
    auth: { user: gmailId, pass: appPassword }
  });

  try {
    await transporter.sendMail({
      from: senderName ? `"${senderName}" <${gmailId}>` : gmailId,
      to,
      subject,
      text: messageBody,
      // Plain text + clean headers = personal mail feel
      headers: {
        "List-Unsubscribe": `<mailto:${gmailId}?subject=unsubscribe>`,
        "X-Priority": "3",
        "X-MSMail-Priority": "Normal",
        "Precedence": "bulk" // Gmail ko lagta hai safe bulk, spam nahi
      },
      disableFileAccess: true,
      disableUrlAccess: true
    });
    res.json({ success: true });
  } catch (err) {
    console.error(`❌ ${to}:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Fast Mailer running on port ${PORT}`));
