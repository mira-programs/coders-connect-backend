const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({

    username: {
        type:String,
        required:true,
        unique:true
    },

    email: {
        type: String,
        required: true,
        unique: true
    },

    password: {
        type: String,
        required: true
    },
    
    firstName: {
        type:String,
        required: true
    },

    lastName: {
        type:String,
        required: true
    },

    occupation: {
        type: String,
        required: true
    },

    bio: {
        type: String,
        required: true
    },

    profilePicture: {
        type: String,
        required: true
    },

    verified: {
        type: Boolean,
        required: true,
        default: false
    },

    verificationToken: {
        type: String,
        default: null
    },

    deactivated: {
        type: Boolean,
        default: false
    },
    
    post_count: {
        type: Number,
        default: 0
    },

    activity: {
        type: Number,
        default: 0
    }
})
const User = mongoose.model('User', UserSchema);

module.exports = User;