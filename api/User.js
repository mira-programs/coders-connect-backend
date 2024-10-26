const express = require('express');
const router = express.Router();
const crypto = require('crypto');//to generate a verification token
const nodemailer = require('nodemailer');

//mongodb user model
const User = require('./../models/User');

//password handler
const bcrypt = require('bcrypt');

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
            res.json({
                status: "SUCCESS",
                message: "Email verified successfully. You can now log in."
            });
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
                        res.json({
                            status: "SUCCESS",
                            message: "Login successful",
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
    const { email, password } = req.body;

    if (!email || !password) {
        return res.json({
            status: "failed",
            message: "Please provide both email and new password."
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

            return bcrypt.hash(password, 10).then(hashedPassword => {
                user.password = hashedPassword;
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