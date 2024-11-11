const express = require('express');
const router = express.Router();
const crypto = require('crypto');//to generate a verification token
const nodemailer = require('nodemailer');

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

//mongodb user model
const User = require('./../models/User');
const Post = require('./../models/Post');

//password handler
const bcrypt = require('bcrypt');

//multer for profile picture upload
const multer = require('multer');
const path = require('path');

// Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads');  // Directory to save uploaded images
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));  // Unique filename
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 5 }  // Limit file size to 5MB
});

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS 
    }
});

//signup
router.post('/signup', upload.single('profilePicture'), (req, res) => {
    const {username, email, firstName, lastName, password, occupation, bio} = req.body; 
    const profilePicture = req.file ? req.file.path : null; //initializing path for pfp
    const missingFields = [];
    if (!username) missingFields.push("username");
    if (!email) missingFields.push("email");
    if (!password) missingFields.push("password");
    if (!firstName) missingFields.push("firstName");
    if (!lastName) missingFields.push("lastName");
    if (!occupation) missingFields.push("occupation");
    if (!bio) missingFields.push("bio");
    if (!profilePicture) missingFields.push("profilePicture");
    if (missingFields.length > 0) {
        return res.json({
            status: "FAILED",
            message: `The following fields are empty: ${missingFields.join(", ")}`
        });    
    }else if(!/^[a-zA-Z ]*$/.test(firstName)){
        res.json({
            status: "FAILED",
            message: "Invalid name entered"
        })
    }else if(!/^[a-zA-Z ]*$/.test(lastName)){
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
                        username,
                        email,
                        password: hashedPassword,
                        firstName,
                        lastName,
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
            res.redirect('http://127.0.0.1:5500/login.html');
        }).catch(err => {
            res.json({ status: "FAILED", message: "Error verifying email" });
        });
    }).catch(err => {
        res.json({ status: "FAILED", message: "Error fetching user" });
    });
});

//login
router.post('/login', upload.none(), async(req, res) => {
    const {email, password} = req.body; 
    if(!email || !password){
        return res.json({
            status: "failed",
            message: "empty input credentials"
        });
    }
    try {
        // Check if the user exists
        const user = await User.findOne({ email });

        if (!user) {
            return res.json({
                status: "failed",
                message: "User not found. Please sign up."
            });
        }

        // Check if the user is verified
        if (!user.verified) {
            return res.json({
                status: "failed",
                message: "Email not verified. Please check your inbox."
            });
        }

        // Check if the user is deactivated
        if (user.deactivated) {
            // Reactivate the user's account
            user.deactivated = false;
            await user.save();
        
            // Reactivate the user's posts
            await Post.updateMany(
                { userId: user._id },
                { $set: { isActive: true } }
            );
        
            await Post.updateMany(
                { 'comments.postedBy': user._id },
                { $set: { 'comments.$[].isActive': true } }
            );
        
            await Post.updateMany(
                { 'comments.replies.postedBy': user._id },
                { $set: { 'comments.$[].replies.$[].isActive': true } }
            );
        
            await Post.updateMany(
                { userId: user._id },
                { $set: { 'likes.$[].isActive': true } }
            );
        
            await Post.updateMany(
                { 'comments.postedBy': user._id },
                { $set: { 
                    'comments.$[].likes.$[].isActive': true,
                    'comments.$[].dislikes.$[].isActive': true 
                }}
            );
        }

        // Check if the password matches
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.json({
                status: "failed",
                message: "Incorrect password"
            });
        }

        // Generate JWT token
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
        });

    } catch (err) {
        console.log("Error during login:", err);
        res.json({
            status: "failed",
            message: "An error occurred while logging in"
        });
    }
});

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
                    message: "Password reset email sent. Please check your inbox.",
                    token: user.verificationToken
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