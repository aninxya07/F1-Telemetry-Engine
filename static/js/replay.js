// Replay Visualization Logic
class ReplayVisualization {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.frames = [];
        this.trackLayout = null;
        this.driverColors = {};
        this.trackStatuses = [];
        this.totalLaps = 0;
        this.circuitRotation = 0;
        
        // Playback state
        this.frameIndex = 0;
        this.playbackSpeed = 1.0;
        this.paused = false;
        this.lastUpdateTime = 0;
        this.fps = 25;
        
        // Selection
        this.selectedDriver = null;
        
        // Track geometry
        this.trackInner = [];
        this.trackOuter = [];
        this.trackCenter = [];
        this.worldBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        
        // Car images cache
        this.carImages = {};
        
        this.setupCanvas();
        this.setupEventListeners();
    }
    
    setupCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        const container = this.canvas.parentElement;
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        this.canvas.width = width;
        this.canvas.height = height;
        
        if (this.trackLayout) {
            this.calculateTrackGeometry();
        }
    }
    
    setupEventListeners() {
        // Canvas click for car selection
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.handleCanvasClick(x, y);
        });
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.togglePause();
            } else if (e.key === 'ArrowLeft') {
                this.rewind();
            } else if (e.key === 'ArrowRight') {
                this.fastForward();
            } else if (e.key === 'ArrowUp') {
                this.increaseSpeed();
            } else if (e.key === 'ArrowDown') {
                this.decreaseSpeed();
            } else if (e.key === 'r' || e.key === 'R') {
                this.restart();
            } else if (e.key >= '1' && e.key <= '4') {
                this.setSpeed(parseFloat(e.key) === 1 ? 0.5 : parseFloat(e.key) - 1);
            }
        });
    }
    
    async init(data) {
        console.log('Initializing replay with data:', {
            total_frames: data.total_frames,
            has_track_layout: !!data.track_layout,
            has_driver_colors: !!data.driver_colors
        });
        
        this.trackLayout = data.track_layout;
        this.driverColors = data.driver_colors;
        this.driverNames = data.driver_names || {};
        this.driverTeams = data.driver_teams || {};
        this.trackStatuses = data.track_statuses;
        this.totalLaps = data.total_laps;
        this.circuitRotation = data.circuit_rotation || 0;
        this.sessionId = data.session_id;
        this.totalFrames = data.total_frames;
        this.eventName = data.event_name || '';
        this.roundNumber = data.round_number || 0;
        this.year = data.year || 2025;
        this.frames = []; // Will be loaded on-demand
        
        // Calculate track geometry first (needs trackLayout)
        this.calculateTrackGeometry();
        
        // Load frames in batches
        console.log('Loading initial frame batch...');
        await this.loadFramesBatch(0, Math.min(5000, this.totalFrames));
        
        this.loadCarImages();
        this.startPlayback();
        
        console.log('Replay initialization complete');
    }
    
    async loadFramesBatch(startIndex, count) {
        try {
            console.log(`Loading frames batch: ${startIndex} to ${startIndex + count - 1}`);
            const response = await fetch('/api/get-frames-batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    start_index: startIndex,
                    count: count
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to load frames: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            
            if (!data.frames || data.frames.length === 0) {
                console.warn(`No frames returned for batch ${startIndex}`);
                return;
            }
            
            // Store frames in the array
            for (let i = 0; i < data.frames.length; i++) {
                this.frames[startIndex + i] = data.frames[i];
            }
            
            console.log(`Loaded frames ${startIndex} to ${data.end_index - 1} (${data.frames.length} frames)`);
            
            // Preload next batch if we're getting close to the end
            if (data.end_index < this.totalFrames && this.frameIndex > startIndex + count * 0.7) {
                const nextStart = data.end_index;
                const nextCount = Math.min(5000, this.totalFrames - nextStart);
                this.loadFramesBatch(nextStart, nextCount).catch(err => {
                    console.warn('Failed to preload next batch:', err);
                });
            }
        } catch (error) {
            console.error('Error loading frames batch:', error);
            alert(`Error loading frames: ${error.message}. Check console for details.`);
        }
    }
    
    calculateTrackGeometry() {
        if (!this.trackLayout) return;
        
        const trackWidth = 200;
        const x = this.trackLayout.x;
        const y = this.trackLayout.y;
        
        // Calculate track boundaries
        this.trackCenter = x.map((xi, i) => ({ x: xi, y: y[i] }));
        
        // Calculate normals for track width
        const inner = [];
        const outer = [];
        
        for (let i = 0; i < x.length; i++) {
            const prev = i === 0 ? x.length - 1 : i - 1;
            const next = i === x.length - 1 ? 0 : i + 1;
            
            const dx = x[next] - x[prev];
            const dy = y[next] - y[prev];
            const len = Math.sqrt(dx * dx + dy * dy);
            
            if (len > 0) {
                const nx = -dy / len;
                const ny = dx / len;
                
                inner.push({ x: x[i] - nx * trackWidth / 2, y: y[i] - ny * trackWidth / 2 });
                outer.push({ x: x[i] + nx * trackWidth / 2, y: y[i] + ny * trackWidth / 2 });
            }
        }
        
        this.trackInner = inner;
        this.trackOuter = outer;
        
        // Calculate world bounds
        const allX = [...x, ...inner.map(p => p.x), ...outer.map(p => p.x)];
        const allY = [...y, ...inner.map(p => p.y), ...outer.map(p => p.y)];
        
        this.worldBounds = {
            minX: Math.min(...allX),
            maxX: Math.max(...allX),
            minY: Math.min(...allY),
            maxY: Math.max(...allY)
        };
        
        this.updateScaling();
    }
    
    updateScaling() {
        const padding = 0.05;
        const worldW = this.worldBounds.maxX - this.worldBounds.minX;
        const worldH = this.worldBounds.maxY - this.worldBounds.minY;
        
        const usableW = this.canvas.width * (1 - 2 * padding);
        const usableH = this.canvas.height * (1 - 2 * padding);
        
        const scaleX = usableW / worldW;
        const scaleY = usableH / worldH;
        this.scale = Math.min(scaleX, scaleY);
        
        const worldCx = (this.worldBounds.minX + this.worldBounds.maxX) / 2;
        const worldCy = (this.worldBounds.minY + this.worldBounds.maxY) / 2;
        
        this.offsetX = this.canvas.width / 2 - this.scale * worldCx;
        this.offsetY = this.canvas.height / 2 - this.scale * worldCy;
    }
    
    worldToScreen(wx, wy) {
        // Apply rotation if needed
        let x = wx;
        let y = wy;
        
        if (this.circuitRotation !== 0) {
            const cx = (this.worldBounds.minX + this.worldBounds.maxX) / 2;
            const cy = (this.worldBounds.minY + this.worldBounds.maxY) / 2;
            const rad = (this.circuitRotation * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            
            const tx = x - cx;
            const ty = y - cy;
            x = tx * cos - ty * sin + cx;
            y = tx * sin + ty * cos + cy;
        }
        
        return {
            x: x * this.scale + this.offsetX,
            y: y * this.scale + this.offsetY
        };
    }
    
    screenToWorld(sx, sy) {
        const x = (sx - this.offsetX) / this.scale;
        const y = (sy - this.offsetY) / this.scale;
        return { x, y };
    }
    
    async loadCarImages() {
        if (!this.driverColors || Object.keys(this.driverColors).length === 0) return;
        
        // Get all unique driver codes from driver colors
        const driverCodes = new Set(Object.keys(this.driverColors));
        
        // Load images
        for (const code of driverCodes) {
            try {
                const img = new Image();
                img.src = `/images/drivers/${code}.png`;
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = () => {
                        console.log(`Car image not found for ${code}`);
                        resolve(); // Continue even if image not found
                    };
                });
                this.carImages[code] = img;
            } catch (error) {
                console.log(`Error loading car image for ${code}:`, error);
            }
        }
    }
    
    handleCanvasClick(x, y) {
        if (this.totalFrames === 0) return;
        
        const frameIndex = Math.floor(this.frameIndex);
        if (!this.frames[frameIndex]) return;
        
        const frame = this.frames[frameIndex];
        const clickRadius = 12;
        
        // Check each driver's position
        for (const [code, driver] of Object.entries(frame.drivers)) {
            const screenPos = this.worldToScreen(driver.x, driver.y);
            const dx = x - screenPos.x;
            const dy = y - screenPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= clickRadius) {
                // Toggle selection
                if (this.selectedDriver === code) {
                    this.selectedDriver = null;
                } else {
                    this.selectedDriver = code;
                }
                this.updateDriverInfo();
                this.updateLeaderboard();
                return;
            }
        }
    }
    
    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw track if we have track layout
        let trackStatus = 'GREEN';
        if (this.totalFrames > 0) {
            const frameIndex = Math.floor(this.frameIndex);
            
            // Check if frame is loaded, if not load it
            if (!this.frames[frameIndex] && frameIndex < this.totalFrames) {
                // Load this frame and nearby frames
                const batchStart = Math.max(0, frameIndex - 100);
                const batchCount = 500;
                this.loadFramesBatch(batchStart, batchCount);
                // Still draw track even if frames aren't loaded
            } else if (this.frames[frameIndex]) {
                const frame = this.frames[frameIndex];
                // Get current track status
                const currentTime = frame.t;
                for (const status of this.trackStatuses) {
                    if (status.start_time <= currentTime && 
                        (status.end_time === null || currentTime < status.end_time)) {
                        trackStatus = status.status;
                        break;
                    }
                }
                
                // Draw cars
                this.drawCars(frame);
                
                // Update HUD
                this.updateHUD(frame, trackStatus);
            }
        }
        
        // Always draw track (with appropriate status color)
        if (this.trackLayout && this.trackLayout.x && this.trackLayout.y) {
            this.drawTrack(trackStatus);
        }
    }
    
    drawTrack(status) {
        const statusColors = {
            'GREEN': '#969696',
            '2': '#DCB400',  // YELLOW
            '4': '#B4641E',  // SC
            '5': '#C81E1E',  // RED
            '6': '#C88232',  // VSC
            '7': '#C88232'   // VSC
        };
        
        const color = statusColors[status] || statusColors['GREEN'];
        
        // Draw track boundaries
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 4;
        
        // Inner boundary
        if (this.trackInner.length > 0) {
            this.ctx.beginPath();
            const first = this.worldToScreen(this.trackInner[0].x, this.trackInner[0].y);
            this.ctx.moveTo(first.x, first.y);
            for (let i = 1; i < this.trackInner.length; i++) {
                const pos = this.worldToScreen(this.trackInner[i].x, this.trackInner[i].y);
                this.ctx.lineTo(pos.x, pos.y);
            }
            this.ctx.closePath();
            this.ctx.stroke();
        }
        
        // Outer boundary
        if (this.trackOuter.length > 0) {
            this.ctx.beginPath();
            const first = this.worldToScreen(this.trackOuter[0].x, this.trackOuter[0].y);
            this.ctx.moveTo(first.x, first.y);
            for (let i = 1; i < this.trackOuter.length; i++) {
                const pos = this.worldToScreen(this.trackOuter[i].x, this.trackOuter[i].y);
                this.ctx.lineTo(pos.x, pos.y);
            }
            this.ctx.closePath();
            this.ctx.stroke();
        }
    }
    
    drawCars(frame) {
        // Calculate driver progress for sorting
        const driverProgress = {};
        for (const [code, driver] of Object.entries(frame.drivers)) {
            // Simple progress calculation (can be improved)
            driverProgress[code] = driver.dist;
        }
        
        // Sort drivers by progress
        const sortedDrivers = Object.entries(frame.drivers)
            .sort((a, b) => driverProgress[b[0]] - driverProgress[a[0]]);
        
        // Draw cars (draw selected one last so it's on top)
        const normalCars = [];
        let selectedCar = null;
        
        for (const [code, driver] of sortedDrivers) {
            if (code === this.selectedDriver) {
                selectedCar = { code, driver };
            } else {
                normalCars.push({ code, driver });
            }
        }
        
        // Draw normal cars
        for (const { code, driver } of normalCars) {
            this.drawCar(driver, code, false);
        }
        
        // Draw selected car on top
        if (selectedCar) {
            this.drawCar(selectedCar.driver, selectedCar.code, true);
        }
    }
    
    drawCar(driver, code, isSelected) {
        const pos = this.worldToScreen(driver.x, driver.y);
        const color = this.driverColors[code] || [255, 255, 255];
        const rgb = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        
        if (isSelected) {
            // Draw white outline
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // Draw larger filled circle
            this.ctx.fillStyle = rgb;
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
            this.ctx.fill();
        } else {
            // Normal size
            this.ctx.fillStyle = rgb;
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    updateHUD(frame, trackStatus) {
        const lap = frame.lap;
        const time = frame.t;
        
        // Update race name display
        const raceNameEl = document.getElementById('race-name');
        if (raceNameEl && this.eventName && this.roundNumber && this.year) {
            raceNameEl.textContent = `(Round ${this.roundNumber}) ${this.eventName} | ${this.year}`;
        }
        
        // Update lap display
        const lapDisplay = document.getElementById('lap-display');
        if (lapDisplay) {
            lapDisplay.textContent = `Lap: ${lap}${this.totalLaps ? `/${this.totalLaps}` : ''}`;
        }
        
        // Update time display
        const timeDisplay = document.getElementById('time-display');
        if (timeDisplay) {
            const hours = Math.floor(time / 3600);
            const minutes = Math.floor((time % 3600) / 60);
            const seconds = Math.floor(time % 60);
            timeDisplay.textContent = `Race Time: ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        
        // Update speed display
        const speedDisplay = document.getElementById('speed-display');
        if (speedDisplay) {
            speedDisplay.textContent = `(x${this.playbackSpeed})`;
        }
        
        // Update track status
        const statusEl = document.getElementById('track-status');
        if (statusEl) {
            statusEl.textContent = '';
            statusEl.className = 'hud-item';
            
            if (trackStatus === '2') {
                statusEl.textContent = 'YELLOW FLAG';
                statusEl.classList.add('status-yellow');
            } else if (trackStatus === '5') {
                statusEl.textContent = 'RED FLAG';
                statusEl.classList.add('status-red');
            } else if (trackStatus === '6' || trackStatus === '7') {
                statusEl.textContent = 'VIRTUAL SAFETY CAR';
                statusEl.classList.add('status-vsc');
            } else if (trackStatus === '4') {
                statusEl.textContent = 'SAFETY CAR';
                statusEl.classList.add('status-sc');
            }
        }
    }
    
    updateDriverInfo() {
        const infoPanel = document.getElementById('driver-info');
        if (!infoPanel) return;
        
        if (!this.selectedDriver || this.totalFrames === 0) {
            infoPanel.classList.add('hidden');
            return;
        }
        
        const frameIndex = Math.floor(this.frameIndex);
        if (!this.frames[frameIndex]) return;
        
        infoPanel.classList.remove('hidden');
        const frame = this.frames[frameIndex];
        const driver = frame.drivers[this.selectedDriver];
        
        if (!driver) {
            infoPanel.classList.add('hidden');
            return;
        }
        
        // Update driver name and team
        const nameEl = document.getElementById('driver-name');
        const teamEl = document.getElementById('driver-team');
        if (nameEl) {
            const fullName = this.driverNames[this.selectedDriver] || this.selectedDriver;
            nameEl.textContent = fullName;
            const color = this.driverColors[this.selectedDriver] || [255, 255, 255];
            nameEl.parentElement.style.background = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        }
        if (teamEl) {
            const teamName = this.driverTeams[this.selectedDriver] || '';
            teamEl.textContent = teamName;
        }
        
        // Update car image
        const imgEl = document.getElementById('driver-image');
        if (imgEl && this.carImages[this.selectedDriver]) {
            imgEl.src = this.carImages[this.selectedDriver].src;
            imgEl.style.display = 'block';
        } else if (imgEl) {
            imgEl.style.display = 'none';
        }
        
        // Update stats
        document.getElementById('driver-speed').textContent = `${driver.speed.toFixed(1)} km/h`;
        document.getElementById('driver-gear').textContent = driver.gear;
        
        let drsStatus = 'Off';
        if (driver.drs === 8) {
            drsStatus = 'Eligible';
        } else if ([10, 12, 14].includes(driver.drs)) {
            drsStatus = 'On';
        }
        document.getElementById('driver-drs').textContent = drsStatus;
        document.getElementById('driver-lap').textContent = driver.lap;
    }
    
    updateLeaderboard() {
        const leaderboard = document.getElementById('leaderboard');
        if (!leaderboard || this.totalFrames === 0) return;
        
        const frameIndex = Math.floor(this.frameIndex);
        if (!this.frames[frameIndex]) return;
        
        const frame = this.frames[frameIndex];
        
        // Calculate driver progress
        const driverProgress = {};
        for (const [code, driver] of Object.entries(frame.drivers)) {
            driverProgress[code] = driver.dist;
        }
        
        // Sort by progress
        const sortedDrivers = Object.entries(frame.drivers)
            .sort((a, b) => driverProgress[b[0]] - driverProgress[a[0]]);
        
        leaderboard.innerHTML = '';
        
        sortedDrivers.forEach(([code, driver], index) => {
            const entry = document.createElement('div');
            entry.className = 'leaderboard-entry';
            if (code === this.selectedDriver) {
                entry.classList.add('selected');
            }
            
            const color = this.driverColors[code] || [255, 255, 255];
            entry.style.borderLeftColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            entry.style.borderLeftWidth = '4px';
            
            entry.innerHTML = `
                <div class="entry-text">
                    <span class="position">${index + 1}.</span>
                    <span class="driver-code" style="color: rgb(${color[0]}, ${color[1]}, ${color[2]})">${code}</span>
                    ${driver.rel_dist === 1 ? '<span style="color: #ff4444;">OUT</span>' : ''}
                </div>
                <img src="/images/tyres/${driver.tyre}.0.png" alt="Tyre" class="tyre-icon" onerror="this.style.display='none'">
            `;
            
            entry.addEventListener('click', () => {
                if (this.selectedDriver === code) {
                    this.selectedDriver = null;
                } else {
                    this.selectedDriver = code;
                }
                this.updateDriverInfo();
                this.updateLeaderboard();
            });
            
            leaderboard.appendChild(entry);
        });
    }
    
    startPlayback() {
        this.lastUpdateTime = performance.now();
        this.animate();
    }
    
    animate() {
        const now = performance.now();
        const deltaTime = (now - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = now;
        
        if (!this.paused) {
            this.frameIndex += deltaTime * this.fps * this.playbackSpeed;
            if (this.frameIndex >= this.totalFrames) {
                this.frameIndex = this.totalFrames - 1;
            }
        }
        
        this.draw();
        this.updateDriverInfo();
        this.updateLeaderboard();
        
        requestAnimationFrame(() => this.animate());
    }
    
    togglePause() {
        this.paused = !this.paused;
        const btn = document.getElementById('pause-btn');
        if (btn) {
            btn.textContent = this.paused ? '▶ Play' : '⏸ Pause';
        }
    }
    
    rewind() {
        this.frameIndex = Math.max(0, this.frameIndex - 10);
    }
    
    fastForward() {
        this.frameIndex = Math.min(this.totalFrames - 1, this.frameIndex + 10);
    }
    
    increaseSpeed() {
        this.playbackSpeed = Math.min(128, this.playbackSpeed * 2);
        this.updateSpeedButton();
    }
    
    decreaseSpeed() {
        this.playbackSpeed = Math.max(0.1, this.playbackSpeed / 2);
        this.updateSpeedButton();
    }
    
    setSpeed(speed) {
        this.playbackSpeed = speed;
        this.updateSpeedButton();
    }
    
    updateSpeedButton() {
        const btn = document.getElementById('speed-btn');
        if (btn) {
            btn.textContent = `Speed: ${this.playbackSpeed}x`;
        }
    }
    
    restart() {
        this.frameIndex = 0;
        this.playbackSpeed = 1.0;
        this.updateSpeedButton();
    }
}

