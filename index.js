const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

io.on('connection', (socket) => {
    socket.on('create-room', ({ roomId }) => {
        if (!roomId) return socket.emit('error-msg', 'Room ID required!');
        if (rooms[roomId]) return socket.emit('error-msg', 'Room already exists!');
        rooms[roomId] = { members: [socket.id] };
        socket.join(roomId);
        socket.emit('room-created', { roomId });
    });

    socket.on('join-room', ({ roomId }) => {
        if (!rooms[roomId]) return socket.emit('error-msg', 'Room not found!');
        rooms[roomId].members.push(socket.id);
        socket.join(roomId);
        socket.emit('room-joined', { roomId });
        socket.to(roomId).emit('user-connected', socket.id);
    });

    socket.on('send-message', ({ roomId, message, sender }) => {
        io.to(roomId).emit('receive-message', { message, sender, time: new Date().toLocaleTimeString() });
    });

    // WebRTC Signaling Events (Audio/Video Calling)
    socket.on('offer', (data) => {
        socket.to(data.roomId).emit('offer', data);
    });

    socket.on('answer', (data) => {
        socket.to(data.roomId).emit('answer', data);
    });

    socket.on('candidate', (data) => {
        socket.to(data.roomId).emit('candidate', data);
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running with Audio/Video Call support on http://localhost:${PORT}`);
});
