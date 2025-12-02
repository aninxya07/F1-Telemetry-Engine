// Selection Menu Logic
class SelectionMenu {
    constructor() {
        this.year = 2025;
        this.round = 12;
        this.sessionType = 'R';
        this.forceRefresh = false;
        
        this.init();
    }
    
    init() {
        // Populate round dropdown
        const roundSelect = document.getElementById('round-select');
        for (let i = 1; i <= 24; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            if (i === 12) option.selected = true;
            roundSelect.appendChild(option);
        }
        
        // Event listeners
        document.getElementById('year-select').addEventListener('change', (e) => {
            this.year = parseInt(e.target.value);
        });
        
        document.getElementById('round-select').addEventListener('change', (e) => {
            this.round = parseInt(e.target.value);
        });
        
        document.getElementById('race-btn').addEventListener('click', () => {
            this.sessionType = 'R';
            document.getElementById('race-btn').classList.add('active');
            document.getElementById('sprint-btn').classList.remove('active');
        });
        
        document.getElementById('sprint-btn').addEventListener('click', () => {
            this.sessionType = 'S';
            document.getElementById('sprint-btn').classList.add('active');
            document.getElementById('race-btn').classList.remove('active');
        });
        
        document.getElementById('refresh-checkbox').addEventListener('change', (e) => {
            this.forceRefresh = e.target.checked;
        });
        
        document.getElementById('start-btn').addEventListener('click', () => {
            this.startReplay();
        });
    }
    
    async startReplay() {
        const menu = document.getElementById('selection-menu');
        const replay = document.getElementById('replay-container');
        
        // Show loading state
        const startBtn = document.getElementById('start-btn');
        startBtn.textContent = 'Loading...';
        startBtn.disabled = true;
        
        try {
            // Call API to load session
            const response = await fetch('/api/load-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    year: this.year,
                    round: this.round,
                    session_type: this.sessionType,
                    force_refresh: this.forceRefresh
                })
            });
            
            if (!response.ok) {
                let errorText;
                try {
                    const errorJson = await response.json();
                    errorText = errorJson.error || JSON.stringify(errorJson);
                } catch (e) {
                    errorText = await response.text();
                }
                throw new Error(`Server error: ${response.status} - ${errorText}`);
            }
            
            const responseText = await response.text();
            if (!responseText || responseText.trim() === '') {
                throw new Error('Empty response from server');
            }
            
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                console.error('Failed to parse JSON:', responseText);
                throw new Error(`Invalid JSON response: ${e.message}`);
            }
            
            if (data.success) {
                // Hide menu, show replay
                menu.classList.add('hidden');
                replay.classList.remove('hidden');
                
                // Initialize replay with data
                if (window.replayApp && window.replayApp.replay) {
                    window.replayApp.replay.init(data);
                } else {
                    console.error('Replay app not initialized');
                    alert('Replay visualization not ready. Please refresh the page.');
                }
            } else {
                alert('Error loading session: ' + (data.error || 'Unknown error'));
                startBtn.textContent = 'START REPLAY';
                startBtn.disabled = false;
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error loading session: ' + error.message);
            startBtn.textContent = 'START REPLAY';
            startBtn.disabled = false;
        }
    }
}

// Initialize menu when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.selectionMenu = new SelectionMenu();
    });
} else {
    window.selectionMenu = new SelectionMenu();
}

