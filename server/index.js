const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 3001;

// In-memory storage for OTPs
// In a production environment, you would use a more robust solution like Redis.
const otpStore = {};

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Nodemailer transporter setup
// In a real application, use environment variables for these credentials.
const transporter = nodemailer.createTransport({
    service: 'gmail', // or another email service
    auth: {
        user: 'YOUR_EMAIL@gmail.com', // TODO: Replace with your email
        pass: 'YOUR_EMAIL_PASSWORD'    // TODO: Replace with your email password or app password
    }
});

// Endpoint to send OTP
app.post('/api/send-otp', (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiration = Date.now() + 10 * 60 * 1000; // OTP valid for 10 minutes

    otpStore[email] = { otp, expiration };

    // For testing purposes, we'll log the OTP to the console.
    console.log(`OTP for ${email}: ${otp}`);

    const mailOptions = {
        from: 'YOUR_EMAIL@gmail.com',
        to: email,
        subject: 'Your OTP for SecureVote',
        text: `Your OTP is: ${otp}`
    };

    // In a real scenario, you would uncomment the following lines to send the email.
    // transporter.sendMail(mailOptions, (error, info) => {
    //     if (error) {
    //         console.error('Error sending email:', error);
    //         return res.status(500).json({ error: 'Failed to send OTP email' });
    //     }
    //     console.log('Email sent: ' + info.response);
    //     res.status(200).json({ message: 'OTP sent successfully' });
    // });

    // Since we are not sending a real email for now, we send a success response immediately.
    res.status(200).json({ message: 'OTP generated and logged for testing' });
});

// Endpoint to verify OTP
app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const storedOtpData = otpStore[email];
    if (!storedOtpData) {
        return res.status(400).json({ error: 'OTP not requested for this email' });
    }

    if (Date.now() > storedOtpData.expiration) {
        delete otpStore[email];
        return res.status(400).json({ error: 'OTP has expired' });
    }

    if (otp === storedOtpData.otp) {
        delete otpStore[email]; // OTP is single-use
        res.status(200).json({ message: 'OTP verified successfully' });
    } else {
        res.status(400).json({ error: 'Invalid OTP' });
    }
});


app.get('/', (req, res) => {
  res.send('OTP verification server is running!');
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
