const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./database/User');

const app = express();
app.use(bodyParser.json());
app.use(express.static(__dirname));

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/zcoin', { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true });

// Routes
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();
        res.status(201).send('User registered');
    } catch (err) {
        res.status(400).send('Error registering user');
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).send('User not found');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).send('Invalid credentials');
    
    const token = jwt.sign({ id: user._id }, 'secretkey');
    res.json({ token });
});

app.post('/api/tap', async (req, res) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).send('No token, authorization denied');
    
    try {
        const decoded = jwt.verify(token, 'secretkey');
        const user = await User.findById(decoded.id);
        user.coins += 0.00001;
        await user.save();
        res.json({ coins: user.coins });
    } catch (err) {
        res.status(400).send('Token is not valid');
    }
});

app.get('/api/coins', async (req, res) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).send('No token, authorization denied');
    
    try {
        const decoded = jwt.verify(token, 'secretkey');
        const user = await User.findById(decoded.id);
        res.json({ coins: user.coins });
    } catch (err) {
        res.status(400).send('Token is not valid');
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
