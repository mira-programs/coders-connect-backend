const express = require('express');
const router = express.Router();
const multer = require('multer');
const Post = require('../models/Post');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const {verifyToken} = require('../middleware/verifyToken');

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

        await User.findByIdAndUpdate(req.user.userId, { $inc: { post_count: 1 } });
        
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

        // Check if the current user is the owner of the post or an admin
        if (post.userId.toString() !== req.user.userId && req.user.role !== 'admin') {
            return res.status(403).json({ message: "You are not authorized to delete this post" });
        }

        const deletedPost = await Post.findByIdAndDelete(postId);
        if (!deletedPost) {
            return res.status(500).json({ message: "Error deleting post" });
        }

        // Decrement the post count of the user who created the post
        await User.findByIdAndUpdate(post.userId, { $inc: { post_count: -1 } });

        return res.status(200).json({ message: "Post deleted successfully" });

    } catch (err) {
        if (!res.headersSent) {
            return res.status(500).json({ message: "Error deleting post", error: err });
        }
    }
});

// Route to get posts based on friendship status and privacy settings
router.get('/user-posts', verifyToken, async (req, res) => {
    let { userId } = req.body;
    const currentUserId = req.user.userId;

    if(!userId){
        userId = currentUserId;
        //return res.status(400).json({ message: "User ID is required" });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if(user.deactivated){
            return res.status(403).json({ message: "User account is deactivated" });
        }

        const friendship = await Friendship.findOne({
            $or: [
                { user1: currentUserId, user2: userId }, 
                { user1: userId, user2: currentUserId }  
            ]
        });

        let isFriend = false;
        if (friendship && friendship.status === 'accepted') {
            isFriend = true;
        }

        let postsQuery = Post.find({ userId: userId}); 

        if(currentUserId === userId){
            postsQuery = postsQuery.where('privacy').in(['public', 'friends','private']);
        }else if (isFriend) {
            // If friends, allow public, friends posts
            postsQuery = postsQuery.where('privacy').in(['public', 'friends']);
        } else {
            // If not friends, only show public posts
            postsQuery = postsQuery.where('privacy').in(['public']);
        }

        postsQuery = postsQuery.populate({
            path: 'userId',
            match: { deactivated: { $ne: true } },
            select: 'name email'
        });

        postsQuery = postsQuery.populate({
            path: 'likes dislikes comments.postedBy comments.likes comments.dislikes comments.replies.postedBy comments.replies.likes comments.replies.dislikes',
            match: { deactivated: { $ne: true } },
            select: 'name email'
        });

        let posts = await postsQuery.sort({ createdAt: -1 });

        // Filter out posts where the userId is null (deactivated users)
        posts = posts.filter(post => post.userId !== null);

        // Filter out likes, dislikes, and comments from deactivated users
        posts = posts.map(post => {
            post.likes = post.likes.filter(user => user !== null);
            post.dislikes = post.dislikes.filter(user => user !== null);
            post.comments = post.comments
                .filter(comment => comment.postedBy !== null) // Exclude comments from deactivated users
                .map(comment => {
                    comment.likes = comment.likes.filter(user => user !== null);
                    comment.dislikes = comment.dislikes.filter(user => user !== null);
                    comment.replies = comment.replies
                        .filter(reply => reply.postedBy !== null) // Exclude replies from deactivated users
                        .map(reply => {
                            reply.likes = reply.likes.filter(user => user !== null);
                            reply.dislikes = reply.dislikes.filter(user => user !== null);
                            return reply;
                        });
                    return comment;
                });
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

        await User.findByIdAndUpdate(req.user.userId, { $inc: { activity: 1 } });

        res.status(200).json({
            message: "Post liked successfully",
            likesCount: post.likes.length,
            dislikesCount: post.dislikes.length
        });
    } catch (err) {
        res.status(500).json({ message: "Error liking post", error: err });
    }
});

// Route to remove a like from a post
router.post('/unlike-post', verifyToken, async (req, res) => {
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

        // Check if the user has already disliked the post
        if (post.dislikes.includes(req.user.userId)) {
            // If user has disliked the post, remove the like
            post.dislikes.pull(req.user.userId);
        }

        await post.save();

        await User.findByIdAndUpdate(req.user.userId, { $inc: { activity: -1 } });

        res.status(200).json({
            message: "Like removed successfully",
            likesCount: post.likes.length,
            dislikesCount: post.dislikes.length
        });
    } catch (err) {
        res.status(500).json({ message: "Error removing like", error: err });
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

        if (post.likes.includes(req.user.userId)) {
            post.likes.pull(req.user.userId);
        }

        if (!post.dislikes.includes(req.user.userId)) {
            post.dislikes.push(req.user.userId);
        }

        await post.save();

        await User.findByIdAndUpdate(req.user.userId, { $inc: { activity: 1 } });

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

        post.comments.push({
            text,
            postedBy: req.user.userId,
            created: Date.now()
        });

        await post.save();

        await User.findByIdAndUpdate(req.user.userId, { $inc: { activity: 1 } });

        res.status(200).json({ message: "Comment added successfully", data: post });
    } catch (err) {
        res.status(500).json({ message: "Error adding comment", error: err.message });
    }
});

// Route to delete a comment from a post
router.delete('/delete-comment', verifyToken, async (req, res) => {
    const { postId, commentId } = req.body;

    if (!postId || !commentId) {
        return res.status(400).json({ message: "Post ID and comment ID are required" });
    }

    try {
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        // Find the comment
        const comment = post.comments.id(commentId);
        if (!comment) {
            return res.status(404).json({ message: "Comment not found" });
        }

        // Check if the user who is requesting is the same as the user who wrote the comment
        if (comment.postedBy.toString() !== req.user.userId) {
            return res.status(403).json({ message: "You are not authorized to delete this comment" });
        }

        // Remove the comment
        comment.remove();

        await post.save();

        await User.findByIdAndUpdate(req.user.userId, { $inc: { activity: -1 } });

        res.status(200).json({ message: "Comment deleted successfully", data: post });
    } catch (err) {
        res.status(500).json({ message: "Error deleting comment", error: err.message });
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

        await User.findByIdAndUpdate(req.user.userId, { $inc: { activity: 1 } });

        res.status(200).json({
            message: "Comment liked successfully",
            likesCount: comment.likes.length,
            dislikesCount: comment.dislikes.length
        });
    } catch (err) {
        res.status(500).json({ message: "Error liking comment", error: err });
    }
});

// Route to remove a like or dislike from a comment
router.post('/unreact-comment', verifyToken, async (req, res) => {
    const { postId, commentId } = req.body;

    if (!postId || !commentId) {
        return res.status(400).json({ message: "Post ID and comment ID are required" });
    }

    try {
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        // Find the comment
        const comment = post.comments.id(commentId);
        if (!comment) {
            return res.status(404).json({ message: "Comment not found" });
        }

        // Check if the user has already liked the comment
        if (comment.likes.includes(req.user.userId)) {
            // If user has liked the comment, remove the like
            comment.likes.pull(req.user.userId);
        }

        // Check if the user has already disliked the comment
        if (comment.dislikes.includes(req.user.userId)) {
            // If user has disliked the comment, remove the dislike
            comment.dislikes.pull(req.user.userId);
        }

        await post.save();

        await User.findByIdAndUpdate(req.user.userId, { $inc: { activity: -1 } });

        res.status(200).json({
            message: "Reaction removed successfully",
            likesCount: comment.likes.length,
            dislikesCount: comment.dislikes.length
        });
    } catch (err) {
        res.status(500).json({ message: "Error removing reaction", error: err.message });
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

        await User.findByIdAndUpdate(req.user.userId, { $inc: { activity: 1 } });

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

        await User.findByIdAndUpdate(req.user.userId, { $inc: { activity: 1 } });

        res.status(200).json({
            message: "Reply added successfully",
            repliesCount: comment.replies.length,
            replyText: text,
            replyUser: req.user.userId
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Error adding reply", error: err });
    }
});

// Route to delete a reply to a comment
router.delete('/delete-reply', verifyToken, async (req, res) => {
    const { postId, commentId, replyId } = req.body;

    if (!postId || !commentId || !replyId) {
        return res.status(400).json({ message: "Post ID, comment ID, and reply ID are required" });
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

        const reply = comment.replies.id(replyId);
        if (!reply) {
            return res.status(404).json({ message: "Reply not found" });
        }

        // Check if the user who is requesting is the same as the user who wrote the reply
        if (reply.postedBy.toString() !== req.user.userId) {
            return res.status(403).json({ message: "You are not authorized to delete this reply" });
        }

        // Remove the reply
        reply.remove();

        await post.save();

        await User.findByIdAndUpdate(req.user.userId, { $inc: { activity: -1 } });

        res.status(200).json({
            message: "Reply deleted successfully",
            repliesCount: comment.replies.length
        });
    } catch (err) {
        res.status(500).json({ message: "Error deleting reply", error: err.message });
    }
});

// Route to like a reply on a comment
router.post('/like-reply', verifyToken, async (req, res) => {
    const { postId, commentId, replyId } = req.body;

    if (!postId || !commentId || !replyId) {
        return res.status(400).json({ message: "Post ID, Comment ID, and Reply ID are required" });
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

        const reply = comment.replies.id(replyId);
        if (!reply) {
            return res.status(404).json({ message: "Reply not found" });
        }

        if (reply.dislikes.includes(req.user.userId)) {
            reply.dislikes.pull(req.user.userId);
        }

        if (!reply.likes.includes(req.user.userId)) {
            reply.likes.push(req.user.userId);
        }

        await post.save();

        await User.findByIdAndUpdate(req.user.userId, { $inc: { activity: 1 } });

        res.status(200).json({
            message: "Reply liked successfully",
            likesCount: reply.likes.length,
            dislikesCount: reply.dislikes.length
        });
    } catch (err) {
        res.status(500).json({ message: "Error liking reply", error: err });
    }
});

// Route to remove a like or dislike from a reply on a comment
router.post('/unreact-reply', verifyToken, async (req, res) => {
    const { postId, commentId, replyId } = req.body;

    if (!postId || !commentId || !replyId) {
        return res.status(400).json({ message: "Post ID, Comment ID, and Reply ID are required" });
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

        const reply = comment.replies.id(replyId);
        if (!reply) {
            return res.status(404).json({ message: "Reply not found" });
        }

        // Check if the user has already liked the reply
        if (reply.likes.includes(req.user.userId)) {
            // If user has liked the reply, remove the like
            reply.likes.pull(req.user.userId);
        }

        // Check if the user has already disliked the reply
        if (reply.dislikes.includes(req.user.userId)) {
            // If user has disliked the reply, remove the dislike
            reply.dislikes.pull(req.user.userId);
        }

        await post.save();

        await User.findByIdAndUpdate(req.user.userId, { $inc: { activity: -1 } });

        res.status(200).json({
            message: "Reaction removed successfully",
            likesCount: reply.likes.length,
            dislikesCount: reply.dislikes.length
        });
    } catch (err) {
        res.status(500).json({ message: "Error removing reaction", error: err.message });
    }
});

// Route to dislike a reply
router.post('/dislike-reply', verifyToken, async (req, res) => {
    const { postId, commentId, replyId } = req.body;

    if (!postId || !commentId || !replyId) {
        return res.status(400).json({ message: "Post ID, Comment ID, and Reply ID are required" });
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

        const reply = comment.replies.id(replyId);
        if (!reply) {
            return res.status(404).json({ message: "Reply not found" });
        }

        if (reply.likes.includes(req.user.userId)) {
            reply.likes.pull(req.user.userId);
        }

        if (!reply.dislikes.includes(req.user.userId)) {
            reply.dislikes.push(req.user.userId);
        }

        await post.save();

        await User.findByIdAndUpdate(req.user.userId, { $inc: { activity: 1 } });

        res.status(200).json({
            message: "Reply disliked successfully",
            likesCount: reply.likes.length,
            dislikesCount: reply.dislikes.length
        });
    } catch (err) {
        res.status(500).json({ message: "Error disliking reply", error: err });
    }
});

// Route to get feed posts from activated friends
router.get('/feed', verifyToken, async (req, res) => {
    const currentUserId = req.user.userId;

    try {
        const user = await User.findById(currentUserId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const friendships = await Friendship.find({
            $or: [
                { user1: currentUserId, status: 'accepted' },
                { user2: currentUserId, status: 'accepted' }
            ]
        }).populate({
            path: 'user1 user2',
            match: { deactivated: { $ne: true } },
            select: 'username email profilePicture'
        });

        // Get the list of active friends' IDs
        const friendIds = friendships.map(friendship => {
            if (friendship.user1 && friendship.user1._id.toString() === currentUserId) {
                return friendship.user2 ? friendship.user2._id : null;
            } else if (friendship.user2 && friendship.user2._id.toString() === currentUserId) {
                return friendship.user1 ? friendship.user1._id : null;
            }
            return null;
        }).filter(id => id !== null);

        // If there are no friends, return 0 posts
        if (friendIds.length === 0) {
            return res.status(200).json({ status: "SUCCESS", data: [] });
        }

        // Query posts from these friends based on their privacy settings
        let posts = await Post.find({
            userId: { $in: friendIds },
            privacy: { $in: ['public', 'friends'] }
        }).sort({ createdAt: -1 })
          .populate('userId', 'username email profilePicture')
          .populate({
              path: 'likes dislikes comments.postedBy comments.likes comments.dislikes comments.replies.postedBy comments.replies.likes comments.replies.dislikes',
              match: { deactivated: { $ne: true } },
              select: 'username email profilePicture'
          });

        posts = posts.map(post => {
            //image for the post with url that refers to the backend folder correctly
            if (post.media) {
                post.media = `${req.protocol}://${req.get('host')}${post.media.startsWith('/') ? '' : '/'}${post.media}`;
            }

            // Full URL for the profile picture of the user who posted the post
            if (post.userId && post.userId.profilePicture) {
                post.userId.profilePicture = `${req.protocol}://${req.get('host')}${post.userId.profilePicture.startsWith('/') ? '' : '/'}${post.userId.profilePicture}`;
            }

            post.likes = post.likes.filter(user => user !== null);
            post.dislikes = post.dislikes.filter(user => user !== null);
            post.comments = post.comments
                .filter(comment => comment.postedBy !== null)
                .map(comment => {
                    comment.likes = comment.likes.filter(user => user !== null);
                    comment.dislikes = comment.dislikes.filter(user => user !== null);
                    comment.replies = comment.replies
                        .filter(reply => reply.postedBy !== null)
                        .map(reply => {
                            reply.likes = reply.likes.filter(user => user !== null);
                            reply.dislikes = reply.dislikes.filter(user => user !== null);
                            return reply;
                        });
                    return comment;
                });
            return post;
        });

        res.status(200).json({ status: "SUCCESS", data: posts });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: "FAILED", message: "Error retrieving feed posts" });
    }
});

// Route to get public posts for the explore page
router.get('/explore', verifyToken, async (req, res) => {
    try {
        // Query public posts where the user is not deactivated, sorted by creation time (most recent first)
        let posts = await Post.find({
            privacy: 'public'
        }).sort({ createdAt: -1 })
          .populate({
              path: 'userId',
              match: { deactivated: { $ne: true } },
              select: 'username email profilePicture'
          })
          .populate({
              path: 'likes dislikes comments.postedBy comments.likes comments.dislikes comments.replies.postedBy comments.replies.likes comments.replies.dislikes',
              match: { deactivated: { $ne: true } },
              select: 'username email profilePicture'
          });

        // Filter out posts where the user is deactivated
        posts = posts.filter(post => post.userId !== null);

        // Filter out deactivated users from likes, dislikes, comments, and replies
        posts = posts.map(post => {
            //image for the post with url that refers to the backend folder correctly
            if (post.media) {
                post.media = `${req.protocol}://${req.get('host')}${post.media.startsWith('/') ? '' : '/'}${post.media}`;
            }

            // Full URL for the profile picture of the user who posted the post
            if (post.userId && post.userId.profilePicture) {
                // Check if the profile picture already has a protocol (http:// or https://)
                if (!post.userId.profilePicture.startsWith('http://') && !post.userId.profilePicture.startsWith('https://')) {
                    post.userId.profilePicture = `${req.protocol}://${req.get('host')}${post.userId.profilePicture.startsWith('/') ? '' : '/'}${post.userId.profilePicture}`;
                }
                console.log(post.userId.profilePicture);
            }            

            post.likes = post.likes.filter(user => user !== null);
            post.dislikes = post.dislikes.filter(user => user !== null);
            post.comments = post.comments
                .filter(comment => comment.postedBy !== null)
                .map(comment => {
                    comment.likes = comment.likes.filter(user => user !== null);
                    comment.dislikes = comment.dislikes.filter(user => user !== null);
                    comment.replies = comment.replies
                        .filter(reply => reply.postedBy !== null)
                        .map(reply => {
                            reply.likes = reply.likes.filter(user => user !== null);
                            reply.dislikes = reply.dislikes.filter(user => user !== null);
                            return reply;
                        });
                    return comment;
                });
            return post;
        });

        res.status(200).json({ status: "SUCCESS", data: posts });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: "FAILED", message: "Error retrieving explore posts" });
    }
});

module.exports = router;
