const express = require('express');
const router = express.Router();
const User = require('./../models/User');
const verifyToken = require('./../middleware/verifyToken'); 

router.use(verifyToken);

router.post('/update-bio', (req,res) => {
    const { email, bio } = req.body;
    // Ensure the token belongs to the correct user
    if (req.user.email !== email) {
        return res.status(403).json({ message: "You are not authorized to update this user's information." });
    }
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
    // Ensure the token belongs to the correct user
    if (req.user.email !== email) {
        return res.status(403).json({ message: "You are not authorized to update this user's information." });
    }
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
    // Ensure the token belongs to the correct user
    if (req.user.email !== email) {
        return res.status(403).json({ message: "You are not authorized to update this user's information." });
    }
    if(typeof profilePicture !== 'string' || profilePicture.length <=0){
        return res.status(400).send('Invalid input. Please provide a valid profilePicture');
    }

    User.findOne({email}).then(user => {
        if (!user) {
            return res.status(404).send('User not found.');
        }
        user.profilePicture = profilePicture;
        return user.save(); 
    }).then(() => {
        res.status(200).send('Profile picture updated successfully');
    }).catch(err => {
        console.error(err);
        res.status(500).send('Error updating profile picture');
    });
});

router.post('/deactivateAccount', (req,res) => {
    const { email } = req.body;
    // Ensure the token belongs to the correct user
    if (req.user.email !== email) {
        return res.status(403).json({ message: "You are not authorized to update this user's information." });
    }
    User.findOne({email}).then(user => {
        if (!user) {
            return res.status(404).send('User not found.');
        }
        user.deactivated = true;
        return user.save(); 
    }).then(() => {
        res.status(200).send('Deactivated successfully');
    }).catch(err => {
        console.error(err);
        res.status(500).send('Error deactivating');
    });
});

router.post('/deleteAccount', (req,res) => {
    const { email } = req.body;
    // Ensure the token belongs to the correct user
    if (req.user.email !== email) {
        return res.status(403).json({ message: "You are not authorized to update this user's information." });
    }
    User.findOne({email}).then(user => {
        if (!user) {
            return res.status(404).send('User not found.');
        }
        user.deleted = true;
        return user.save(); 
    }).then(() => {
        res.status(200).send('Deleted successfully');
    }).catch(err => {
        console.error(err);
        res.status(500).send('Error deleting');
    });
});

module.exports = router;