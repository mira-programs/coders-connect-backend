const express = require('express');
const router = express.Router();
const Friendship = require('../models/Friendship');
const User = require('../models/User');
const verifyToken = require('./../middleware/verifyToken'); 

router.post('/send-friend-request',verifyToken, async (req, res) => {
    const {userIdToSend} = req.body;

    const currentUserId = req.user.userId; 

    if (!userIdToSend) {
        return res.status(400).json({
            status: "FAILED",
            message: "User ID to send is required"
        });
    }

    if (userIdToSend === currentUserId) {
        return res.status(400).json({ message: "You cannot send a friend request to yourself." });
    }

    try {
        const user = await User.findById(currentUserId);
        const friend = await User.findById(userIdToSend);

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

router.post('/accept-friend-request',verifyToken, async (req, res) => {
    const { userIdToAccept } = req.body;
    const currentUserId = req.user.userId;

    if (!userIdToAccept) {
        return res.status(400).json({
            status: "FAILED",
            message: "User ID to accept is required"
        });
    }

    if (userIdToAccept === currentUserId) {
        return res.status(400).json({ message: "You cannot accept a friend request to yourself." });
    }

    try {
        const user = await User.findById( currentUserId );
        const friend = await User.findById(userIdToAccept);

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

router.post('/reject-friend-request', verifyToken, async (req, res) => {
    const {userIdToReject } = req.body;
    const currentUserId = req.user.userId;

    if (!userIdToReject) {
        return res.status(400).json({
            status: "FAILED",
            message: "User ID to reject is required"
        });
    }

    if (userIdToReject === currentUserId) {
        return res.status(400).json({ message: "You cannot reject a friend request to yourself." });
    }

    try {
        const user = await User.findById(currentUserId);
        const friend = await User.findById(userIdToReject);

        if (!user || !friend) {
            return res.status(404).json({ message: "User(s) not found." });
        }

        const friendship = await Friendship.findOne({
            $or: [
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

        await Friendship.deleteOne({ _id: friendship._id });

        res.status(200).json({ message: "Friend request rejected." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "An error occurred while rejecting the friend request." });
    }
});

router.get('/get-friends',verifyToken, async (req, res) => {
    const currentUserId = req.user.userId;

    try {
        const user = await User.findById(currentUserId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const friendships = await Friendship.find({
            $or: [
                { user1: user._id, status: 'accepted' },
                { user2: user._id, status: 'accepted' }
            ]
        }).populate('user1 user2', 'name email'); 

        
        const friends = friendships
            .map(friendship => {
                return friendship.user1._id.toString() === user._id.toString() ? friendship.user2 : friendship.user1;
            })
            .filter(friend => friend.status !== 'deactivated');

        res.status(200).json({ friends });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "An error occurred while fetching friends." });
    }
});

router.post('/unfriend', verifyToken, async (req, res) => {
    const { userIdToUnfriend } = req.body;
    const currentUserId = req.user.userId; 

    if (!userIdToUnfriend) {
        return res.status(400).json({
            status: "FAILED",
            message: "User ID to unfriend is required"
        });
    }

    if (userIdToUnfriend === currentUserId) {
        return res.status(400).json({ message: "You cannot unfriend yourself." });
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

        if (friendship.status === 'accepted') {
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