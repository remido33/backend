const express = require('express');
const getError = require('../../shared_utils/getError');
const verifyShopifyRequest = require('./helpers/verifyShopifyRequest');
const app = express();
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 20,
    message: { error: 'Too many requests, please try again later.' },
});

// Apply apiLimiter globally
app.use(apiLimiter);

app.use(
    '/store/:id/webhook',
    express.json({
        limit: '5mb',
        verify: (req, res, buf) => {
            req.rawBody = buf.toString();
        },
    }),
    (req, res, next) => {
        const verified = verifyShopifyRequest(req);
        if (!verified) 
            throw getError(403, 'Invalid HMAC signature')

        next();
    }
);


require('dotenv').config();
// require('./cron/analytics/actions');
// require('./cron/analytics/terms');
// require('./cron/analytics/purchases');

app.use(express.json());

app.use('/store', require('./routes/store'));
app.use('/store/:id/analytics', require('./routes/store/analytics'));
app.use('/user', require('./routes/user'));


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'rakshayaroslav37@gmail.com',  // Your Gmail address
      pass: 'zdgk ursb cjew zvjp',   // Your generated App Password
    },
});


app.post('/contact', async (req, res) => {
    const { firstName, brandName, email } = req.body;

    // Validate input
    if (!firstName || typeof firstName !== 'string' || firstName.trim() === '') {
        return res.status(400).json({ error: 'First name is required.' });
    }

    if (!brandName || typeof brandName !== 'string' || brandName.trim() === '') {
        return res.status(400).json({ error: 'Brand name is required.' });
    }

    if (!email || typeof email !== 'string' || email.trim() === '') {
        return res.status(400).json({ error: 'Email is required.' });
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format.' });
    }

    try {

        await transporter.sendMail({
            from: 'rakshayaroslav37@gmail.com',
            to: 'rakshayaroslav33@gmail.com',
            subject: 'New Contact Request',
            text: `First Name: ${firstName}\nBrand Name: ${brandName}\nEmail: ${email}`,
        });
        
        res.status(200).json({ message: 'Contact request received and email sent.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to send email.' });
    }
});


app.all('*', (req, res) =>
    res.status(404).json(getError(404, 'Resource not found')));

app.use(require('../../shared_utils/errorHandler'));

module.exports = app;
