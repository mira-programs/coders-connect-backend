const express = require('express');
const router = express.Router();
const multer = require('multer');
const Post = require('../models/Post');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
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

        if (!content && !media) {
            return res.status(400).json({
                status: "FAILED",
                message: "Content or media is required"
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
        res.status(200).json({ status: "SUCCESS", message: "Post created successfully", data: newPost });
    } catch (err) {
        console.log(err);
        res.status(500).json({ status: "FAILED", message: "Error creating post" });
    }
});

router.delete('/delete-post', verifyToken, async (req, res) => {
    const { postId } = req.body;  

    if (!postId) {
        return res.status(400).json({ message: "Post ID is required" });
    }

    try {
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        if (post.userId.toString() !== req.user.userId) {
            return res.status(403).json({ message: "You are not authorized to delete this post" });
        }

        const deletedPost = await Post.findByIdAndDelete(postId);
        if (!deletedPost) {
            return res.status(500).json({ message: "Error deleting post" });
        }

        return res.status(200).json({ message: "Post deleted successfully" });

    } catch (err) {
        if (!res.headersSent) {
            return res.status(500).json({ message: "Error deleting post", error: err });
        }
    }
});


// Route to get posts based on friendship status and privacy settings
router.get('/user-posts/:userId', verifyToken, async (req, res) => {
    const { userId } = req.params; // The user whose posts we want to fetch
    const currentUserId = req.user.userId; // The current logged-in user's ID

    try {
        // Check if the user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check the friendship status between the logged-in user and the target user
        const friendship = await Friendship.findOne({
            $or: [
                { user1: currentUserId, user2: userId }, // Current user is user1
                { user1: userId, user2: currentUserId }  // Current user is user2
            ]
        });

        // Determine if the user is friends or not
        let isFriend = false;
        if (friendship && friendship.status === 'accepted') {
            isFriend = true;
        }

        // Fetch posts based on the friendship status and privacy setting
        let postsQuery = Post.find({ userId: userId, isActive: true }); // Start by filtering by userId
        
        if (isFriend) {
            // If friends, allow public, friends, and private posts
            postsQuery = postsQuery.where('privacy').in(['public', 'friends']);
        } else {
            // If not friends, only show public posts
            postsQuery = postsQuery.where('privacy').in(['public']);
        }
        
        let posts = await postsQuery.sort({ createdAt: -1 }).populate('likes.userId dislikes.userId comments.postedBy');

        // Filter active comments, replies, likes, and dislikes
        posts = posts.map(post => {
            // Filter active comments
            post.comments = post.comments.filter(comment => comment.isActive);

            // Filter active replies for each comment
            post.comments.forEach(comment => {
                comment.replies = comment.replies.filter(reply => reply.isActive);
                
                // Optionally: Filter active likes and dislikes for each comment (remove likes/dislikes by deactivated users)
                comment.likes = comment.likes.filter(like => like.isActive !== false); // Only keep active likes
                comment.dislikes = comment.dislikes.filter(dislike => dislike.isActive !== false); // Only keep active dislikes
            });

            // Filter active likes/dislikes on the post itself (optional based on your use case)
            post.likes = post.likes.filter(like => like.isActive !== false); // Only keep active likes
            post.dislikes = post.dislikes.filter(dislike => dislike.isActive !== false); // Only keep active dislikes

            return post;
        });

        res.status(200).json({ status: "SUCCESS", data: posts });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: "FAILED", message: "Error retrieving posts" });
    }
});


// Route to like a post (removes dislike if user already disliked the post)
router.post('/like-post', verifyToken, async (req, res) => {
    const { postId } = req.body;

    if (!postId) {
        return res.status(400).json({ message: "Post ID is required" });
    }

    try {
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        // Check if the user has already disliked the post
        if (post.dislikes.includes(req.user.userId)) {
            // If user has disliked the post, remove the dislike
            post.dislikes.pull(req.user.userId);
        }

        // Now add the like (if it's not already liked)
        if (!post.likes.includes(req.user.userId)) {
            post.likes.push(req.user.userId);
        }

        await post.save();
        res.status(200).json({
            message: "Post liked successfully",
            likesCount: post.likes.length,
            dislikesCount: post.dislikes.length
        });
    } catch (err) {
        res.status(500).json({ message: "Error liking post", error: err });
    }
});

// Route to dislike a post (removes like if user already liked the post)
router.post('/dislike-post', verifyToken, async (req, res) => {
    const { postId } = req.body;

    if (!postId) {
        return res.status(400).json({ message: "Post ID is required" });
    }

    try {
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        // Check if the user has already liked the post
        if (post.likes.includes(req.user.userId)) {
            // If user has liked the post, remove the like
            post.likes.pull(req.user.userId);
        }

        // Now add the dislike (if it's not already disliked)
        if (!post.dislikes.includes(req.user.userId)) {
            post.dislikes.push(req.user.userId);
        }

        await post.save();
        res.status(200).json({
            message: "Post disliked successfully",
            likesCount: post.likes.length,
            dislikesCount: post.dislikes.length
        });
    } catch (err) {
        res.status(500).json({ message: "Error disliking post", error: err });
    }
});


// Route to add a comment to a post
router.post('/comment-post', verifyToken, async (req, res) => {
    const { postId, text } = req.body;
    if (!postId || !text) {
        return res.status(400).json({ message: "Post ID and comment text are required" });
    }

    try {
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        // Add the comment to the post
        post.comments.push({
            text,
            postedBy: req.user.userId,
            created: Date.now()
        });

        await post.save();
        res.status(200).json({ message: "Comment added successfully", data: post });
    } catch (err) {
        res.status(500).json({ message: "Error adding comment", error: err });
    }
});

// Route to edit a post
router.put('/edit-post', verifyToken, upload.single('media'), async (req, res) => {
    const { postId, content, privacy } = req.body;
    if (!postId) {
        return res.status(400).json({ message: "Post ID is required" });
    }

    if (!content && !privacy && !req.file) {
        return res.status(400).json({ message: "At least one of content, privacy, or media must be provided" });
    }

    try {
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        // Check if the user is the creator of the post
        if (post.userId.toString() !== req.user.userId) {
            return res.status(403).json({ message: "You are not authorized to edit this post" });
        }

        // Update post content and media (if provided)
        if(content){
            post.content = content;
        }
        if (req.file) {
            post.media = req.file.path;
        }
        if (privacy) {
            post.privacy = privacy;
        }

        await post.save();
        res.status(200).json({ message: "Post updated successfully", data: post });
    } catch (err) {
        res.status(500).json({ message: "Error editing post", error: err });
    }
});

// Like a comment
router.post('/like-comment', verifyToken, async (req, res) => {
    const { postId, commentId } = req.body;
    if (!postId || !commentId) {
        return res.status(400).json({ message: "Post ID and Comment ID are required" });
    }

    try {
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        // Find the comment to like
        const comment = post.comments.id(commentId);
        if (!comment) {
            return res.status(404).json({ message: "Comment not found" });
        }

        // If the user has already disliked the comment, remove the dislike
        if (comment.dislikes.includes(req.user.userId)) {
            comment.dislikes.pull(req.user.userId);
        }

        // If the user has not liked the comment, add the like
        if (!comment.likes.includes(req.user.userId)) {
            comment.likes.push(req.user.userId);
        }

        await post.save();
        res.status(200).json({
            message: "Comment liked successfully",
            likesCount: comment.likes.length,
            dislikesCount: comment.dislikes.length
        });
    } catch (err) {
        res.status(500).json({ message: "Error liking comment", error: err });
    }
});

// Dislike a comment
router.post('/dislike-comment', verifyToken, async (req, res) => {
    const { postId, commentId } = req.body;
    if (!postId || !commentId) {
        return res.status(400).json({ message: "Post ID and Comment ID are required" });
    }

    try {
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        // Find the comment to dislike
        const comment = post.comments.id(commentId);
        if (!comment) {
            return res.status(404).json({ message: "Comment not found" });
        }

        // If the user has already liked the comment, remove the like
        if (comment.likes.includes(req.user.userId)) {
            comment.likes.pull(req.user.userId);
        }

        // If the user has not disliked the comment, add the dislike
        if (!comment.dislikes.includes(req.user.userId)) {
            comment.dislikes.push(req.user.userId);
        }

        await post.save();
        res.status(200).json({
            message: "Comment disliked successfully",
            likesCount: comment.likes.length,
            dislikesCount: comment.dislikes.length
        });
    } catch (err) {
        res.status(500).json({ message: "Error disliking comment", error: err });
    }
});

// Reply to a comment
router.post('/comment-reply', verifyToken, async (req, res) => {
    const { postId, commentId, text } = req.body;
    if (!postId || !commentId || !text) {
        return res.status(400).json({ message: "Post ID, comment ID, and text are required" });
    }

    try {
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        const comment = post.comments.id(commentId);
        if (!comment) {
            return res.status(404).json({ message: "Comment not found" });
        }

        // Add the reply to the comment's replies array
        const newReply = {
            text,
            postedBy: req.user.userId,
        };
        comment.replies.push(newReply);

        await post.save();
        res.status(200).json({
            message: "Reply added successfully",
            repliesCount: comment.replies.length,
            replyText: text,
            replyUser: req.user.userId
        });
    } catch (err) {
        res.status(500).json({ message: "Error adding reply", error: err });
    }
});

module.exports = router;
