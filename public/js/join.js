/**
 * Join Meeting Page JavaScript
 * Gesture-Enhanced Online Meeting Platform - AirCanvas
 * 
 * Handles joining a session and viewing host's canvas in real-time
 */

// ============ Global Variables ============
let roomId = null;
let canvas = null;
let ctx = null;
let isConnected = false;

// ============ DOM Elements ============
const joinForm = document.getElementById('joinForm');
const viewerSection = document.getElementById('viewerSection');
const backToHome = document.getElementById('backToHome');

const roomIdInput = document.getElementById('roomIdInput');
const joinBtn = document.getElementById('joinBtn');
const connectedRoomId = document.getElementById('connectedRoomId');

const canvasElement = document.getElementById('viewerCanvas');
const viewerVideo = document.getElementById('viewerVideo');
const viewerPlaceholder = document.getElementById('viewerPlaceholder');
const videoWorkspace = document.getElementById('videoWorkspace');

const connectionStatus = document.getElementById('connectionStatus');
const videoStatus = document.getElementById('videoStatus');
const syncStatus = document.getElementById('syncStatus');
const leaveSessionBtn = document.getElementById('leaveSessionBtn');

// Media controls (Removed as per user request)

// ============ Initialization ============
document.addEventListener('DOMContentLoaded', () => {
    console.log('Join Meeting Page Loaded');

    // Initialize canvas
    canvas = canvasElement;
    ctx = canvas.getContext('2d');

    // Set canvas size (16:9 aspect ratio, 720p)
    canvas.width = 1280;
    canvas.height = 720;

    // Set up event listeners
    setupEventListeners();

    // Handle URL parameters immediately
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
        roomId = roomParam;
        isConnected = true;
        
        // Directly connect and start WebRTC as viewer
        if(window.startWebRTC) window.startWebRTC();
    }
});

// ============ Event Listeners ============
function setupEventListeners() {
    joinBtn.addEventListener('click', joinSession);
    leaveSessionBtn.addEventListener('click', leaveSession);

    // Allow Enter key to join
    roomIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            joinSession();
        }
    });

    // Auto-format room ID input (add hyphen)
    roomIdInput.addEventListener('input', (e) => {
        let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

        if (value.length > 4) {
            value = value.slice(0, 4) + '-' + value.slice(4, 8);
        }

        e.target.value = value;
    });


    // Clean up on page unload
    window.addEventListener('beforeunload', leaveSession);
}

// ============ Session Functions ============

/**
 * Join a session by room ID
 */
async function joinSession() {
    const inputRoomId = roomIdInput.value.trim().toUpperCase();

    // Validate room ID format (XXXX-XXXX)
    if (!inputRoomId || inputRoomId.length !== 9) {
        alert('Please enter a valid Room ID in format XXXX-XXXX');
        roomIdInput.focus();
        return;
    }

    roomId = inputRoomId;
    isConnected = true;

    // Update UI
    connectedRoomId.textContent = roomId;
    joinForm.classList.add('hidden');
    if (backToHome) backToHome.classList.add('hidden');
    viewerSection.classList.remove('hidden');
    videoWorkspace.classList.add('active-glow');

    if (connectionStatus) {
        connectionStatus.className = 'status-indicator status-active';
        const txt = connectionStatus.querySelector('.status-text');
        if(txt) txt.textContent = 'Connected';
    }

    if (typeof connectToSocket === 'function' && !socket) {
        connectToSocket(roomId);
    }

    // Start WebRTC (no local media for participant)
    if(window.startWebRTC) window.startWebRTC();

    console.log('Joined session:', roomId);
}

/**
 * Leave the current session
 */
function leaveSession() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }

    isConnected = false;
    roomId = null;

    // Reset UI
    joinForm.classList.remove('hidden');
    if (backToHome) backToHome.classList.remove('hidden');
    viewerSection.classList.add('hidden');
    videoWorkspace.classList.remove('active-glow');
    roomIdInput.value = '';

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    viewerPlaceholder.style.display = 'flex';

    console.log('Left session');
}

// Participant media functions removed (View-only mode)
