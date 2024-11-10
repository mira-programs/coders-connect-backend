//mongodb
require('./config/db');
require('dotenv').config();
const UserRouter = require('./api/User');
const AccountRouter = require('./api/Account');
const FriendshipRouter = require('./api/Friendship');
const PostRouter = require('./api/Post');
const MessageRouter = require('./api/Message');

const express = require('express'); 
const cors = require('cors');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use('/user', UserRouter);
app.use('/account', AccountRouter);
app.use('/friendship', FriendshipRouter);
app.use('/post', PostRouter);
app.use('/message', MessageRouter);


const path = require('path');

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
})