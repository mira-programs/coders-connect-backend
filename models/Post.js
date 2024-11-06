const mongoose = require('mongoose');
const postSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    media: { type: String, required: false },
    createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', postSchema);
module.exports = Post;
