const mongoose = require('mongoose');
const postSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: false },
    media: { type: String, required: false },
    privacy: { type: String, required: true,enum: ['public', 'friends', 'private'], default: "friends" },
    createdAt: { type: Date, default: Date.now },
    likes: [{ type: mongoose.Schema.ObjectId, ref: "User" }],
    dislikes: [{ type: mongoose.Schema.ObjectId, ref: "User" }],
    comments: [{
        text: String,
        created: { type: Date, default: Date.now },
        postedBy: { type: mongoose.Schema.ObjectId, ref: "User" },
        likes: [{ type: mongoose.Schema.ObjectId, ref: "User",
            isActive: {
                type: Boolean,
                default: true,
            },
        }],
        dislikes: [{ type: mongoose.Schema.ObjectId, ref: "User",
            isActive: {
                type: Boolean,
                default: true,
            },
         }],
        isActive: {
            type: Boolean,
            default: true, 
        },
        replies: [{
            text: String,
            created: { type: Date, default: Date.now },
            postedBy: { type: mongoose.Schema.ObjectId, ref: "User" },
            isActive: {
                type: Boolean,
                default: true,
            },
        }],
    }],
    isActive: {
        type: Boolean,
        default: true,
    },
});

const Post = mongoose.model('Post', postSchema);
module.exports = Post;
