const express = require('express');
const router = express.Router();
const User = require('./../models/User');
const Post = require('./../models/Post');
const Friendship = require('./../models/Friendship');
const verifyToken = require('./../middleware/verifyToken'); 
const multer = require('multer');
const bcrypt = require('bcrypt');

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

router.get('/profile', verifyToken, async (req, res) => {
    const currentUserId = req.user.userId; // Extract userId from the token

    try {
        // Fetch the user by ID, excluding sensitive information like password
        const user = await User.findById(currentUserId).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const profilePictureUrl = `${req.protocol}://${req.get('host')}${user.profilePicture.startsWith('/') ? '' : '/'}${user.profilePicture}`;
        res.status(200).json({
            message: 'User profile fetched successfully.',
            profile: {
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                bio: user.bio,
                occupation: user.occupation,
                profilePicture: profilePictureUrl,
                createdAt: user.createdAt,
                post_count: user.post_count
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching user profile.' });
    }
});

router.post('/update-name', verifyToken, async(req,res) => {
    const {firstName, lastName} = req.body;
    const currentUserId = req.user.userId;

    if (firstName.length <= 0 || lastName.length <=0 ){
        return res.status(400).json({ message: 'Invalid input. Please provide a valid nonempty name.' });
    }
    try {
        const user = await User.findById(currentUserId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        user.firstName = firstName;
        user.lastName = lastName;
        await user.save();  

        res.status(200).json({ message: 'Name updated successfully.' });
    } catch (error) {
        console.error(err);
        res.status(500).json({ message: 'Error updating name.' });
    }
})

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
        const user = await User.findById(currentUserId);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        user.profilePicture = req.file.path;
        await user.save(); 

        res.status(200).json({ message: 'Profile picture updated successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error updating profile picture.' });
    }
});

router.post('/deactivateAccount', verifyToken, async (req, res) => {
    const currentUserId = req.user.userId;

    try {
        const user = await User.findById(currentUserId);

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        user.deactivated = true;
        await user.save();

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
        // Delete all posts made by the user
        await Post.deleteMany({ userId: currentUserId });

        // Delete all friendships involving the user
        await Friendship.deleteMany({
            $or: [
                { user1: currentUserId },
                { user2: currentUserId }
            ]
        });

        //Remove likes and dislikes from posts made by the user
        await Post.updateMany(
            { likes: currentUserId }, 
            { $pull: { likes: currentUserId } } 
        );

        await Post.updateMany(
            { dislikes: currentUserId }, 
            { $pull: { dislikes: currentUserId } } 
        );

        //Remove comments made by the user
        await Post.updateMany(
            { 'comments.postedBy': currentUserId }, 
            { $pull: { comments: { postedBy: currentUserId } } } 
        );

        //Remove likes and dislikes from comments made by the user
        await Post.updateMany(
            { 'comments.likes': currentUserId }, 
            { $pull: { 'comments.$[].likes': currentUserId } } 
        );

        await Post.updateMany(
            { 'comments.dislikes': currentUserId },
            { $pull: { 'comments.$[].dislikes': currentUserId } } 
        );

         // Remove replies made by the user
         await Post.updateMany(
            { 'comments.replies.postedBy': currentUserId },
            { $pull: { 'comments.$[].replies': { postedBy: currentUserId } } }
        );

        // Remove likes and dislikes from replies made by the user
        await Post.updateMany(
            { 'comments.replies.likes': currentUserId },
            { $pull: { 'comments.$[].replies.$[].likes': currentUserId } }
        );

        await Post.updateMany(
            { 'comments.replies.dislikes': currentUserId },
            { $pull: { 'comments.$[].replies.$[].dislikes': currentUserId } }
        );
        
        // Removing the user
        await User.deleteOne({ _id: currentUserId });

        // Respond with a success message
        res.status(200).json({
            message: "Account and associated data deleted successfully."
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error deleting the account and associated data." });
    }
});

router.post('/change-password', verifyToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const currentUserId = req.user.userId;

    if(!currentPassword || !newPassword) {
        return res.status(400).json({ message: "old password and new password must be provided" });
    }

    if (typeof newPassword !== 'string') {
        return res.status(400).json({ message: 'Invalid input. Please provide a valid new password with at least 8 characters.' });
    }

    if (newPassword.length < 8) {
        return res.json({
            status: "failed",
            message: "Password is too short. It must be at least 8 characters long."
        });
    } else if (!/[A-Z]/.test(newPassword)) {
        return res.json({
            status: "failed",
            message: "Password must contain at least one uppercase letter."
        });
    } else if (!/[0-9]/.test(newPassword)) {
        return res.json({
            status: "failed",
            message: "Password must contain at least one number."
        });
    } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
        return res.json({
            status: "failed",
            message: "Password must contain at least one special character."
        });
    }

    try {
        const user = await User.findById(currentUserId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect.' });
        }

        return bcrypt.hash(newPassword, 10).then(hashedPassword => {
            user.password = hashedPassword;
            return user.save();
        }).then(() => {
            res.status(200).json({ message: 'Password updated successfully.' });
        }).catch(err => {
            console.error(err);
            res.status(500).json({ message: 'Error updating password.' });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error updating password.' });
    }
});

module.exports = router;