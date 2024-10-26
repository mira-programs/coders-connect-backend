const express = require('express');
const router = express.Router();
const User = require('./../models/User');

router.post('/update-bio', (req,res) => {
    const { email, bio } = req.body;
    if(typeof bio !== 'string' || bio.length <=0){
        return res.status(400).send('Invalid input. Please provide a valid bio.');
    }

    User.findOne({email}).then(user => {
        if (!user) {
            return res.status(404).send('User not found.');
        }
        user.bio = bio;
        return user.save();
    }).then(() => {
        res.status(200).send('Bio updated successfully');
    }).catch(err => {
        console.error(err);
        res.status(500).send('Error updating bio');
    });
});

router.post('/update-occupation', (req,res) => {
    const { email, occupation } = req.body;
    if(typeof occupation !== 'string' || occupation.length <=0){
        return res.status(400).send('Invalid input. Please provide a valid occupation.');
    }

    User.findOne({email}).then(user => {
        if (!user) {
            return res.status(404).send('User not found.');
        }
        user.occupation = occupation;
        return user.save(); 
    }).then(() => {
        res.status(200).send('Occupation updated successfully');
    }).catch(err => {
        console.error(err);
        res.status(500).send('Error updating occupation');
    });
});

router.post('/update-profilepicture', (req,res) => {
    const { email, profilePicture } = req.body;
    if(typeof profilePicture !== 'string' || profilePicture.length <=0){
        return res.status(400).send('Invalid input. Please provide a valid profilePicture');
    }

    User.findOne({email}).then(user => {
        if (!user) {
            return res.status(404).send('User not found.');
        }
        user.profilePicture = profilePicture;
        return user.save(); // Save the updated user
    }).then(() => {
        res.status(200).send('Profile picture updated successfully');
    }).catch(err => {
        console.error(err);
        res.status(500).send('Error updating profile picture');
    });
});

module.exports = router;