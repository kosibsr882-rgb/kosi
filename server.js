const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Static files (HTML, CSS) serve karne ke liye
app.use(express.static(path.join(__dirname, 'public')));

// Login page route
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Launcher page route
app.get('/launcher', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'launcher.html'));
});

// Root URL par login page khulega
app.get('/', (req, res) => {
    res.redirect('/login');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
