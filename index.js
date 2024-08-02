const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cron = require('node-cron');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const mongoURL = 'mongodb+srv://MyDatabase:Cp8rNCfi15IUC6uc@cluster0.kjbloky.mongodb.net/login';

mongoose.connect(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch((error) => {
        console.error('Error connecting to MongoDB:', error);
    });

const userSchema = new mongoose.Schema({
    userId: String,
    value: { type: Number, default: 0 },
    lastCodeUsed: Date
});

const User = mongoose.model('User', userSchema);

const dailyCodeSchema = new mongoose.Schema({
    code: String,
    date: { type: Date, default: Date.now }
});

const DailyCode = mongoose.model('DailyCode', dailyCodeSchema);

app.post('/user/:id', async (req, res) => {
    const userId = req.params.id;
    let user = await User.findOne({ userId: userId });

    if (!user) {
        user = new User({ userId: userId });
        await user.save();
        return res.json(user);
    }

    user.value += 1;
    await user.save();
    res.json(user);
});

app.post('/user/:id/code', async (req, res) => {
    const userId = req.params.id;
    const { code } = req.body;
    const user = await User.findOne({ userId: userId });
    const dailyCode = await DailyCode.findOne().sort({ date: -1 });

    if (!user) {
        return res.status(404).send('User not found');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (user.lastCodeUsed && new Date(user.lastCodeUsed).toDateString() === today.toDateString()) {
        return res.send('Code already used today');
    }

    if (dailyCode && dailyCode.code === code) {
        user.value += 1000000;
        user.lastCodeUsed = new Date();
        await user.save();
        return res.redirect(`/user/${userId}`);
    } else {
        return res.send('Code not matched');
    }
});

app.get('/user/:id', async (req, res) => {
    const userId = req.params.id;
    let user = await User.findOne({ userId: userId });

    if (!user) {
        user = new User({ userId: userId });
        await user.save();
    }

    res.send(`
        <html>
        <body>
            <p id="value">${user.value}</p>
            <button onclick="incrementValue()">Increment</button>
            <form action="/user/${userId}/code" method="post">
                <input type="text" name="code" placeholder="Enter code">
                <button type="submit">Submit</button>
            </form>
            <script>
                async function incrementValue() {
                    const response = await fetch('/user/${userId}', {
                        method: 'POST'
                    });
                    const data = await response.json();
                    document.getElementById('value').innerText = data.value;
                }
            </script>
        </body>
        </html>
    `);
});

app.get('/code', async (req, res) => {
    const dailyCode = await DailyCode.findOne().sort({ date: -1 });

    res.send(`
        <html>
        <body>
            <div>
                <form action="/code" method="post">
                    <input type="text" name="code" placeholder="Enter code">
                    <button type="submit">Submit</button>
                </form>
                <div>
                    <p>Current Code: ${dailyCode ? dailyCode.code : 'No code available'}</p>
                </div>
            </div>
        </body>
        </html>
    `);
});

app.post('/code', async (req, res) => {
    const { code } = req.body;

    let dailyCode = await DailyCode.findOne().sort({ date: -1 });

    if (!dailyCode || new Date(dailyCode.date).toDateString() !== new Date().toDateString()) {
        dailyCode = new DailyCode({ code });
        await dailyCode.save();
    } else {
        dailyCode.code = code;
        await dailyCode.save();
    }

    res.redirect('/code');
});

// Cron job to reset the daily code at midnight
cron.schedule('0 0 * * *', async () => {
    const newDailyCode = new DailyCode({ code: 'Default Code' });
    await newDailyCode.save();
    console.log('Daily code reset at midnight');
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});