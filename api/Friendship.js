const express = require('express');
const router = express.Router();
const Friendship = require('../models/Friendship');
const User = require('../models/User');
const verifyToken = require('./../middleware/verifyToken'); 

router.use(verifyToken);

router.post('/send-friend-request', async (req, res) => {
    const { userEmail, friendEmail } = req.body;

    // Ensure the token belongs to the correct user
    if (req.user.email !== email) {
        return res.status(403).json({ message: "You are not authorized to update this user's information." });
    }

    if (userEmail === friendEmail) {
        return res.status(400).json({ message: "You cannot send a friend request to yourself." });
    }

    try {
        const user = await User.findOne({ email: userEmail });
        const friend = await User.findOne({ email: friendEmail });

        if (!user || !friend) {
            return res.status(404).json({ message: "User(s) not found." });
        }

        const existingFriendship = await Friendship.findOne({
            $or: [
                { user1: user._id, user2: friend._id },
                { user1: friend._id, user2: user._id }
            ]
        });

        if (existingFriendship) {
            return res.status(400).json({ message: "Friendship request already exists or you're already friends." });
        }

        const newFriendship = new Friendship({
            user1: user._id,
            user2: friend._id,
            status: 'pending'
        });

        await newFriendship.save();
        res.status(200).json({ message: "Friend request sent successfully." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "An error occurred while sending the friend request." });
    }
});

router.post('/accept-friend-request', async (req, res) => {
    const { userEmail, friendEmail } = req.body;

    // Ensure the token belongs to the correct user
    if (req.user.email !== email) {
        return res.status(403).json({ message: "You are not authorized to update this user's information." });
    }

    try {
        const user = await User.findOne({ email: userEmail });
        const friend = await User.findOne({ email: friendEmail });

        if (!user || !friend) {
            return res.status(404).json({ message: "User(s) not found." });
        }

        const friendship = await Friendship.findOne({
            $or: [
                { user1: user._id, user2: friend._id, status: 'pending' },
                { user1: friend._id, user2: user._id, status: 'pending' }
            ]
        });

        if (!friendship) {
            return res.status(400).json({ message: "No pending friend request found." });
        }

        if (friendship.user2.toString() !== user._id.toString()) {
            return res.status(403).json({
                message: "You can only accept friend requests if you're the recipient of the request."
            });
        }

        friendship.status = 'accepted';
        await friendship.save();

        res.status(200).json({ message: "Friend request accepted." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "An error occurred while accepting the friend request." });
    }
});

router.post('/reject-friend-request', async (req, res) => {
    const { userEmail, friendEmail } = req.body;

    // Ensure the token belongs to the correct user
    if (req.user.email !== email) {
        return res.status(403).json({ message: "You are not authorized to update this user's information." });
    }

    try {
        const user = await User.findOne({ email: userEmail });
        const friend = await User.findOne({ email: friendEmail });

        if (!user || !friend) {
            return res.status(404).json({ message: "User(s) not found." });
        }

        const friendship = await Friendship.findOne({
            $or: [
                { user1: user._id, user2: friend._id, status: 'pending' },
                { user1: friend._id, user2: user._id, status: 'pending' }
            ]
        });

        if (!friendship) {
            return res.status(400).json({ message: "No pending friend request found." });
        }

        if (friendship.user2.toString() !== user._id.toString()) {
            return res.status(403).json({
                message: "You can only reject friend requests if you're the recipient of the request."
            });
        }

        friendship.status = 'rejected';
        await friendship.save();

        res.status(200).json({ message: "Friend request rejected." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "An error occurred while rejecting the friend request." });
    }
});

router.get('/get-friends/:userEmail', async (req, res) => {
    const { userEmail } = req.params;

    // Ensure the token belongs to the correct user
    if (req.user.email !== email) {
        return res.status(403).json({ message: "You are not authorized to update this user's information." });
    }

    try {
        const user = await User.findOne({ email: userEmail });
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const friendships = await Friendship.find({
            $or: [
                { user1: user._id, status: 'accepted' },
                { user2: user._id, status: 'accepted' }
            ]
        }).populate('user1 user2', 'name email'); 

        const friends = friendships.map(friendship => {
            return friendship.user1._id.toString() === user._id.toString() ? friendship.user2 : friendship.user1;
        });

        res.status(200).json({ friends });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "An error occurred while fetching friends." });
    }
});

// Route to unfriend a user
router.post('/unfriend', verifyToken, async (req, res) => {
    const { userIdToUnfriend } = req.body;
    const currentUserId = req.user.userId; // Get the current logged-in user's ID

    if (!userIdToUnfriend) {
        return res.status(400).json({
            status: "FAILED",
            message: "User ID to unfriend is required"
        });
    }

    try {
        // Find the friendship between the current user and the user to unfriend
        const friendship = await Friendship.findOne({
            $or: [
                { user1: currentUserId, user2: userIdToUnfriend },
                { user1: userIdToUnfriend, user2: currentUserId }
            ]
        });

        if (!friendship) {
            return res.status(404).json({
                status: "FAILED",
                message: "Friendship not found"
            });
        }

        // If the friendship status is "accepted", we can remove or update it
        if (friendship.status === 'accepted') {
            // Option 1: Remove the friendship record completely
            await Friendship.deleteOne({ _id: friendship._id });
            
            return res.status(200).json({
                status: "SUCCESS",
                message: "You have unfriended this user"
            });
        } else {
            return res.status(400).json({
                status: "FAILED",
                message: "You are not friends with this user"
            });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({
            status: "FAILED",
            message: "Error unfriending user"
        });
    }
});

module.exports = router;