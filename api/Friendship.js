const express = require('express');
const router = express.Router();
const Friendship = require('../models/Friendship');
const User = require('../models/User');
const Post = require('../models/Post');
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
        }).populate('user1 user2', 'username email deactivated'); 

        const friends = friendships
            .map(friendship => {
                return friendship.user1._id.toString() === user._id.toString() ? friendship.user2 : friendship.user1;
            })
            .filter(friend => !friend.deactivated);

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

//based on number of posts
router.get('/top-contributor', verifyToken, async (req, res) => {
    const currentUserId = req.user.userId;

    try {
        const friendships = await Friendship.find({
            $or: [
                { user1: currentUserId, status: 'accepted' },
                { user2: currentUserId, status: 'accepted' }
            ]
        }).populate({
            path: 'user1 user2',
            select: 'username email deactivated'
        });

        const activeFriendships = friendships.filter(f => 
            (f.user1._id.toString() === currentUserId && !f.user2.deactivated) ||
            (f.user2._id.toString() === currentUserId && !f.user1.deactivated)
        );

        const friendIds = activeFriendships.map(f => 
            f.user1._id.toString() === currentUserId ? f.user2._id : f.user1._id
        );

        // Aggregate posts count for each friend
        const topContributor = await Post.aggregate([
            { $match: { userId: { $in: friendIds } } },
            { $group: { _id: "$userId", postCount: { $sum: 1 } } },
            { $sort: { postCount: -1 } },
            { $limit: 1 }, // Limit to the top contributor
            { $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'user'
            }},
            { $unwind: "$user" },
            { $project: { _id: 0, postCount: 1, user: "$user" } }
        ]);

        res.status(200).json(topContributor[0] || { message: "No contributors found." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "An error occurred while fetching the top contributor." });
    }
});

//based on likes, dislikes and comments
router.get('/most-active-friend', verifyToken, async (req, res) => {
    const currentUserId = req.user.userId;

    try {
        const friendships = await Friendship.find({
            $or: [
                { user1: currentUserId, status: 'accepted' },
                { user2: currentUserId, status: 'accepted' }
            ]
        }).populate({
            path: 'user1 user2',
            select: 'username email deactivated'
        });

        const activeFriendships = friendships.filter(f => 
            (f.user1._id.toString() === currentUserId && !f.user2.deactivated) ||
            (f.user2._id.toString() === currentUserId && !f.user1.deactivated)
        );

        const friendIds = activeFriendships.map(f => 
            f.user1._id.toString() === currentUserId ? f.user2._id : f.user1._id
        );

        // Aggregate likes, dislikes, and comments count for each friend
        const mostActiveFriend = await Post.aggregate([
            { $group: {
                _id: "$userId",
                totalLikes: { $sum: { $cond: { if: { $isArray: "$likes" }, then: { $size: "$likes" }, else: 0 } } },
                totalDislikes: { $sum: { $cond: { if: { $isArray: "$dislikes" }, then: { $size: "$dislikes" }, else: 0 } } },
                totalComments: { $sum: { $cond: { if: { $isArray: "$comments" }, then: { $size: "$comments" }, else: 0 } } }
            }},
            { $addFields: {
                totalActivity: { $sum: ["$totalLikes", "$totalDislikes", "$totalComments"] }
            }},
            { $sort: { totalActivity: -1 } },
            { $limit: 1 }, // Limit to the most active friend
            { $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'user'
            }},
            { $unwind: "$user" },
            { $project: { _id: 0, totalActivity: 1, user: "$user" } }
        ]);

        res.status(200).json(mostActiveFriend[0] || { message: "No active friends found." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "An error occurred while fetching the most active friend." });
    }
});

router.get('/suggest-friends', verifyToken, async (req, res) => {
    const currentUserId = req.user.userId;

    try {
        // Step 1: Find the 3 most active friends of the current user
        const friendships = await Friendship.find({
            $or: [
                { user1: currentUserId, status: 'accepted' },
                { user2: currentUserId, status: 'accepted' }
            ]
        }).populate({
            path: 'user1 user2',
            select: 'username email deactivated'
        });

        //console.log('Friendships:', friendships);

        const activeFriendships = friendships.filter(f => 
            (f.user1._id.toString() === currentUserId && !f.user2.deactivated) ||
            (f.user2._id.toString() === currentUserId && !f.user1.deactivated)
        );

        const friendIds = activeFriendships.map(f => 
            f.user1._id.toString() === currentUserId ? f.user2._id : f.user1._id
        );
        //console.log('Friend IDs:', friendIds);

        const mostActiveFriends = await Post.aggregate([
            { $group: {
                _id: "$userId",
                totalLikes: { $sum: { $cond: { if: { $isArray: "$likes" }, then: { $size: "$likes" }, else: 0 } } },
                totalDislikes: { $sum: { $cond: { if: { $isArray: "$dislikes" }, then: { $size: "$dislikes" }, else: 0 } } },
                totalComments: { $sum: { $cond: { if: { $isArray: "$comments" }, then: { $size: "$comments" }, else: 0 } } }
            }},
            { $addFields: {
                totalActivity: { $sum: ["$totalLikes", "$totalDislikes", "$totalComments"] }
            }},
            { $sort: { totalActivity: -1 } },
            { $limit: 3 },
            { $project: { _id: 1 } }
        ]);

        //console.log('Most Active Friends:', mostActiveFriends);

        const mostActiveFriendIds = mostActiveFriends.map(f => f._id);

        let suggestions = [];
        for (const friendId of mostActiveFriendIds) {
            const friendFriendships = await Friendship.find({
                $or: [
                    { user1: friendId, status: 'accepted' },
                    { user2: friendId, status: 'accepted' }
                ]
            }).populate({
                path: 'user1 user2',
                select: 'username email deactivated'
            });

            //console.log(`Friendships of Friend ${friendId}:`, friendFriendships);

            const activeFriendships = friendFriendships.filter(f => 
                (f.user1._id.toString() === currentUserId && !f.user2.deactivated) ||
                (f.user2._id.toString() === currentUserId && !f.user1.deactivated)
            );
    
            const friendFriendIds = activeFriendships.map(f => 
                f.user1._id.toString() === currentUserId ? f.user2._id : f.user1._id
            );

            //console.log(`Friend IDs of Friend ${friendId}:`, friendFriendIds);

            const activeFriendsOfFriend = await Post.aggregate([
                { $group: {
                    _id: "$userId",
                    totalLikes: { $sum: { $cond: { if: { $isArray: "$likes" }, then: { $size: "$likes" }, else: 0 } } },
                    totalDislikes: { $sum: { $cond: { if: { $isArray: "$dislikes" }, then: { $size: "$dislikes" }, else: 0 } } },
                    totalComments: { $sum: { $cond: { if: { $isArray: "$comments" }, then: { $size: "$comments" }, else: 0 } } }
                }},
                { $addFields: {
                    totalActivity: { $sum: ["$totalLikes", "$totalDislikes", "$totalComments"] }
                }},
                { $sort: { totalActivity: -1 } },
                { $limit: 3 },
                { $project: { _id: 1 } }
            ]);

            //console.log(`Active Friends of Friend ${friendId}:`, activeFriendsOfFriend);

            suggestions = suggestions.concat(activeFriendsOfFriend.map(f => f._id));
        }

        const uniqueSuggestions = [...new Set(suggestions)]
            .filter(id => !friendIds.includes(id.toString()) && id.toString() !== currentUserId);

        //console.log('Unique Suggestions:', uniqueSuggestions);

        const topSuggestions = uniqueSuggestions.slice(0, 9);

        const suggestedFriends = await User.find({ _id: { $in: topSuggestions } });

        const result = suggestedFriends.map(user => ({
            user: user,
            totalActivity: 0
        }));

        res.status(200).json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "An error occurred while fetching friend suggestions." });
    }
});


module.exports = router;