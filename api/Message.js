const express = require('express');
const router = express.Router();
const {verifyToken} = require('../middleware/verifyToken');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const mongoose = require('mongoose');

router.get("/getUsersForSidebar", verifyToken, async (req, res) => {
    try {
        const loggedInUserId = req.user.userId;

        // Find all users except the logged-in user and exclude password
        const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } })
            .select("-password");

        // Loop through the filtered users and update the profilePicture URL
        const usersWithFullPfp = filteredUsers.map(user => {
            if (user.profilePicture) {
                // Check if profilePicture is relative and add full URL
                if (!user.profilePicture.startsWith('http://') && !user.profilePicture.startsWith('https://')) {
                    user.profilePicture = `${req.protocol}://${req.get('host')}${user.profilePicture.startsWith('/') ? '' : '/'}${user.profilePicture}`;
                }
            }
            return user;
        });

        // Send the users with the updated profilePicture URLs
        res.status(200).json(usersWithFullPfp);
    } catch (error) {
        console.log("Error in getUsersForSidebar: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});


//get chat and messages between current user and another user
router.get("/:id", verifyToken, async (req, res) => {
    try {

        const { id: userToChatId } = req.params;
        const senderId = req.user.userId;

        const chat = await Chat.findOne({
            participants: {$all: [senderId, userToChatId]},
        }).populate("messages");
        if(!chat) return res.status(200).json([]);
        const messages = chat.messages;
        res.status(200).json(messages);
    } catch (error) {
        console.log("error in get messages: ", error.message);
        res.status(500).json({ error: "internal server error" });
    }
})

//send a message to a user
router.post("/send/:id", verifyToken, async (req, res) => {
    try {
        const { message } = req.body;
        const { id: receiverId } = req.params;
        const senderId = req.user.userId;

        if (!senderId) {
            console.log('no sender id');
        }

        if (senderId == receiverId) {
            console.log('cant send message to yourself');
            return res.status(401).json("cannot message yourself");
        }

        let chat = await Chat.findOne({
            participants: { $all: [senderId, receiverId] },
        })

        if (!chat) {
            chat = await Chat.create({
                participants: [senderId, receiverId],
            })
        }

        const newMessage = new Message({
            senderId: senderId,
            receiverId: receiverId,
            message: message,
        })

        if (newMessage) {
            chat.messages.push(newMessage._id);
        }

        //socketio will go here

        // await chat.save();
        // await newMessage.save();
        await Promise.all([chat.save(), newMessage.save()]);

        res.status(201).json(newMessage);

    } catch (error) {
        console.log("error in send message: ", error.message);
        res.status(500).json({ error: "internal server error" });
    }
})

module.exports = router;