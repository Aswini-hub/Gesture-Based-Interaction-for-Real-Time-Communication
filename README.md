# Gesture-Based-Interaction-for-Real-Time-Communication
# AirCanvas – Gesture-Enhanced Interactive Platform 🎨

AirCanvas is a touchless, virtual drawing and communication platform powered by AI computer vision. Users can draw, annotate, and navigate complex interfaces during virtual meetings using just their hand gestures—no extra hardware, graphic tablets, or styluses required.

This project uses **Google MediaPipe** for real-time 3D hand-tracking and **Socket.IO** for lightning-fast WebSocket room synchronization, allowing participants to join the host’s session remotely and watch their annotations in real-time.

---

## ✨ Features

- **Real-Time Hand Tracking**: Sub-millisecond latency hand joint detection running natively in the browser via MediaPipe.
- **Air Canvas Drawing**: Hardware-accelerated drawing overlay. Just point your index finger to draw in mid-air.
- **Real-Time Audio/Video (WebRTC)**: True peer-to-peer (mesh) video conferencing topology for participants and the host, complete with responsive SVG media toggles.
- **Drawing Synchronization (Socket.IO)**: 
  - Hosts can create secure Room IDs (e.g., `A3F2-9KLM`).
  - Participants connect globally using `/join.html?room=ID`.
  - Continuous lightweight vector instructions, late-joiner canvas history replay, and native undo state tracking layered cleanly atop the video feed.
- **Gesture Action Modes**:
  - ☝️ **Index finger (Draw)**: Drops continuous lines on the canvas.
  - ✌️ **Two fingers (Color Pick)**: Activates on-screen glassmorphic color / brush size picker.
  - ✊ **Fist (Erase)**: Operates a dynamic eraser mapped to the tracked coordinate.
  - 🖐️ **Open hand (Idle)**: Stops the drawing stream / resets stroke logic.
- **Undo / Clear / Save**: Native host side logic propagated instantly across the websocket layer.

---

## 🛠️ Architecture

- **Frontend**: Vanilla HTML / JS / CSS (MediaPipe Hands, Canvas API) served entirely statically.
- **Backend**: Node.js + Express (serving the `/public` directory).
- **Communication Protocol**: Dual-channel infrastructure:
  - **WebRTC** handling rapid peer-to-peer audio and HD video tracks universally.
  - **WebSocket (Socket.IO)** performing the room-signaling and high-frequency structural coordinate syncing via (`socket-host.js` and `socket-join.js`).
- **Server State**: In-memory hash mapping (`rooms[roomId] = { history: [...] }`) avoiding the need for a database.

---

## 🚀 Getting Started

### 1. Requirements
Ensure you have Node.js (v16+) installed.

### 2. Installation
Clone this repository and run the package manager locally:
```bash
npm install
```

### 3. Usage & Run
Start the Node + Express server.
```bash
npm start
```
The server will initialize on `http://localhost:3000`.

* **Host a Session**: Open the platform, click **Create Meeting**, accept the camera permissions, and share your `ROOM ID`.
* **Join a Session**: Open a separate tab/device, click **Join Meeting**, and type in the Host's 9-character Room ID.

---

## 📁 File Structure

```text
aircanvas-main/
├── server.js                     # Node.js + Socket.IO server
├── package.json                  # Dependencies (Express, Socket.IO)
├── render.yaml                   # Production deploy config 
└── public/                       # Static Frontend Directory
    ├── index.html                # Landing page
    ├── host.html                 # Host meeting workspace (Computer Vision)
    ├── join.html                 # Participant observer workspace
    ├── css/                      # UI Styles & Variables
    └── js/
        ├── host.js               # Core MediaPipe + Drawing Engine
        ├── join.js               # UI controls for participant
        ├── socket-host.js        # Websocket bridge emitting host data payload
        ├── socket-join.js        # Websocket bridge consuming canvas rendering vectors
        └── webrtc-manager.js     # Autonomous WebRTC peer connection manager
```

---

## ☁️ Deployment

This project includes a fully configured `render.yaml` for an automated, zero-config deployment to [Render.com](https://render.com). 

1. Link your GitHub repository to Render.
2. Render will automatically detect the YAML file and spin up an `Express + Node` Web Service instance.
3. Access AirCanvas universally!

---

*Developed for Academic Demonstration / Final Year Engineering Protocol.*
