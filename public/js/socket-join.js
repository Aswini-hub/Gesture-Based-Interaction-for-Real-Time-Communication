const urlParams = new URLSearchParams(window.location.search);
const room = urlParams.get('room');
let socket = null;

// Viewer Canvas references
let viewerCanvas, vCtx;

// History state
let historyLog = [];

function initViewerCanvas() {
    viewerCanvas = document.getElementById('viewerCanvas');
    if(!viewerCanvas) return;
    vCtx = viewerCanvas.getContext('2d');
    
    // Set some initial dimensions if needed; resize later to match parent or video
    const wrapper = document.querySelector('.canvas-wrapper');
    if(wrapper) {
        viewerCanvas.width = wrapper.clientWidth;
        viewerCanvas.height = wrapper.clientHeight;
    } else {
        viewerCanvas.width = 1280;
        viewerCanvas.height = 720;
    }
    
    // Auto-resize logic
    window.addEventListener('resize', () => {
        const wrapper = document.querySelector('.canvas-wrapper');
        if(wrapper) {
            viewerCanvas.width = wrapper.clientWidth;
            viewerCanvas.height = wrapper.clientHeight;
            redrawHistory(); // Redraw on resize to maintain correct aspect
        }
    });
}

function processAction(action) {
    if (!vCtx || !viewerCanvas) return;
    
    if (action.type === 'draw:point') {
        const { nx, ny, pnx, pny, color, brushSize, mode } = action.data;
        const w = viewerCanvas.width;
        const h = viewerCanvas.height;
        let x = nx * w;
        let y = ny * h;
        let px = pnx * w;
        let py = pny * h;

        // If Host uses transform: scaleX(-1); coordinates might be flipped horizontally
        // Let's assume the host js applies its drawing, we just copy exactly what they sent globally.
        
        vCtx.beginPath();
        vCtx.moveTo(px, py);
        vCtx.lineTo(x, y);
        vCtx.strokeStyle = color || '#ff0000';
        vCtx.lineWidth = brushSize || 5;
        vCtx.lineCap = 'round';
        
        if(mode === 'erase') {
             vCtx.globalCompositeOperation = 'destination-out';
             vCtx.lineWidth = brushSize ? brushSize * 5 : 25;
        } else {
             vCtx.globalCompositeOperation = 'source-over';
        }
        
        vCtx.stroke();
    } else if (action.type === 'canvas:clear') {
        vCtx.clearRect(0, 0, viewerCanvas.width, viewerCanvas.height);
    }
}

function redrawHistory() {
    if (!vCtx || !viewerCanvas) return;
    vCtx.clearRect(0, 0, viewerCanvas.width, viewerCanvas.height);
    
    let computedHistory = [];
    for(let i=0; i<historyLog.length; i++) {
        if(historyLog[i].type === 'canvas:undo') {
            // Very simple undo approximation: pop the last X continuous draw actions
            // or just the last action
            let j = computedHistory.length - 1;
            let removedStroke = false;
            // pop all points until a gap is found or we pop a chunk
            while(j >= 0 && computedHistory[j].type === 'draw:point') {
                computedHistory.pop();
                j--;
                removedStroke = true;
                // in a real app, track start/end of paths based on IDLE mode. 
                // For safety we pop until 50 points or the start
                if (historyLog.length - j > 50) break; 
            }
            if(!removedStroke && j >= 0) computedHistory.pop(); // pop a clear
        } else {
            computedHistory.push(historyLog[i]);
        }
    }
    
    computedHistory.forEach(action => processAction(action));
}

function connectToSocket(roomId) {
    socket = io();
    
    socket.emit('participant:join', roomId);
    
    socket.on('canvas:history', (history) => {
        historyLog = history;
        redrawHistory();
    });
    
    socket.on('draw:point', (data) => {
        historyLog.push({ type: 'draw:point', data });
        processAction({ type: 'draw:point', data });
        
        // Hide placeholder if video/drawing stream active
        const placeholder = document.getElementById('viewerPlaceholder');
        if (placeholder) placeholder.style.display = 'none';

        const vidStatus = document.getElementById('videoStatus');
        if (vidStatus) {
            vidStatus.className = 'status-indicator status-active';
            vidStatus.querySelector('.status-text').textContent = 'Live';
        }

        const syncStatus = document.getElementById('syncStatus');
        if (syncStatus) {
            syncStatus.className = 'status-indicator status-active';
            syncStatus.querySelector('.status-text').textContent = 'Synced';
        }
    });
    
    socket.on('canvas:clear', () => {
        historyLog.push({ type: 'canvas:clear' });
        if(vCtx) vCtx.clearRect(0, 0, viewerCanvas.width, viewerCanvas.height);
    });
    
    socket.on('canvas:undo', () => {
        historyLog.push({ type: 'canvas:undo' });
        redrawHistory();
    });
    
    socket.on('host:left', () => {
        const connStatus = document.getElementById('connectionStatus');
        if (connStatus) {
            connStatus.className = 'status-indicator status-inactive';
            connStatus.querySelector('.status-text').textContent = 'Host Left';
        }
    });
}

window.addEventListener('load', () => {
    if (room) {
        const joinForm = document.getElementById('joinForm');
        if(joinForm) joinForm.style.display = 'none';

        const viewerSection = document.getElementById('viewerSection');
        if(viewerSection) viewerSection.classList.remove('hidden');

        const connectedRoomId = document.getElementById('connectedRoomId');
        if(connectedRoomId) connectedRoomId.textContent = room;
        
        const connStatus = document.getElementById('connectionStatus');
        if(connStatus) {
            connStatus.className = 'status-indicator status-active';
            connStatus.querySelector('.status-text').textContent = 'Connected';
        }

        initViewerCanvas();
        connectToSocket(room);
    } else {
       // display normally or wait for form
       const joinBtn = document.getElementById('joinBtn');
       if(joinBtn) {
           joinBtn.addEventListener('click', () => {
               const val = document.getElementById('roomIdInput').value;
               if(val) window.location.href = `?room=${val}`;
           });
       }
    }
});
