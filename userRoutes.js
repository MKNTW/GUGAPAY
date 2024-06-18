const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

router.post('/register', async (req, res) => {
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

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).send('User not found');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).send('Invalid credentials');
    
    const token = jwt.sign({ id: user._id }, 'secretkey');
    res.json({ token });
});

router.post('/tap', async (req, res) => {
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

router.get('/coins', async (req, res) => {
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

module.exports = router;
