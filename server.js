// Routes
app.get('/', (req, res) => {
    if (req.session && req.session.loggedIn) {
        return res.sendFile(path.join(__dirname, 'public', 'launcher.html'));
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
        req.session.loggedIn = true;
        return res.json({ success: true });
    }
    res.status(401).json({ success: false, message: 'Invalid username or password' });
});

app.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});
