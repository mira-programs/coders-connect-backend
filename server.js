// mongodb
require('./config/db');
require('dotenv').config();
const UserRouter = require('./api/User');
const AccountRouter = require('./api/Account');
const FriendshipRouter = require('./api/Friendship');
const PostRouter = require('./api/Post');
const MessageRouter = require('./api/Message');

const express = require('express');
const cors = require('cors');
const http = require('http');  // We will use http to handle WebSocket connections
const socketIo = require('socket.io');  // Import socket.io

const app = express();
const server = http.createServer(app);  // Create HTTP server from Express app

// CORS configuration for both HTTP and WebSocket
const corsOptions = {
  origin: 'http://127.0.0.1:5500',  // Frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));  // Apply CORS for REST API routes

// Initialize Socket.IO with the same CORS configuration
const io = socketIo(server, {
  cors: corsOptions
});

const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// routes
app.use('/user', UserRouter);
app.use('/account', AccountRouter);
app.use('/friendship', FriendshipRouter);
app.use('/post', PostRouter);
app.use('/message', MessageRouter);

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Listen for Socket.IO events
io.on('connection', (socket) => {
  console.log('A user connected: ', socket.id);

  // Listen for events from the client
  socket.on('disconnect', () => {
    console.log('A user disconnected: ', socket.id);
  });

  
});

// Start the server
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
