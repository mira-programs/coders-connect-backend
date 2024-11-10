const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');

router.post("/send/:id", verifyToken, async(req,res) => {
    try{
        const{message} = req.body;
        const{id} = req.params;
        const senderId = req.userId;
    }catch(error){
        console.log("error in send message: ", error.message);
        res.status(500).json({error:"internal server error"});
    }

    console.log('message sent!', req.params.id);
})

module.exports = router;