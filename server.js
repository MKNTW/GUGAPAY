const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const userRoutes = require('./routes/userRoutes');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

app.use('/api', userRoutes);

mongoose.connect('mongodb://localhost:27017/zcoin', { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true });

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
