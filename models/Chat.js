const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ChatSchema = new Schema({

    participants: [{
        type: mongoose.Schema.ObjectId,
        ref: "User",
    }],

    messages: [
        {
            to: {
                type: mongoose.Schema.ObjectId,
                ref: "User",
            },
            from: {
                type: mongoose.Schema.ObjectId,
                ref: "User",
            },
            type: {
                String,
                enum: ["Text", "Media", "Document", "Link"], //type of message 
            },
            createdAt: {
                type: Date,
                default: Date.now(),
            },
            text:{
                type: String,
            },
            file:{
                type: String,
            },

        }
    ],
});

const Chat = new mongoose.model('Chat', ChatSchema);

module.exports = Chat;
