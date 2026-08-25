import express from "express";
import bodyParser from "body-parser";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Root route
app.get("/", (req, res) => {
  res.send("🚀 Fast Mailer is running!");
});

// ✅ Simple login
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    return res.json({ success: true });
  }
  res.json({ success: false, message: "Invalid credentials" });
});

// ✅ Email send
app.post("/send-email", async (req, res) => {
  const { senderName, gmailId, appPassword, subject, messageBody, to } = req.body;
  if (!gmailId || !appPassword || !to) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    pool: true,
    maxConnections: 1,
    maxMessages: 25,
    rateDelta: 3000, // 3s delay per mail
    auth: { user: gmailId, pass: appPassword }
  });

  try {
    await transporter.sendMail({
      from: senderName ? `"${senderName}" <${gmailId}>` : gmailId,
      to,
      subject,
      text: messageBody,
      headers: {
        "List-Unsubscribe": `<mailto:${gmailId}?subject=unsubscribe>`
      }
    });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Mailer running on port ${PORT}`));
