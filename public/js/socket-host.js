let roomId = '';
let socket = null;

async function initNetwork() {
    try {
        const response = await fetch('/api/create-room');
        const data = await response.json();
        roomId = data.roomId;
        
        const roomIdEl = document.getElementById('roomId');
        if (roomIdEl) roomIdEl.textContent = roomId;
        
        socket = io();
        socket.emit('host:join', roomId);
    } catch (err) {
        console.error("Failed to fetch room ID", err);
    }
}

// Ensure the host canvas size is correctly captured for normalization
function getCanvasDims() {
    const hostCanvas = document.getElementById('hostCanvas');
    if (!hostCanvas) return { w: 1, h: 1 };
    return { w: hostCanvas.width || 1, h: hostCanvas.height || 1 };
}

window.socketEmitDraw = function(x, y, px, py, color, brushSize, mode) {
    if(!socket || !roomId) return;
    const { w, h } = getCanvasDims();
    socket.emit('draw:point', roomId, {
        nx: x / w,
        ny: y / h,
        pnx: px / w,
        pny: py / h,
        color: color,
        brushSize: brushSize,
        mode: mode
    });
};

window.socketEmitClear = function() {
    if(socket && roomId) socket.emit('canvas:clear', roomId);
};

window.socketEmitUndo = function() {
    if(socket && roomId) socket.emit('canvas:undo', roomId);
};

window.addEventListener('load', initNetwork);
