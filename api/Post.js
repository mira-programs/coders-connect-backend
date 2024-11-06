// api/Post.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const Post = require('../models/Post');
const verifyToken = require('../middleware/verifyToken');

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Route for creating a post (text, image, or video)
router.post('/create', verifyToken, upload.single('media'), async (req, res) => {
    try {
        // console.log("Request Body:", req.body);
        // console.log("File:", req.file);
        // console.log("User:", req.user);
        const { content } = req.body;
        const media = req.file ? req.file.path : null;

        if (!content) {
            return res.status(400).json({
                status: "FAILED",
                message: "Content is required"
            });
        }
        
        const newPost = new Post({
            userId: req.user.userId,
            content,
            media
        });
        console.log("User:", req.user);
        


        await newPost.save();
        res.status(201).json({ status: "SUCCESS", message: "Post created successfully", data: newPost });
    } catch (err) {
        res.status(500).json({ status: "FAILED", message: "Error creating post" });
    }
});

// Route for retrieving posts by a user, sorted by date
router.get('/user-posts', verifyToken, async (req, res) => {
    try {
        const posts = await Post.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.json({ status: "SUCCESS", data: posts });
    } catch (err) {
        res.status(500).json({ status: "FAILED", message: "Error retrieving posts" });
    }
});

module.exports = router;
