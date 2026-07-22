const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse URL-encoded bodies (for login forms)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files (HTML, CSS, JS) serve karne ke liye 'public' folder set karna
app.use(express.static(path.join(__dirname, 'public')));

// Login Route
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Launcher Route
app.get('/launcher', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'launcher.html'));
});

// Default root route par login page dikhane ke liye
app.get('/', (req, res) => {
    res.redirect('/login');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});