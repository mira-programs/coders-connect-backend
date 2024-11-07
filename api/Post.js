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
        const {content, privacy } = req.body;
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
            media,
            privacy
        });
        console.log("User:", req.user);
        


        await newPost.save();
        res.status(201).json({ status: "SUCCESS", message: "Post created successfully", data: newPost });
    } catch (err) {
        console.log(err);
        res.status(500).json({ status: "FAILED", message: "Error creating post" });
    }
});

router.delete('/delete-post', upload.none(), (req, res) => {
    const { postId } = req.body;  // Extract the ID from the request body
  
    if (!postId) {
      return res.status(400).json({ message: "ID is required" });
    }
  
    // Proceed with the delete logic
    Post.findByIdAndDelete(postId)
      .then(post => {
        if (!post) {
          return res.status(404).json({ message: "Post not found" });
        }
        res.status(200).json({ message: "Post deleted successfully" });
      })
      .catch(err => {
        res.status(500).json({ message: "Error deleting post", error: err });
      });
  });
  
// Route for retrieving posts by a user, sorted by date !!!not sure if working yet
router.get('/user-posts', verifyToken, async (req, res) => {
    try {
        const posts = await Post.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.json({ status: "SUCCESS", data: posts });
    } catch (err) {
        res.status(500).json({ status: "FAILED", message: "Error retrieving posts" });
    }
});

module.exports = router;
