const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

io.on('connection', (socket) => {
    socket.on('create-room', ({ roomId, password }) => {
        if (!roomId) {
            return socket.emit('error-msg', 'Room ID required!');
        }
        if (rooms[roomId]) {
            return socket.emit('error-msg', 'Room already exists!');
        }
        rooms[roomId] = { password: password || '', members: [] };
        socket.join(roomId);
        socket.emit('room-created', { roomId });
    });

    socket.on('join-room', ({ roomId, password }) => {
        const room = rooms[roomId];
        if (!room) {
            return socket.emit('error-msg', 'Room not found!');
        }
        if (room.password && room.password !== password) {
            return socket.emit('error-msg', 'Incorrect password!');
        }
        socket.join(roomId);
        socket.emit('room-joined', { roomId });
    });

    socket.on('send-message', ({ roomId, message, sender }) => {
        io.to(roomId).emit('receive-message', { message, sender, time: new Date().toLocaleTimeString() });
    });
});

const PORT

