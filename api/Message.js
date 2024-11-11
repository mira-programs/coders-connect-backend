const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
import Chat from '../models/Chat';

router.post("/send/:id", verifyToken, async(req,res) => {
    try{
        const{message} = req.body;
        const{id: receiverId} = req.params;
        const senderId = req.user._id;

        const chat = await Chat.findOne({
            participants: {$all: [senderId, receiverId]},
        })

        if(!chat){
            chat = await Chat.create({
                participants: [senderId, receiverId],
            })
        }

        const newMessage = new Message({
            senderId: senderId,
            receiverId: receiverId,
            message: message,
        })

        if(newMessage){
            chat.messages.push(newMessage._id);
        }

        res.status.json(newMessage);

    }catch(error){
        console.log("error in send message: ", error.message);
        res.status(500).json({error:"internal server error"});
    }

    console.log('message sent!', req.params.id);
})

module.exports = router;