const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

// Store room states
// rooms[roomId] = { hostId: socket.id, history: [] }
const rooms = {};

// Helper: Generate random 9-char Room ID (XXXX-XXXX)
function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 8; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id.substring(0, 4) + '-' + id.substring(4, 8);
}

app.get('/api/create-room', (req, res) => {
    let roomId = generateRoomId();
    while (rooms[roomId]) {
        roomId = generateRoomId();
    }
    rooms[roomId] = { hostId: null, history: [] };
    res.json({ roomId });
});

io.on('connection', (socket) => {
    socket.on('host:join', (roomId) => {
        socket.join(roomId);
        if (!rooms[roomId]) rooms[roomId] = { history: [] };
        rooms[roomId].hostId = socket.id;
        console.log(`Host joined room: ${roomId}`);
        
        // Notify all participants who is the host
        io.to(roomId).emit('webrtc:host-id', socket.id);
    });

    socket.on('participant:join', (roomId) => {
        socket.join(roomId);
        console.log(`Participant joined room: ${roomId}`);
        if (rooms[roomId]) {
            if (rooms[roomId].history) {
                socket.emit('canvas:history', rooms[roomId].history);
            }
            socket.emit('webrtc:host-id', rooms[roomId].hostId);
        }
    });

    // WebRTC Signaling
    socket.on('webrtc:join', (roomId) => {
        socket.to(roomId).emit('webrtc:user-joined', socket.id);
    });
    
    socket.on('webrtc:offer', (roomId, offer, targetId) => {
        socket.to(targetId).emit('webrtc:offer', { senderId: socket.id, offer });
    });
    
    socket.on('webrtc:answer', (roomId, answer, targetId) => {
        socket.to(targetId).emit('webrtc:answer', { senderId: socket.id, answer });
    });
    
    socket.on('webrtc:ice-candidate', (roomId, candidate, targetId) => {
        socket.to(targetId).emit('webrtc:ice-candidate', { senderId: socket.id, candidate });
    });

    socket.on('draw:point', (roomId, data) => {
        if (!rooms[roomId]) return;
        rooms[roomId].history.push({ type: 'draw:point', data });
        socket.to(roomId).emit('draw:point', data);
    });

    socket.on('canvas:clear', (roomId) => {
        if (rooms[roomId]) rooms[roomId].history.push({ type: 'canvas:clear' });
        socket.to(roomId).emit('canvas:clear');
    });

    socket.on('canvas:undo', (roomId) => {
        if (rooms[roomId]) rooms[roomId].history.push({ type: 'canvas:undo' });
        socket.to(roomId).emit('canvas:undo');
    });

    socket.on('disconnect', () => {
        // notify WebRTC peers
        let currentRoomId = null;
        for (const r in rooms) {
            if (rooms[r].hostId === socket.id || socket.rooms.has(r)) {
                currentRoomId = r; // simplistic, assumes single room
            }
        }
        if (currentRoomId) socket.to(currentRoomId).emit('webrtc:user-left', socket.id);

        // Clean up rooms if host left
        for (const roomId in rooms) {
            if (rooms[roomId].hostId === socket.id) {
                socket.to(roomId).emit('host:left');
                setTimeout(() => {
                    delete rooms[roomId]; // Cleanup after a bit
                }, 5000);
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`AirCanvas Server running on http://localhost:${PORT}`);
});
