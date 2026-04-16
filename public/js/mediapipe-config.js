/**
 * MediaPipe Hands Configuration
 * Gesture-Enhanced Online Meeting Platform - AirCanvas
 * 
 * Sets up and configures MediaPipe Hands for hand tracking and gesture recognition
 */

/**
 * Gesture detection utility functions
 */
const GestureDetector = {
    /**
     * Check if a finger is extended based on landmark positions
     * @param {Array} landmarks - Hand landmarks array
     * @param {number} tipIdx - Fingertip landmark index
     * @param {number} pipIdx - PIP joint landmark index
     * @returns {boolean} True if finger is extended
     */
    isFingerExtended(landmarks, tipIdx, pipIdx) {
        // Finger is extended if tip is above (lower y value) the PIP joint
        return landmarks[tipIdx].y < landmarks[pipIdx].y;
    },

    /**
     * Check if thumb is extended (uses x-axis since thumb moves sideways)
     * @param {Array} landmarks - Hand landmarks array
     * @returns {boolean} True if thumb is extended
     */
    isThumbExtended(landmarks) {
        // Thumb tip (4) vs thumb IP joint (3) — check x distance from wrist
        const wristX = landmarks[0].x;
        const thumbTipDist = Math.abs(landmarks[4].x - wristX);
        const thumbIPDist = Math.abs(landmarks[3].x - wristX);
        return thumbTipDist > thumbIPDist;
    },

    /**
     * Detect current gesture mode based on hand landmarks
     * @param {Array} landmarks - Hand landmarks array (21 points)
     * @returns {object} Gesture information {mode: string, position: {x, y}}
     */
    detectGesture(landmarks) {
        // Landmark indices:
        // Thumb: 4, Index: 8, Middle: 12, Ring: 16, Pinky: 20
        // PIP joints: Index: 6, Middle: 10, Ring: 14, Pinky: 18

        const thumbExtended = this.isThumbExtended(landmarks);
        const indexExtended = this.isFingerExtended(landmarks, 8, 6);
        const middleExtended = this.isFingerExtended(landmarks, 12, 10);
        const ringExtended = this.isFingerExtended(landmarks, 16, 14);
        const pinkyExtended = this.isFingerExtended(landmarks, 20, 18);

        // Get index finger tip position (landmark 8)
        const position = {
            x: landmarks[8].x,
            y: landmarks[8].y
        };

        // Gesture modes:

        // 1. Draw Mode: Only index finger extended (thumb can be in any position)
        if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
            return { mode: 'draw', position };
        }

        // 2. Select/Color Picker Mode: Index and middle fingers extended
        if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
            return { mode: 'select', position };
        }

        // 3. Erase Mode: Fist — no fingers extended (including thumb curled)
        if (!thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
            return { mode: 'erase', position: { x: landmarks[9].x, y: landmarks[9].y } };
        }

        // 4. No gesture / Paused — any other hand configuration
        return { mode: 'none', position };
    }
};

/**
 * Initialize MediaPipe Hands
 * @param {Function} onResultsCallback - Callback function to handle hand detection results
 * @returns {object} MediaPipe Hands instance
 */
function initializeMediaPipeHands(onResultsCallback) {
    const hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 1,              // Track only one hand for simplicity
        modelComplexity: 1,          // 0 (lite), 1 (full), or 2 (heavy)
        minDetectionConfidence: 0.7, // Higher = more accurate but slower
        minTrackingConfidence: 0.5   // Tracking confidence threshold
    });

    hands.onResults(onResultsCallback);

    return hands;
}

/**
 * Initialize camera for MediaPipe
 * @param {HTMLVideoElement} videoElement - Video element to display camera feed
 * @param {object} hands - MediaPipe Hands instance
 * @returns {object} Camera instance
 */
function initializeCamera(videoElement, hands) {
    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 1280,
        height: 720
    });

    return camera;
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GestureDetector, initializeMediaPipeHands, initializeCamera };
}
