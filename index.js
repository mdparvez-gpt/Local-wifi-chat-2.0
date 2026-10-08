const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    pingTimeout: 60000,
    pingInterval: 25000
});
const os = require('os');
const path = require('path');

const rooms = {};
const activeUsers = {};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on("connection", socket => {
    socket.emit("update-room-list", rooms);
    io.emit("update-user-list", activeUsers);

    socket.on("register-user", (name) => {
        if (name) {
            activeUsers[socket.id] = name;
            io.emit("update-user-list", activeUsers);
        }
    });

    socket.on("create-room", ({ roomId, pass, hostName }) => {
        if (rooms[roomId]) {
            rooms[roomId].hostSocketId = socket.id;
        } else {
            rooms[roomId] = { pass, hostSocketId: socket.id, members: [socket.id] };
        }
        socket.join(roomId);
        socket.emit("room-created", { roomId });
        io.emit("update-room-list", rooms);
    });

    socket.on("direct-join", ({ roomId, pass, name }) => {
        const room = rooms[roomId];
        if (!room) return socket.emit("join-rejected", "Room does not exist!");
        if (room.pass !== pass) return socket.emit("join-rejected", "Incorrect Password!");
        
        socket.join(roomId);
        if (!room.members.includes(socket.id)) room.members.push(socket.id);
        socket.emit("join-approved");
        io.to(roomId).emit("chat-msg", { isSystem: true, msg: name + " reconnected/joined." });
    });

    socket.on("request-join", ({ roomId, name }) => {
        const room = rooms[roomId];
        if (!room) return socket.emit("join-rejected", "Room does not exist!");
        io.to(room.hostSocketId).emit("new-join-request", { requesterId: socket.id, requesterName: name });
    });

    socket.on("host-response", ({ requesterId, accept, roomId }) => {
        if (accept) {
            const targetSocket = io.sockets.sockets.get(requesterId);
            if (targetSocket) {
                targetSocket.join(roomId);
                if (rooms[roomId] && !rooms[roomId].members.includes(requesterId)) {
                    rooms[roomId].members.push(requesterId);
                }
                io.to(requesterId).emit("join-approved");
                io.to(roomId).emit("chat-msg", { isSystem: true, msg: "A new member joined the room." });
            }
        } else { io.to(requesterId).emit("join-rejected", "Host rejected your request."); }
    });

    socket.on("chat-msg", ({ roomId, name, msg, senderId, targetId }) => {
        if (targetId) {
            io.to(targetId).emit("chat-msg", { name, msg, senderId, isPrivate: true, targetId: senderId, senderName: name });
            socket.emit("chat-msg", { name, msg, senderId, isPrivate: true });
        } else if (roomId) {
            io.to(roomId).emit("chat-msg", { name, msg, senderId });
        }
    });

    socket.on("direct-call-user", ({ targetId, name, video, callerId }) => {
        io.to(targetId).emit("incoming-call", { callerId, name, video });
    });

    socket.on("call-user", data => socket.to(data.roomId).emit("incoming-call", data));
    socket.on("send-offer", data => socket.to(data.targetId).emit("receive-offer", { callerId: socket.id, offer: data.offer }));
    socket.on("send-answer", data => socket.to(data.targetId).emit("receive-answer", { answer: data.answer }));
    socket.on("send-ice", data => socket.to(data.targetId).emit("receive-ice", { candidate: data.candidate }));

    socket.on("disconnect", () => {
        delete activeUsers[socket.id];
        io.emit("update-user-list", activeUsers);
    });
});

function getIP() {
    const interfaces = os.networkInterfaces();
    for (let dev in interfaces) {
        for (let details of interfaces[dev]) {
            if (details.family === "IPv4" && !details.internal) return details.address;
        }
    }
    return "localhost";
}

http.listen(3000, "0.0.0.0", () => {
    console.log("\n==================================\nMulti-Room Chat & Call Hub Running At:\nhttp://" + getIP() + ":3000\n==================================\n");
});
