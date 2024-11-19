const {Server} = require('socket.io');
const http = require('http');
const express = require('express');

const app = express();

const server = http.createServer(app);
const io = new Server(server,{
    cors:{
        origin: ["http://127.0.0.1:5500/"], //frontend link
        methods: ["GET", "POST","UPDATE"]
    }
})

io.on('connection',(socket)=> { //listening for connections
    console.log("a user connected", socket.id)

    //socket.on is used to listen to the events, used on both frontend and backend / client and server
    socket.on("disconnect",()=> { //listening for disconnection
        console.log("user disconnected", socket.id)
    })
})

module.exports = app, io, server;