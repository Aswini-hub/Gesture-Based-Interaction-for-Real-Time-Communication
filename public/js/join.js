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

// Media controls
const toggleMicBtn = document.getElementById('toggleMicBtn');
const toggleVideoBtn = document.getElementById('toggleVideoBtn');
const micText = document.getElementById('micText');
const videoText = document.getElementById('videoText');

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

    // Media controls
    if(toggleMicBtn) toggleMicBtn.addEventListener('click', toggleMic);
    if(toggleVideoBtn) toggleVideoBtn.addEventListener('click', toggleVideo);

    // Clean up on page unload
    window.addEventListener('beforeunload', leaveSession);
}

// ============ Session Functions ============

/**
 * Join a session by room ID
 */
function joinSession() {
    const inputRoomId = roomIdInput.value.trim().toUpperCase();

    // Validate room ID format (XXXX-XXXX)
    if (!inputRoomId || inputRoomId.length !== 9) {
        alert('Please enter a valid Room ID in format XXXX-XXXX');
        roomIdInput.focus();
        return;
    }

    // We rely on socket initialization now instead of localStorage
    roomId = inputRoomId;
    isConnected = true;

    // Update UI
    connectedRoomId.textContent = roomId;
    joinForm.classList.add('hidden');
    if (backToHome) backToHome.classList.add('hidden');
    viewerSection.classList.remove('hidden');
    videoWorkspace.classList.add('active-glow');

    updateStatus(connectionStatus, 'Connected', true);

    // Start WebRTC and request local video/mic
    if(window.startWebRTC) window.startWebRTC();
    initParticipantMedia();

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

// ============ Media Functions ============

let micEnabled = false;
let videoEnabled = false;

const iconMicOn = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>`;
const iconMicOff = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="22" y1="2" y2="22"></line><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"></path><path d="M5 10v2a7 7 0 0 0 12 5l-2.7-2.7a3 3 0 0 1-4.6-4.6L5 7.6V10Z"></path><path d="M12 2a3 3 0 0 0-3 3v2l6 6V5a3 3 0 0 0-3-3Z"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>`;
const iconVidOn = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"></path><rect x="2" y="6" width="14" height="12" rx="2"></rect></svg>`;
const iconVidOff = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"></path><rect x="2" y="6" width="14" height="12" rx="2"></rect><line x1="2" x2="22" y1="2" y2="22"></line></svg>`;

async function initParticipantMedia() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        window.localMediaStream = stream;
        micEnabled = true;
        videoEnabled = true;
        
        if(toggleMicBtn) {
            toggleMicBtn.innerHTML = iconMicOn;
            toggleMicBtn.className = 'btn btn-secondary';
        }

        if(toggleVideoBtn) {
            toggleVideoBtn.innerHTML = iconVidOn;
            toggleVideoBtn.className = 'btn btn-secondary';
        }
        
    } catch (e) {
        console.warn('Participant media error or denied', e);
    }
}

async function toggleMic() {
    if(!window.localMediaStream) return;
    micEnabled = !micEnabled;
    window.localMediaStream.getAudioTracks().forEach(t => t.enabled = micEnabled);
    if(toggleMicBtn) {
        toggleMicBtn.innerHTML = micEnabled ? iconMicOn : iconMicOff;
        toggleMicBtn.className = micEnabled ? 'btn btn-secondary' : 'btn btn-danger';
    }
}

async function toggleVideo() {
    if(!window.localMediaStream) return;
    videoEnabled = !videoEnabled;
    window.localMediaStream.getVideoTracks().forEach(t => t.enabled = videoEnabled);
    if(toggleVideoBtn) {
        toggleVideoBtn.innerHTML = videoEnabled ? iconVidOn : iconVidOff;
        toggleVideoBtn.className = videoEnabled ? 'btn btn-secondary' : 'btn btn-danger';
    }
}
