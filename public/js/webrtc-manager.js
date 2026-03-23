const peerConnections = {}; 
const configuration = { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }, { 'urls': 'stun:global.stun.twilio.com:3478' }] };
let peerHostId = null;

function initWebRTC() {
    if (!socket || !roomId) {
        setTimeout(initWebRTC, 100); // Wait for socket-host/join to define globals
        return;
    }

    socket.on('webrtc:host-id', (hostId) => {
        peerHostId = hostId;
    });

    socket.on('webrtc:user-joined', async (userId) => {
        if (userId === socket.id) return;
        console.log("WebRTC user joined:", userId);
        const pc = createPeerConnection(userId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc:offer', roomId, offer, userId);
    });

    socket.on('webrtc:offer', async ({ senderId, offer }) => {
        console.log("WebRTC received offer from:", senderId);
        const pc = createPeerConnection(senderId);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc:answer', roomId, answer, senderId);
    });

    socket.on('webrtc:answer', async ({ senderId, answer }) => {
        console.log("WebRTC received answer from:", senderId);
        const pc = peerConnections[senderId];
        if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
    });

    socket.on('webrtc:ice-candidate', async ({ senderId, candidate }) => {
        const pc = peerConnections[senderId];
        if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
    });

    socket.on('webrtc:user-left', (userId) => {
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
        setTimeout(window.startWebRTC, 100);
        return;
    }
    socket.emit('webrtc:join', roomId);
}

function createPeerConnection(remotePeerId) {
    if (peerConnections[remotePeerId]) return peerConnections[remotePeerId];

    const pc = new RTCPeerConnection(configuration);
    
    // Send our local stream tracks if available
    if (window.localMediaStream) {
        window.localMediaStream.getTracks().forEach(track => {
            pc.addTrack(track, window.localMediaStream);
        });
    }

    // When we get remote tracks
    pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
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

    // Check if this incoming stream is the Host and we have the viewerideo tag (Participant view)
    if (peerId === peerHostId && document.getElementById('viewerVideo')) {
        const viewerVideo = document.getElementById('viewerVideo');
        viewerVideo.srcObject = stream;
        viewerVideo.play().catch(e => console.warn(e));
        return;
    }

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

window.addEventListener('load', initWebRTC);
