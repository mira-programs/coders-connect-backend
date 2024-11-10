const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const chatSchema = new mongoose.Schema({

    participants: [{
        type: mongoose.Schema.ObjectId,
        ref: 'User',
    }],

    messages: [{
        type: mongoose.Schema.ObjectId,
        ref: 'Message',
        default: [],
    }
    ],
}, {timestamps: true});

const Chat = new mongoose.model('Chat', chatSchema);
module.exports = Chat;