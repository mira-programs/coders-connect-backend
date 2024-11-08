const express = require('express');
const router = express.Router();
const User = require('./../models/User');
const Post = require('./../models/Post');
const Friendship = require('./../models/Friendship');
const verifyToken = require('./../middleware/verifyToken'); 
const multer = require('multer');

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

router.post('/update-bio', verifyToken, async (req, res) => {
    const { bio } = req.body;
    const currentUserId = req.user.userId; 

    if (typeof bio !== 'string' || bio.length <= 0) {
        return res.status(400).json({ message: 'Invalid input. Please provide a valid bio.' });
    }

    try {
        const user = await User.findById(currentUserId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        user.bio = bio;
        await user.save();  

        res.status(200).json({ message: 'Bio updated successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error updating bio.' });
    }
});


router.post('/update-occupation', verifyToken, async (req, res) => {
    const { occupation } = req.body;
    const currentUserId = req.user.userId;  

    if (typeof occupation !== 'string' || occupation.length <= 0) {
        return res.status(400).json({ message: 'Invalid input. Please provide a valid occupation.' });
    }

    try {
        const user = await User.findById(currentUserId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        user.occupation = occupation;
        await user.save();  

        res.status(200).json({ message: 'Occupation updated successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error updating occupation.' });
    }
});

router.post('/update-profilepicture', verifyToken, upload.single('profilePicture'), async (req, res) => {
    const currentUserId = req.user.userId;
    
    if(!req.file){
        return res.status(400).json({ message: "profile picture must be provided" });
    }

    try {
        // Find the user by their userId (from the token)
        const user = await User.findById(currentUserId);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Update the profile picture
        user.profilePicture = req.file.path;
        await user.save(); // Save the updated profile picture

        res.status(200).json({ message: 'Profile picture updated successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error updating profile picture.' });
    }
});

router.post('/deactivateAccount', verifyToken, async (req, res) => {
    const currentUserId = req.user.userId;

    try {
        // Deactivate the user account
        const user = await User.findById(currentUserId);

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        user.deactivated = true;
        await user.save();

        //  Deactivate the user's posts (without deleting)
        await Post.updateMany({ userId: currentUserId }, { $set: { isActive: false } });

        //  Deactivate the user's comments on posts
        await Post.updateMany(
            { 'comments.postedBy': currentUserId },
            { $set: { 'comments.$[].isActive': false } }
        );

        //Remove likes and dislikes from posts (but keep the data)
        await Post.updateMany(
            { likes: currentUserId },
            { $pull: { likes: currentUserId } }
        );

        await Post.updateMany(
            { dislikes: currentUserId },
            { $pull: { dislikes: currentUserId } }
        );

        //Remove likes and dislikes from comments (but keep the data)
        await Post.updateMany(
            { 'comments.likes': currentUserId },
            { $pull: { 'comments.$[].likes': currentUserId } }
        );

        await Post.updateMany(
            { 'comments.dislikes': currentUserId },
            { $pull: { 'comments.$[].dislikes': currentUserId } }
        );

        // Respond with success message
        res.status(200).json({ message: "Account deactivated successfully." });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error deactivating the account." });
    }
});


router.delete('/deleteAccount', verifyToken, async (req, res) => {
    const currentUserId = req.user.userId;

    const user = await User.findById(currentUserId);
    if (!user) {
        return res.status(404).json({
            message: "User not found."
        });
    }

    try {
        // Step 1: Delete all posts made by the user
        await Post.deleteMany({ userId: currentUserId });

        // Step 2: Delete all friendships involving the user
        await Friendship.deleteMany({
            $or: [
                { user1: currentUserId },
                { user2: currentUserId }
            ]
        });

        // Step 3: Remove likes and dislikes from posts made by the user
        await Post.updateMany(
            { likes: currentUserId }, // Find posts that the user has liked
            { $pull: { likes: currentUserId } } // Remove the user ID from the likes array
        );

        await Post.updateMany(
            { dislikes: currentUserId }, // Find posts that the user has disliked
            { $pull: { dislikes: currentUserId } } // Remove the user ID from the dislikes array
        );

        // Step 4: Remove comments made by the user
        await Post.updateMany(
            { 'comments.postedBy': currentUserId }, // Find posts where the user has commented
            { $pull: { comments: { postedBy: currentUserId } } } // Remove the comments made by the user
        );

        // Step 5: Remove likes and dislikes from comments made by the user
        await Post.updateMany(
            { 'comments.likes': currentUserId }, // Find posts where the user has liked a comment
            { $pull: { 'comments.$[].likes': currentUserId } } // Remove the user's like from all comments
        );

        await Post.updateMany(
            { 'comments.dislikes': currentUserId }, // Find posts where the user has disliked a comment
            { $pull: { 'comments.$[].dislikes': currentUserId } } // Remove the user's dislike from all comments
        );

        // Removing the user
        await User.deleteOne({ _id: currentUserId });

        // Step 7: Respond with a success message
        res.status(200).json({
            message: "Account and associated data deleted successfully."
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error deleting the account and associated data." });
    }
});

module.exports = router;