const peerConnections = {}; 
const configuration = { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }, { 'urls': 'stun:global.stun.twilio.com:3478' }] };
let peerHostId = null;
const candidateQueues = {};

window.initializeWebRTCListeners = function(ioSocket) {
    if (!ioSocket) return;

    ioSocket.on('webrtc:host-id', (hostId) => {
        console.log("WebRTC host ID set to:", hostId);
        peerHostId = hostId;
    });

    ioSocket.on('webrtc:user-joined', async (userId) => {
        if (userId === ioSocket.id) return;
        console.log("WebRTC user joined:", userId);
        const pc = createPeerConnection(userId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ioSocket.emit('webrtc:offer', roomId, offer, userId);
    });

    ioSocket.on('webrtc:offer', async ({ senderId, offer }) => {
        console.log("WebRTC received offer from:", senderId);
        const pc = createPeerConnection(senderId);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Drain ICE candidate queue
        if (candidateQueues[senderId]) {
            for (let c of candidateQueues[senderId]) await pc.addIceCandidate(new RTCIceCandidate(c));
            candidateQueues[senderId] = [];
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ioSocket.emit('webrtc:answer', roomId, answer, senderId);
    });

    ioSocket.on('webrtc:answer', async ({ senderId, answer }) => {
        console.log("WebRTC received answer from:", senderId);
        const pc = peerConnections[senderId];
        if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));

            // Drain ICE candidate queue
            if (candidateQueues[senderId]) {
                for (let c of candidateQueues[senderId]) await pc.addIceCandidate(new RTCIceCandidate(c));
                candidateQueues[senderId] = [];
            }
        }
    });

    ioSocket.on('webrtc:ice-candidate', async ({ senderId, candidate }) => {
        const pc = peerConnections[senderId];
        if (pc && pc.remoteDescription) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                console.error("Error adding ice candidate:", e);
            }
        } else {
            if (!candidateQueues[senderId]) candidateQueues[senderId] = [];
            candidateQueues[senderId].push(candidate);
        }
    });

    ioSocket.on('webrtc:user-left', (userId) => {
        console.log("WebRTC user left:", userId);
        if (peerConnections[userId]) {
            peerConnections[userId].close();
            delete peerConnections[userId];
        }
        const vid = document.getElementById(`video-${userId}`);
        if (vid) vid.remove();
    });
}

window.startWebRTC = function() {
    if (!socket || !roomId) {
        console.warn("Socket or RoomID not ready, retrying startWebRTC...");
        setTimeout(window.startWebRTC, 100);
        return;
    }
    socket.emit('webrtc:join', roomId);
}

function createPeerConnection(remotePeerId) {
    if (peerConnections[remotePeerId]) return peerConnections[remotePeerId];

    candidateQueues[remotePeerId] = [];

    const pc = new RTCPeerConnection(configuration);
    
    // Send our local stream tracks if available
    if (window.localMediaStream) {
        window.localMediaStream.getTracks().forEach(track => {
            pc.addTrack(track, window.localMediaStream);
        });
    }

    // When we get remote tracks
    pc.ontrack = (event) => {
        console.log(`Received remote track: ${event.track.kind} from ${remotePeerId}`);
        const remoteStream = event.streams[0] || new MediaStream([event.track]);
        handleRemoteStream(remotePeerId, remoteStream);
    };

    // When we discover ice candidates
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('webrtc:ice-candidate', roomId, event.candidate, remotePeerId);
        }
    };

    peerConnections[remotePeerId] = pc;
    return pc;
}

function handleRemoteStream(peerId, stream) {
    // If it's already rendered, don't recreate
    if (document.getElementById(`video-${peerId}`)) return;

    // Check if this incoming stream is the Host and we have the viewerVideo tag (Participant view)
    const viewerVideo = document.getElementById('viewerVideo');
    if (peerId === peerHostId && viewerVideo) {
        console.log(`Rendering HOST video stream with ${stream.getAudioTracks().length} audio tracks...`);
        viewerVideo.srcObject = stream;
        viewerVideo.volume = 1.0; 
        
        viewerVideo.play().then(() => {
            console.log("Host video and audio playing successfully");
        }).catch(e => {
            console.warn("Host video play failed (likely audio auto-play policy):", e);
            // Fallback for browsers that require user interaction for audio
            viewerVideo.muted = true;
            viewerVideo.play();
            console.log("Playing muted as fallback. User must interact to hear sound.");
        });

        // Update UI
        const placeholder = document.getElementById('viewerPlaceholder');
        if (placeholder) placeholder.style.display = 'none';

        const vidStatus = document.getElementById('videoStatus');
        if (vidStatus) {
            vidStatus.className = 'status-indicator status-active';
            vidStatus.querySelector('.status-text').textContent = 'Live';
        }
        return;
    }

    console.log(`Adding track to participant-strip for peer: ${peerId}`);
    // Otherwise append to the participant strip representing real multi-user
    let strip = document.getElementById('participant-strip');
    if (!strip) return;

    const vid = document.createElement('video');
    vid.id = `video-${peerId}`;
    vid.style.cssText = 'width: 150px; height: 100px; border-radius: 8px; border: 2px solid rgba(255,255,255,0.2); object-fit: cover; background: #000; box-shadow: 0 4px 6px rgba(0,0,0,0.3);';
    vid.autoplay = true;
    vid.playsInline = true;
    vid.srcObject = stream;
    vid.volume = 1.0; 

    strip.appendChild(vid);
}

