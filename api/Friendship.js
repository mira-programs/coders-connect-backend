const express = require('express');
const router = express.Router();
const Friendship = require('../models/Friendship');
const User = require('../models/User');
const Post = require('../models/Post');
const {verifyToken} = require('./../middleware/verifyToken'); 

router.post('/send-friend-request', verifyToken, async (req, res) => {
    const { usernameToSend } = req.body; // Change to username

    const currentUserId = req.user.userId;

    if (!usernameToSend) {
        return res.status(400).json({
            status: "FAILED",
            message: "Username to send is required"
        });
    }

    try {
        // Fetch the current user and the recipient user by their usernames
        const currentUser = await User.findById(currentUserId);
        const friend = await User.findOne({ username: usernameToSend }); // Find by username

        if (!currentUser || !friend) {
            return res.status(404).json({ message: "User(s) not found." });
        }

        // Prevent sending a friend request to oneself
        if (currentUser.username === friend.username) {
            return res.status(400).json({ message: "You cannot send a friend request to yourself." });
        }

        // Check if a friendship already exists
        const existingFriendship = await Friendship.findOne({
            $or: [
                { user1: currentUser._id, user2: friend._id },
                { user1: friend._id, user2: currentUser._id }
            ]
        });

        if (existingFriendship) {
            return res.status(400).json({ message: "Friendship request already exists or you're already friends." });
        }

        // Create the new friendship request
        const newFriendship = new Friendship({
            user1: currentUser._id,
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

        // Increment the friend count for both users
        user.friend_count += 1;
        friend.friend_count += 1;

        await user.save();
        await friend.save();

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

router.get('/pending-friend-requests', verifyToken, async (req, res) => {
    const currentUserId = req.user.userId; // Extract the logged-in user's ID from the token

    try {
        // Find all friendships where the logged-in user is the recipient and the status is 'pending'
        const pendingRequests = await Friendship.find({
            user2: currentUserId,
            status: 'pending'
        }).populate('user1', 'username email profilePicture'); // Populate user1 details

        if (!pendingRequests.length) {
            return res.status(200).json({
                message: 'No pending friend requests.',
                pendingRequests: []
            });
        }

        // Format the data
        const formattedRequests = pendingRequests.map(request => ({
            id: request._id,
            fromUser: {
                id: request.user1._id,
                username: request.user1.username,
                email: request.user1.email,
                profilePicture: `${req.protocol}://${req.get('host')}${request.user1.profilePicture.startsWith('/') ? '' : '/'}${request.user1.profilePicture}`
            },
            requestedAt: request.createdAt
        }));

        res.status(200).json({
            message: 'Pending friend requests fetched successfully.',
            pendingRequests: formattedRequests
        });
    } catch (error) {
        console.error('Error fetching pending friend requests:', error.message);
        res.status(500).json({ message: 'Internal server error.' });
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

            // Decrement the friend count for both users
            await User.findByIdAndUpdate(currentUserId, { $inc: { friend_count: -1 } });
            await User.findByIdAndUpdate(userIdToUnfriend, { $inc: { friend_count: -1 } });
            
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
        const topContributors = await User.find({ _id: { $in: friendIds } })
            .sort({ post_count: -1 })
            .limit(3)
            .select('username firstName lastName profilePicture'); 

        res.status(200).json(topContributors || { message: "No contributors found." });
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

        const mostActiveFriend = await User.find({ _id: { $in: friendIds } })
            .sort({ activity: -1 })
            .limit(1)
            .select('username firstName lastName profilePicture'); 

        res.status(200).json(mostActiveFriend || { message: "No active friends found." });
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

        const activeFriendships = friendships.filter(f => 
            (f.user1._id.toString() === currentUserId && !f.user2.deactivated) ||
            (f.user2._id.toString() === currentUserId && !f.user1.deactivated)
        );

        const friendIds = activeFriendships.map(f => 
            f.user1._id.toString() === currentUserId ? f.user2._id : f.user1._id
        );

        // Step 2: Find the 3 most active friends of each of the 3 most active friends
        const mostActiveFriends = await User.find({ _id: { $in: friendIds } })
            .sort({ activity: -1 })
            .limit(3);

        const secondDegreeFriendIds = [];
        for (const friend of mostActiveFriends) {
            const secondDegreeFriendships = await Friendship.find({
                $or: [
                    { user1: friend._id, status: 'accepted' },
                    { user2: friend._id, status: 'accepted' }
                ]
            }).populate({
                path: 'user1 user2',
                select: 'username email deactivated'
            });

            const activeSecondDegreeFriendships = secondDegreeFriendships.filter(f => 
                (f.user1._id.toString() === friend._id.toString() && !f.user2.deactivated) ||
                (f.user2._id.toString() === friend._id.toString() && !f.user1.deactivated)
            );

            const secondDegreeIds = activeSecondDegreeFriendships.map(f => 
                f.user1._id.toString() === friend._id.toString() ? f.user2._id : f.user1._id
            );

            secondDegreeFriendIds.push(...secondDegreeIds);
        }

        const mostActiveSecondDegreeFriends = await User.find({ _id: { $in: secondDegreeFriendIds } })
            .sort({ activity:-1 }) // Sorting based on likes and comments
            .limit(9);

        // Step 4: Filter out friends who are already friends with the current user
        const uniqueSuggestions = mostActiveSecondDegreeFriends.filter(friend => 
            !friendIds.includes(friend._id.toString()) && friend._id.toString() !== currentUserId
        );

        res.status(200).json(uniqueSuggestions);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "An error occurred while fetching friend suggestions." });
    }
});

router.get('/users/not-friends', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Fetch all friendships where the user is involved
        const friendships = await Friendship.find({
            $or: [
                { user1: userId, status: 'accepted' },
                { user2: userId, status: 'accepted' }
            ],
            status: 'accepted'
        });

        // Extract friend IDs
        const friendIds = friendships.map(friendship => 
            friendship.user1.toString() === userId ? friendship.user2 : friendship.user1
        );

        // Add the user's own ID to the list to exclude themselves
        friendIds.push(userId);

        // Fetch users that are not in the friend list
        const usersNotFriends = await User.find({
            _id: { $nin: friendIds }
        });

        res.status(200).json(usersNotFriends);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/search', verifyToken, async (req, res) => {
    const { query } = req.body; // Extract search query from request query string
    if (!query) {
        return res.status(400).json({ message: 'Search query is required.' });
    }

    try {
        const userId = req.user.userId;

        // Fetch all friendships where the user is involved
        const friendships = await Friendship.find({
            $or: [
                { user1: userId, status: 'accepted' },
                { user2: userId, status: 'accepted' }
            ]
        });

        // Extract friend IDs
        const friendIds = friendships.map(friendship =>
            friendship.user1.toString() === userId ? friendship.user2 : friendship.user1
        );

        // Add the user's own ID to the list to exclude themselves
        friendIds.push(userId);

        // Split the query into parts (e.g., "Mira Hamdar" -> ["Mira", "Hamdar"])
        const queryParts = query.split(' ');

        // Build the search condition
        const searchConditions = queryParts.map(part => ({
            $or: [
                { username: { $regex: part, $options: 'i' } },
                { firstName: { $regex: part, $options: 'i' } },
                { lastName: { $regex: part, $options: 'i' } }
            ]
        }));

        // Find users that are not friends and match the search query
        const usersNotFriends = await User.find({
            _id: { $nin: friendIds },
            $and: searchConditions // Match all parts of the query
        }).select('username firstName lastName profilePicture');

        res.status(200).json({
            message: 'Search results fetched successfully.',
            results: usersNotFriends
        });
    } catch (error) {
        console.error('Error searching non-friends:', error.message);
        res.status(500).json({ message: 'Server error.' });
    }
});

module.exports = router;