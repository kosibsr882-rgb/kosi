// config.js
require('dotenv').config();

module.exports = {
  adminUser: process.env.ADMIN_USER || 'admin',
  adminPass: process.env.ADMIN_PASS || 'admin123',
  sessionSecret: process.env.SESSION_SECRET || 'fast-mailer-secret',
  port: process.env.PORT || 3000
};
