const express = require('express');
const router = express.Router();
const crypto = require('crypto');//to generate a verification token
const nodemailer = require('nodemailer');

//mongodb user model
const User = require('./../models/User');

//password handler
const bcrypt = require('bcrypt');

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS 
    }
});

//signup
router.post('/signup', (req, res) => {
    let{name, email, password, occupation, bio, profilePicture} = req.body; 
    if (name == "" || email == "" || password == "" || occupation == "" || bio == "" || profilePicture == "") { 
        res.json({
            status: "FAILED", 
            message: "empty input field" 
        })
    }else if(!/^[a-zA-Z ]*$/.test(name)){
        res.json({
            status: "FAILED",
            message: "Invalid name entered"
        })
    }else if(!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)){
        res.json({
            status: "FAILED",
            message: "Invalid email entered"
        })
    }else if(password.length < 8){
        res.json({
            status: "FAILED",
            message: "password is too short"
        })  
    }else{
        // check if user exists
        User.find({email}).then(result =>{
            if(result.length>0){
                res.json({
                    status: "FAILED",
                    message: "user with this email already exist"
                })
            }else{
                bcrypt.hash(password,10).then(hashedPassword => {
                    const verificationToken = crypto.randomBytes(32).toString('hex');
                    const newUser = new User({
                        name,
                        email,
                        password: hashedPassword,
                        occupation,
                        bio,
                        profilePicture,
                        verificationToken
                    });
                    newUser.save().then(result => {
                        const verificationLink = `http://localhost:3000/user/verify/${verificationToken}`;
                        const mailOptions = {
                            from: process.env.EMAIL_USER,
                            to: email,
                            subject: 'Email Verification',
                            text: `Click the link to verify your email: ${verificationLink}`
                        };
    
                        transporter.sendMail(mailOptions, (err, info) => {
                            if (err) {
                                console.error(err);
                                return res.json({ status: "FAILED", message: "Error sending verification email" });
                            }
                            res.json({
                                status: "SUCCESS",
                                message: "Signup successful, please verify your email.",
                                data: result
                            });
                        });
                    }).catch(err => {
                        res.json({
                            status: "FAILED",
                            message: "An error occurred when saving new user."
                        });
                    });
                }).catch(err => {
                    res.json({
                        status: "FAILED",
                        message: "An error occurred while hashing password."
                    });
                });
            }
        }).catch(err =>{
            console.log(err);
            res.json({
                status: "FAILED",
                message: "an error occurred while checking for existing user"
            })
        })
    }
});

router.get('/verify/:token', (req, res) => {
    const { token } = req.params;

    User.findOne({ verificationToken: token }).then(user => {
        if (!user) {
            return res.json({ status: "FAILED", message: "Invalid or expired token" });
        }

        user.verified = true;
        user.verificationToken = null; 
        user.save().then(() => {
            res.redirect('/login');
        }).catch(err => {
            res.json({ status: "FAILED", message: "Error verifying email" });
        });
    }).catch(err => {
        res.json({ status: "FAILED", message: "Error fetching user" });
    });
});

//login
router.post('/login', (req, res) => {
    let{email, password} = req.body; 
    if(email == "", password == ""){
        res.json({
            status: "failed",
            message: "empty input credentials"
        })
    }else{
        //check if user exists
        User.find({email})
        .then(data => {
            if (!data) {
                return res.json({
                    status: "failed",
                    message: "User not found. Please sign up."
                });
            }
            if(data.length>0){
                const user = data[0];
                //check if user is verified
                if (!user.verified) {
                    return res.json({
                        status: "failed",
                        message: "Email not verified. Please check your inbox."
                    });
                }
                //user exists, check password
                const hashedPassword = user.password;
                bcrypt.compare(password, hashedPassword).then(result => {
                    if(result){ 

                        const payload = {
                            userId: user._id,
                            email: user.email
                        };
                        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' }); // Token expires in 1 hour
                        res.json({
                            status: "SUCCESS",
                            message: "Login successful",
                            token: token,
                            data: user
                        })
                    }else{
                        res.json({
                            status: "failed",
                            message: "incorrect password"
                        })
                    }
                })
                .catch(err => {
                    res.json({
                        status: "failed",
                        message: "error while checking password"
                    })
                })
            }else{
                res.json({
                    status: "failed",
                    message: "invalid credentials"
                })
            }
        })
        .catch(err => {
            console.log(err);
            res.json({
                status: "failed",
                message: "an error occurred while checking for existing user"
            })
        })
    }
})

router.post('/forgot-password', (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.json({
            status: "failed",
            message: "Please provide an email."
        });
    }
 
    User.findOne({ email })
        .then(user => {
            if (!user) {
                return res.json({
                    status: "failed",
                    message: "User not found. please sign up."
                });
            }

            if (!user.verified) {
                return res.json({
                    status: "failed",
                    message: "Email not verified. Please check your inbox."
                });
            }

            const resetToken = crypto.randomBytes(32).toString('hex');
            user.verificationToken = resetToken;
            
            return user.save();
        })
        .then(user => {
            const resetLink = `http://localhost:3000/reset-password/${user.verificationToken}`;
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: user.email,
                subject: 'Password Reset Request',
                text: `Please click the following link to reset your password: ${resetLink}`
            };
            transporter.sendMail(mailOptions, (err, info) => {
                if (err) {
                    console.error(err);
                    return res.json({
                        status: "failed",
                        message: "Error sending email."
                    });
                }
                res.json({
                    status: "SUCCESS",
                    message: "Password reset email sent. Please check your inbox."
                });
            });
        })
        .catch(err => {
            console.error(err);
            res.json({
                status: "failed",
                message: "An error occurred while resetting the password."
            });
        });
});

router.post('/reset-password/:token', (req, res) => {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
        return res.json({
            status: "failed",
            message: "Please provide a new password."
        });
    }

    User.findOne({
        verificationToken: token,
    })
        .then(user => {
            if (!user) {
                return res.json({
                    status: "failed",
                    message: "Invalid token."
                });
            }

            // Hash the new password
            return bcrypt.hash(newPassword, 10).then(hashedPassword => {
                user.password = hashedPassword;
                user.verificationToken = null;
                return user.save();
            });
        })
        .then(() => {
            res.json({
                status: "SUCCESS",
                message: "Password updated successfully."
            });
        })
        .catch(err => {
            console.error(err);
            res.json({
                status: "failed",
                message: "An error occurred while resetting the password."
            });
        });
});


module.exports = router;