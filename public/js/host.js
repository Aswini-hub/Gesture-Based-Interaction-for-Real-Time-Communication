/**
 * Host Meeting Page JavaScript
 * Gesture-Enhanced Online Meeting Platform - AirCanvas
 * 
 * Handles webcam access, MediaPipe hand tracking, drawing logic,
 * gesture-based color picking, erase mode, undo/save, and session management
 */

// ============ Global Variables ============
let stream = null;
let hands = null;
let camera = null;
let canvas = null;
let ctx = null;
let trackingCanvas = null;
let trackingCtx = null;
let isAirCanvasEnabled = false;
let currentGesture = { mode: 'none', position: { x: 0, y: 0 } };
let lastDrawPosition = null;
let roomId = null;
let sessionActive = false;

// Drawing settings
const drawingConfig = {
    color: '#4DA3FF',
    lineWidth: 4,
    eraserRadius: 24
};

// Gesture debounce system
const gestureBuffer = [];
const GESTURE_BUFFER_SIZE = 5;
const GESTURE_THRESHOLD = 3;
let stableGesture = 'none';

// Position smoothing
const positionBuffer = [];
const POSITION_BUFFER_SIZE = 3;

// Stroke history for undo
const strokeHistory = [];
const MAX_HISTORY = 20;
let isNewStroke = true;

// On-screen color picker
const colorBarColors = [
    { color: '#4DA3FF', label: 'Blue' },
    { color: '#FF4D4D', label: 'Red' },
    { color: '#4DFF88', label: 'Green' },
    { color: '#FFD14D', label: 'Yellow' },
    { color: '#FFFFFF', label: 'White' },
    { color: '#FF6BF0', label: 'Pink' }
];
const brushSizes = [
    { size: 3, label: 'S' },
    { size: 6, label: 'M' },
    { size: 10, label: 'L' },
    { size: 16, label: 'XL' }
];
let colorBarVisible = false;
let hoveredColorIndex = -1;
let hoveredSizeIndex = -1;
let colorDwellTimer = null;
let sizeDwellTimer = null;
const DWELL_TIME = 400; // ms to dwell to select

// ============ DOM Elements ============
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('hostCanvas');
const trackingCanvasEl = document.getElementById('trackingOverlay');
const videoPlaceholder = document.getElementById('videoPlaceholder');
const roomIdDisplay = document.getElementById('roomId');

// Status indicators & Panels
const cameraStatusEl = document.getElementById('cameraStatus');
const gestureModeEl = document.getElementById('gestureMode');
const trackingStatusEl = document.getElementById('trackingStatus');
const videoWorkspace = document.getElementById('videoWorkspace');

// Buttons & Toggles
const startCameraBtn = document.getElementById('startCameraBtn');
const toggleMicBtn = document.getElementById('toggleMicBtn');
const toggleVideoBtn = document.getElementById('toggleVideoBtn');
const aircanvasToggle = document.getElementById('aircanvasToggle');
const toggleLabel = document.getElementById('toggleLabel');
const statusDetail = document.getElementById('statusDetail');
const clearCanvasBtn = document.getElementById('clearCanvasBtn');
const undoBtn = document.getElementById('undoBtn');
const saveCanvasBtn = document.getElementById('saveCanvasBtn');
const endSessionBtn = document.getElementById('endSessionBtn');

// Sync loop variable
let sessionSyncInterval = null;

// ============ Initialization ============
document.addEventListener('DOMContentLoaded', () => {
    console.log('Host Meeting Page Loaded');

    // Initialize drawing canvas
    canvas = canvasElement;
    ctx = canvas.getContext('2d');

    // Initialize tracking overlay canvas
    trackingCanvas = trackingCanvasEl;
    trackingCtx = trackingCanvas.getContext('2d');

    // Generate unique room ID
    roomId = generateRoomId();
    roomIdDisplay.textContent = roomId;

    // Set up event listeners
    setupEventListeners();
});

// ============ Event Listeners ============
function setupEventListeners() {
    startCameraBtn.addEventListener('click', startCamera);
    if(toggleMicBtn) toggleMicBtn.addEventListener('click', toggleHostMic);
    if(toggleVideoBtn) toggleVideoBtn.addEventListener('click', toggleHostVideo);

    // Modern Toggle Listener
    aircanvasToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            enableAirCanvas();
        } else {
            disableAirCanvas();
        }
    });

    clearCanvasBtn.addEventListener('click', clearCanvas);
    undoBtn.addEventListener('click', undoLastStroke);
    saveCanvasBtn.addEventListener('click', saveCanvasAsImage);
    endSessionBtn.addEventListener('click', endSession);

    // Clean up on page unload
    window.addEventListener('beforeunload', cleanupSession);
}

// ============ Camera & MediaPipe Functions ============

/**
 * Start webcam and initialize video stream
 */
async function startCamera() {
    try {
        startCameraBtn.disabled = true;
        startCameraBtn.innerHTML = '<span class="btn-icon">⏳</span> Starting...';

        // Request webcam access
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: true
        });
        window.localMediaStream = stream;

        // Set video source
        videoElement.srcObject = stream;

        // Wait for video to load
        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                // Set both canvases to match video size
                canvas.width = videoElement.videoWidth;
                canvas.height = videoElement.videoHeight;
                trackingCanvas.width = videoElement.videoWidth;
                trackingCanvas.height = videoElement.videoHeight;
                resolve();
            };
        });

        // Hide placeholder, show video
        videoPlaceholder.style.display = 'none';
        videoElement.style.display = 'block';

        // Update UI
        updateStatus(cameraStatusEl, 'Camera Active', true);
        updateStatus(trackingStatusEl, 'Waiting', false);
        startCameraBtn.innerHTML = '<span class="btn-icon">📷</span> Camera Started';
        aircanvasToggle.disabled = false;
        if (toggleMicBtn) toggleMicBtn.disabled = false;
        if (toggleVideoBtn) toggleVideoBtn.disabled = false;
        statusDetail.textContent = 'Mode: Ready';
        clearCanvasBtn.disabled = false;
        undoBtn.disabled = false;
        saveCanvasBtn.disabled = false;
        endSessionBtn.disabled = false;
        sessionActive = true;

        if (window.startWebRTC) window.startWebRTC();

        console.log('Camera started successfully');
    } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Failed to access camera. Please ensure you have granted camera permissions.');
        startCameraBtn.disabled = false;
        startCameraBtn.innerHTML = '<span class="btn-icon">📷</span> Start Camera';
    }
}

let micEnabled = true;
let videoEnabled = true;

const iconMicOn = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>`;
const iconMicOff = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="22" y1="2" y2="22"></line><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"></path><path d="M5 10v2a7 7 0 0 0 12 5l-2.7-2.7a3 3 0 0 1-4.6-4.6L5 7.6V10Z"></path><path d="M12 2a3 3 0 0 0-3 3v2l6 6V5a3 3 0 0 0-3-3Z"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>`;
const iconVidOn = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"></path><rect x="2" y="6" width="14" height="12" rx="2"></rect></svg>`;
const iconVidOff = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"></path><rect x="2" y="6" width="14" height="12" rx="2"></rect><line x1="2" x2="22" y1="2" y2="22"></line></svg>`;

function toggleHostMic() {
    if(!stream) return;
    micEnabled = !micEnabled;
    stream.getAudioTracks().forEach(t => t.enabled = micEnabled);
    if(toggleMicBtn) {
        toggleMicBtn.innerHTML = micEnabled ? iconMicOn : iconMicOff;
        toggleMicBtn.className = micEnabled ? 'btn btn-secondary' : 'btn btn-danger';
    }
}

function toggleHostVideo() {
    if(!stream) return;
    videoEnabled = !videoEnabled;
    stream.getVideoTracks().forEach(t => t.enabled = videoEnabled);
    if(toggleVideoBtn) {
        toggleVideoBtn.innerHTML = videoEnabled ? iconVidOn : iconVidOff;
        toggleVideoBtn.className = videoEnabled ? 'btn btn-secondary' : 'btn btn-danger';
    }
}

/**
 * Enable AirCanvas hand tracking & drawing
 */
async function enableAirCanvas() {
    console.log("AirCanvas ON");
    try {
        aircanvasToggle.disabled = true;
        toggleLabel.textContent = 'INIT...';
        statusDetail.textContent = 'Mode: Initializing...';

        // Initialize MediaPipe Hands
        hands = initializeMediaPipeHands(onHandsResults);

        // Initialize camera for MediaPipe
        camera = initializeCamera(videoElement, hands);

        // Start camera processing
        await camera.start();

        isAirCanvasEnabled = true;
        toggleLabel.textContent = 'ON';
        statusDetail.textContent = 'Mode: AirCanvas Enabled';
        aircanvasToggle.disabled = false;

        // Add premium glow effect
        videoWorkspace.classList.add('active-glow');

        console.log('AirCanvas hand tracking started');
    } catch (error) {
        console.error('Error initializing AirCanvas:', error);
        alert('Failed to initialize AirCanvas. Please check camera permissions.');
        aircanvasToggle.checked = false;
        toggleLabel.textContent = 'OFF';
        statusDetail.textContent = 'Mode: Error';
        aircanvasToggle.disabled = false;
    }
}

/**
 * Disable AirCanvas & stop tracking
 */
function disableAirCanvas() {
    console.log("AirCanvas OFF");
    if (camera) {
        camera.stop();
    }
    isAirCanvasEnabled = false;
    toggleLabel.textContent = 'OFF';
    statusDetail.textContent = 'Mode: AirCanvas Disabled';
    updateStatus(gestureModeEl, 'No Gesture', false);
    updateStatus(trackingStatusEl, 'Inactive', false);
    videoWorkspace.classList.remove('active-glow');

    // Clear tracking overlay
    if (trackingCtx) {
        trackingCtx.clearRect(0, 0, trackingCanvas.width, trackingCanvas.height);
    }
    colorBarVisible = false;

    console.log('AirCanvas hand tracking stopped');
}

// ============ Gesture Debounce ============

/**
 * Add a gesture to the buffer and return the stable gesture
 * @param {string} gesture - Raw detected gesture mode
 * @returns {string} Stabilized gesture mode
 */
function getStableGesture(gesture) {
    gestureBuffer.push(gesture);
    if (gestureBuffer.length > GESTURE_BUFFER_SIZE) {
        gestureBuffer.shift();
    }

    // Count occurrences of each gesture in buffer
    const counts = {};
    gestureBuffer.forEach(g => {
        counts[g] = (counts[g] || 0) + 1;
    });

    // Find gesture with highest count
    let maxCount = 0;
    let dominant = stableGesture; // default to current stable
    for (const [g, count] of Object.entries(counts)) {
        if (count > maxCount) {
            maxCount = count;
            dominant = g;
        }
    }

    // Only switch if dominant gesture meets threshold
    if (maxCount >= GESTURE_THRESHOLD) {
        if (dominant !== stableGesture) {
            // Gesture changed — mark new stroke needed
            isNewStroke = true;
            lastDrawPosition = null;
        }
        stableGesture = dominant;
    }

    return stableGesture;
}

// ============ Position Smoothing ============

/**
 * Smooth the position using a rolling average
 * @param {object} rawPos - Raw {x, y} position
 * @returns {object} Smoothed {x, y} position
 */
function smoothPosition(rawPos) {
    positionBuffer.push({ x: rawPos.x, y: rawPos.y });
    if (positionBuffer.length > POSITION_BUFFER_SIZE) {
        positionBuffer.shift();
    }

    let sumX = 0, sumY = 0;
    positionBuffer.forEach(p => {
        sumX += p.x;
        sumY += p.y;
    });

    return {
        x: sumX / positionBuffer.length,
        y: sumY / positionBuffer.length
    };
}

// ============ MediaPipe Results ============

/**
 * MediaPipe hands results callback
 * @param {object} results - Hand detection results from MediaPipe
 */
function onHandsResults(results) {
    if (!isAirCanvasEnabled) return;

    // Clear tracking overlay every frame
    trackingCtx.clearRect(0, 0, trackingCanvas.width, trackingCanvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        // Detect and stabilize gesture
        const rawGesture = GestureDetector.detectGesture(landmarks);
        const stableMode = getStableGesture(rawGesture.mode);
        const smoothedPos = smoothPosition(rawGesture.position);

        currentGesture = { mode: stableMode, position: smoothedPos };

        // Update tracking status
        updateStatus(trackingStatusEl, 'Detected', true);

        // Handle based on gesture mode
        if (stableMode === 'draw') {
            updateStatus(gestureModeEl, 'Draw Mode', true);
            handleDrawing(smoothedPos);
            drawTrackingOverlay(smoothedPos, 'Drawing', drawingConfig.color);
            hideColorBar();
        } else if (stableMode === 'select') {
            updateStatus(gestureModeEl, 'Select Mode', true, 'warning');
            lastDrawPosition = null;
            isNewStroke = true;
            showColorBar();
            handleColorBarHover(smoothedPos);
            drawTrackingOverlay(smoothedPos, 'Pick Color', '#FFD14D');
        } else if (stableMode === 'erase') {
            updateStatus(gestureModeEl, 'Erase Mode', true, 'danger');
            handleErasing(smoothedPos);
            drawEraserOverlay(smoothedPos);
            hideColorBar();
        } else {
            updateStatus(gestureModeEl, 'Idle', false);
            lastDrawPosition = null;
            isNewStroke = true;
            hideColorBar();
            drawTrackingOverlay(smoothedPos, 'Idle', '#6C7C8C');
        }
    } else {
        updateStatus(gestureModeEl, 'No Hand', false);
        updateStatus(trackingStatusEl, 'Lost', false);
        lastDrawPosition = null;
        isNewStroke = true;
        hideColorBar();
    }
}

// ============ Drawing ============

/**
 * Handle drawing on canvas based on finger position
 * @param {object} position - Normalized position {x, y} (0-1 range)
 */
function handleDrawing(position) {
    const x = position.x * canvas.width;
    const y = position.y * canvas.height;

    // Save snapshot for undo before starting a new stroke
    if (isNewStroke) {
        saveStrokeSnapshot();
        isNewStroke = false;
    }

    if (lastDrawPosition) {
        // Use quadratic bezier for smooth curves
        const midX = (lastDrawPosition.x + x) / 2;
        const midY = (lastDrawPosition.y + y) / 2;

        ctx.strokeStyle = drawingConfig.color;
        ctx.lineWidth = drawingConfig.lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'source-over';

        ctx.beginPath();
        ctx.moveTo(lastDrawPosition.x, lastDrawPosition.y);
        ctx.quadraticCurveTo(lastDrawPosition.x, lastDrawPosition.y, midX, midY);
        ctx.stroke();

        if (window.socketEmitDraw) {
            window.socketEmitDraw(x, y, lastDrawPosition.x, lastDrawPosition.y, drawingConfig.color, drawingConfig.lineWidth, 'draw');
        }
    }

    lastDrawPosition = { x, y };
}

/**
 * Handle erasing on canvas
 * @param {object} position - Normalized position {x, y} (0-1 range)
 */
function handleErasing(position) {
    const x = position.x * canvas.width;
    const y = position.y * canvas.height;

    // Save snapshot for undo before starting a new erase stroke
    if (isNewStroke) {
        saveStrokeSnapshot();
        isNewStroke = false;
    }

    // Erase using destination-out compositing
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, drawingConfig.eraserRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    if (window.socketEmitDraw) {
        window.socketEmitDraw(x, y, x, y, drawingConfig.color, drawingConfig.eraserRadius, 'erase');
    }
}

// ============ Tracking Overlay ============

/**
 * Mirror x-coordinate for the tracking overlay.
 * The tracking overlay canvas does NOT have CSS scaleX(-1),
 * so we flip x manually to match the mirrored video.
 */
function mirrorX(normalizedX) {
    return 1 - normalizedX;
}

/**
 * Draw fingertip tracking dot and gesture label
 */
function drawTrackingOverlay(position, label, color) {
    const x = mirrorX(position.x) * trackingCanvas.width;
    const y = position.y * trackingCanvas.height;

    // Fingertip dot with glow
    trackingCtx.save();
    trackingCtx.shadowColor = color;
    trackingCtx.shadowBlur = 15;
    trackingCtx.fillStyle = color;
    trackingCtx.beginPath();
    trackingCtx.arc(x, y, 8, 0, Math.PI * 2);
    trackingCtx.fill();

    // Inner bright dot
    trackingCtx.shadowBlur = 0;
    trackingCtx.fillStyle = '#FFFFFF';
    trackingCtx.beginPath();
    trackingCtx.arc(x, y, 3, 0, Math.PI * 2);
    trackingCtx.fill();
    trackingCtx.restore();

    // Gesture label
    trackingCtx.save();
    trackingCtx.font = 'bold 14px Inter, sans-serif';
    trackingCtx.textAlign = 'center';

    // Background pill for label
    const textWidth = trackingCtx.measureText(label).width;
    const pillX = x - textWidth / 2 - 10;
    const pillY = y - 35;
    const pillW = textWidth + 20;
    const pillH = 24;

    trackingCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    trackingCtx.beginPath();
    trackingCtx.roundRect(pillX, pillY, pillW, pillH, 12);
    trackingCtx.fill();

    trackingCtx.fillStyle = color;
    trackingCtx.fillText(label, x, pillY + 17);
    trackingCtx.restore();
}

/**
 * Draw eraser cursor overlay
 */
function drawEraserOverlay(position) {
    const x = mirrorX(position.x) * trackingCanvas.width;
    const y = position.y * trackingCanvas.height;

    // Eraser circle
    trackingCtx.save();
    trackingCtx.strokeStyle = '#FF6B6B';
    trackingCtx.lineWidth = 2;
    trackingCtx.setLineDash([4, 4]);
    trackingCtx.beginPath();
    trackingCtx.arc(x, y, drawingConfig.eraserRadius, 0, Math.PI * 2);
    trackingCtx.stroke();
    trackingCtx.setLineDash([]);

    // Label
    trackingCtx.font = 'bold 14px Inter, sans-serif';
    trackingCtx.textAlign = 'center';
    const label = 'Erasing';
    const textWidth = trackingCtx.measureText(label).width;
    const pillX = x - textWidth / 2 - 10;
    const pillY = y - drawingConfig.eraserRadius - 32;
    const pillW = textWidth + 20;
    const pillH = 24;

    trackingCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    trackingCtx.beginPath();
    trackingCtx.roundRect(pillX, pillY, pillW, pillH, 12);
    trackingCtx.fill();

    trackingCtx.fillStyle = '#FF6B6B';
    trackingCtx.fillText(label, x, pillY + 17);
    trackingCtx.restore();
}

// ============ On-Screen Color Picker ============

/**
 * Show the color bar on the tracking overlay
 */
function showColorBar() {
    colorBarVisible = true;
    drawColorBar();
}

/**
 * Hide the color bar
 */
function hideColorBar() {
    if (colorBarVisible) {
        colorBarVisible = false;
        hoveredColorIndex = -1;
        hoveredSizeIndex = -1;
        clearDwellTimers();
    }
}

/**
 * Clear dwell timers
 */
function clearDwellTimers() {
    if (colorDwellTimer) { clearTimeout(colorDwellTimer); colorDwellTimer = null; }
    if (sizeDwellTimer) { clearTimeout(sizeDwellTimer); sizeDwellTimer = null; }
}

/**
 * Draw the color bar on the tracking overlay canvas
 */
function drawColorBar() {
    if (!colorBarVisible) return;

    const cw = trackingCanvas.width;
    const totalItems = colorBarColors.length + brushSizes.length + 1; // +1 for separator
    const itemSize = 40;
    const gap = 12;
    const separatorWidth = 16;
    const totalWidth = colorBarColors.length * (itemSize + gap) + separatorWidth + brushSizes.length * (itemSize + gap) - gap;
    const startX = (cw - totalWidth) / 2;
    const barY = 30;
    const barPadding = 16;

    // Bar background (glassmorphism)
    trackingCtx.save();
    trackingCtx.fillStyle = 'rgba(11, 28, 45, 0.85)';
    trackingCtx.beginPath();
    trackingCtx.roundRect(startX - barPadding, barY - barPadding, totalWidth + barPadding * 2, itemSize + barPadding * 2, 16);
    trackingCtx.fill();
    trackingCtx.strokeStyle = 'rgba(77, 163, 255, 0.3)';
    trackingCtx.lineWidth = 1;
    trackingCtx.stroke();

    // Draw color circles
    let curX = startX;
    colorBarColors.forEach((c, i) => {
        const cx = curX + itemSize / 2;
        const cy = barY + itemSize / 2;

        // Selected ring
        if (drawingConfig.color === c.color) {
            trackingCtx.strokeStyle = '#FFFFFF';
            trackingCtx.lineWidth = 3;
            trackingCtx.beginPath();
            trackingCtx.arc(cx, cy, itemSize / 2 + 2, 0, Math.PI * 2);
            trackingCtx.stroke();
        }

        // Hovered glow
        if (hoveredColorIndex === i) {
            trackingCtx.shadowColor = c.color;
            trackingCtx.shadowBlur = 12;
        }

        // Color circle
        trackingCtx.fillStyle = c.color;
        trackingCtx.beginPath();
        trackingCtx.arc(cx, cy, itemSize / 2 - 4, 0, Math.PI * 2);
        trackingCtx.fill();

        trackingCtx.shadowBlur = 0;
        curX += itemSize + gap;
    });

    // Separator
    trackingCtx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    trackingCtx.fillRect(curX, barY + 6, 2, itemSize - 12);
    curX += separatorWidth;

    // Draw brush size circles
    brushSizes.forEach((b, i) => {
        const cx = curX + itemSize / 2;
        const cy = barY + itemSize / 2;

        // Selected ring
        if (drawingConfig.lineWidth === b.size) {
            trackingCtx.strokeStyle = '#FFFFFF';
            trackingCtx.lineWidth = 2;
            trackingCtx.beginPath();
            trackingCtx.arc(cx, cy, itemSize / 2 + 2, 0, Math.PI * 2);
            trackingCtx.stroke();
        }

        // Background circle
        trackingCtx.fillStyle = hoveredSizeIndex === i ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.06)';
        trackingCtx.beginPath();
        trackingCtx.arc(cx, cy, itemSize / 2 - 4, 0, Math.PI * 2);
        trackingCtx.fill();

        // Size dot
        trackingCtx.fillStyle = drawingConfig.color;
        trackingCtx.beginPath();
        trackingCtx.arc(cx, cy, b.size / 2 + 1, 0, Math.PI * 2);
        trackingCtx.fill();

        // Label
        trackingCtx.fillStyle = '#B0B8C1';
        trackingCtx.font = '10px Inter, sans-serif';
        trackingCtx.textAlign = 'center';
        trackingCtx.fillText(b.label, cx, cy + itemSize / 2 + 14);

        curX += itemSize + gap;
    });

    trackingCtx.restore();
}

/**
 * Handle hover detection over color bar items
 * @param {object} position - Normalized {x, y}
 */
function handleColorBarHover(position) {
    if (!colorBarVisible) return;

    const x = mirrorX(position.x) * trackingCanvas.width;
    const y = position.y * trackingCanvas.height;

    const cw = trackingCanvas.width;
    const itemSize = 40;
    const gap = 12;
    const separatorWidth = 16;
    const totalWidth = colorBarColors.length * (itemSize + gap) + separatorWidth + brushSizes.length * (itemSize + gap) - gap;
    const startX = (cw - totalWidth) / 2;
    const barY = 30;

    let curX = startX;
    let newHoveredColor = -1;
    let newHoveredSize = -1;

    // Check color circles
    colorBarColors.forEach((c, i) => {
        const cx = curX + itemSize / 2;
        const cy = barY + itemSize / 2;
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (dist < itemSize / 2 + 5) {
            newHoveredColor = i;
        }
        curX += itemSize + gap;
    });

    curX += separatorWidth;

    // Check size circles
    brushSizes.forEach((b, i) => {
        const cx = curX + itemSize / 2;
        const cy = barY + itemSize / 2;
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (dist < itemSize / 2 + 5) {
            newHoveredSize = i;
        }
        curX += itemSize + gap;
    });

    // Handle color dwell selection
    if (newHoveredColor !== hoveredColorIndex) {
        hoveredColorIndex = newHoveredColor;
        if (colorDwellTimer) { clearTimeout(colorDwellTimer); colorDwellTimer = null; }
        if (newHoveredColor >= 0) {
            colorDwellTimer = setTimeout(() => {
                drawingConfig.color = colorBarColors[newHoveredColor].color;
                console.log('Color selected:', colorBarColors[newHoveredColor].label);
            }, DWELL_TIME);
        }
    }

    // Handle size dwell selection
    if (newHoveredSize !== hoveredSizeIndex) {
        hoveredSizeIndex = newHoveredSize;
        if (sizeDwellTimer) { clearTimeout(sizeDwellTimer); sizeDwellTimer = null; }
        if (newHoveredSize >= 0) {
            sizeDwellTimer = setTimeout(() => {
                drawingConfig.lineWidth = brushSizes[newHoveredSize].size;
                console.log('Brush size selected:', brushSizes[newHoveredSize].label);
            }, DWELL_TIME);
        }
    }
}

// ============ Stroke History & Undo ============

/**
 * Save a snapshot of the current canvas for undo
 */
function saveStrokeSnapshot() {
    if (!canvas || !ctx) return;

    // Save canvas as image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    strokeHistory.push(imageData);

    // Limit history size
    if (strokeHistory.length > MAX_HISTORY) {
        strokeHistory.shift();
    }
}

/**
 * Undo the last stroke
 */
function undoLastStroke() {
    if (strokeHistory.length === 0) {
        console.log('Nothing to undo');
        return;
    }

    const previousState = strokeHistory.pop();
    ctx.putImageData(previousState, 0, 0);
    saveCanvasState();
    console.log('Undo performed. History remaining:', strokeHistory.length);

    if (window.socketEmitUndo) window.socketEmitUndo();
}

// ============ Save Canvas ============

/**
 * Save the current canvas as a PNG image
 */
function saveCanvasAsImage() {
    if (!canvas) return;

    // Create a composite image with video + drawing
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext('2d');

    // Draw video frame
    if (videoElement && videoElement.videoWidth > 0) {
        exportCtx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    }

    // Draw canvas overlay
    exportCtx.drawImage(canvas, 0, 0);

    // Create download link
    const link = document.createElement('a');
    link.download = `aircanvas_${roomId}_${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();

    console.log('Canvas saved as image');
}

// ============ Canvas Actions ============

/**
 * Clear the drawing canvas
 */
function clearCanvas() {
    saveStrokeSnapshot(); // Save for undo before clearing
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    lastDrawPosition = null;
    saveCanvasState();
    console.log('Canvas cleared');

    if (window.socketEmitClear) window.socketEmitClear();
}

/**
 * End the session and clean up
 */
function endSession() {
    try {
        if (confirm('Are you sure you want to end this session?')) {
            cleanupSession();
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Error ending session:', error);
        // Force redirect even if cleanup fails
        window.location.href = 'index.html';
    }
}

/**
 * Clean up resources
 */
function cleanupSession() {
    try {
        // Disable AirCanvas first
        isAirCanvasEnabled = false;

        // Stop MediaPipe camera
        if (camera) {
            try { camera.stop(); } catch (e) { console.warn('Camera stop error:', e); }
            camera = null;
        }

        // Stop sync loop
        if (sessionSyncInterval) {
            clearInterval(sessionSyncInterval);
            sessionSyncInterval = null;
        }

        // Clear dwell timers
        clearDwellTimers();

        // Stop video stream tracks
        if (stream) {
            stream.getTracks().forEach(track => {
                try { track.stop(); } catch (e) { console.warn('Track stop error:', e); }
            });
            stream = null;
        }

        // Clear session data from localStorage
        if (sessionActive && roomId) {
            localStorage.removeItem(`session_${roomId}`);
        }

        sessionActive = false;
        console.log('Session cleaned up successfully');
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

// Session logic removed in favor of socket / webrtc

// ============ Utility Functions ============

/**
 * Generate a unique room ID
 * @returns {string} Room ID in format XXXX-XXXX
 */
function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';

    for (let i = 0; i < 8; i++) {
        if (i === 4) id += '-';
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return id;
}

/**
 * Update status indicator
 * @param {HTMLElement} element - Status indicator element
 * @param {string} text - Status text
 * @param {boolean} active - Whether status is active
 * @param {string} type - Status type ('active', 'inactive', 'warning', 'danger')
 */
function updateStatus(element, text, active, type = null) {
    if (!element) return;

    const statusType = type || (active ? 'active' : 'inactive');

    if (element.classList.contains('status-indicator')) {
        element.className = `status-indicator status-${statusType}`;
        const label = element.querySelector('span:last-child');
        if (label) label.textContent = text;
    } else {
        element.textContent = text;
        element.style.color = active ? 'var(--color-accent)' : 'var(--color-text-muted)';
    }
}
