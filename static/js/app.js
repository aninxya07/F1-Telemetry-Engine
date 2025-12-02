// Main Application Logic
class F1ReplayApp {
    constructor() {
        this.replay = null;
        this.init();
    }
    
    init() {
        // Initialize replay visualization
        this.replay = new ReplayVisualization('track-canvas');
        window.replayApp = this;
        
        // Setup playback control buttons
        this.setupControls();
    }
    
    setupControls() {
        const pauseBtn = document.getElementById('pause-btn');
        const rewindBtn = document.getElementById('rewind-btn');
        const forwardBtn = document.getElementById('forward-btn');
        const speedBtn = document.getElementById('speed-btn');
        const restartBtn = document.getElementById('restart-btn');
        
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                if (this.replay) this.replay.togglePause();
            });
        }
        
        if (rewindBtn) {
            rewindBtn.addEventListener('click', () => {
                if (this.replay) this.replay.rewind();
            });
        }
        
        if (forwardBtn) {
            forwardBtn.addEventListener('click', () => {
                if (this.replay) this.replay.fastForward();
            });
        }
        
        if (speedBtn) {
            speedBtn.addEventListener('click', () => {
                if (this.replay) {
                    // Cycle through speeds
                    const speeds = [0.5, 1, 2, 4];
                    const currentIndex = speeds.indexOf(this.replay.playbackSpeed);
                    const nextIndex = (currentIndex + 1) % speeds.length;
                    this.replay.setSpeed(speeds[nextIndex]);
                }
            });
        }
        
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                if (this.replay) this.replay.restart();
            });
        }
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new F1ReplayApp();
    });
} else {
    new F1ReplayApp();
}

