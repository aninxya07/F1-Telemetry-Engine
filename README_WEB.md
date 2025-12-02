# F1 Race Replay - Web Version

A web-based Formula 1 race replay application built with Flask (Python backend) and HTML/CSS/JavaScript (frontend).

## Features

- **Web-based Interface**: Access the replay through your web browser
- **Selection Menu**: Choose year, round, and session type (Race/Sprint) via web UI
- **Interactive Track Visualization**: Click on cars directly on the track to select them
- **Highlighted Selected Car**: Selected cars are larger with a white outline
- **Car Images**: Display car images in the driver info panel
- **Real-time Playback**: Smooth animation with adjustable playback speed
- **Leaderboard**: Live leaderboard with clickable entries
- **Driver Telemetry**: View speed, gear, DRS status, and current lap

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Make sure you have car images in `images/drivers/` folder (e.g., `VER.png`, `HAM.png`, etc.)

## Running the Web Application

1. Start the Flask server:
```bash
python app.py
```

2. Open your web browser and navigate to:
```
http://localhost:5000
```

3. Use the selection menu to choose:
   - Year (2018-2025)
   - Round (1-24)
   - Session Type (Race or Sprint)
   - Force Telemetry Refresh (optional)

4. Click "START REPLAY" to begin

## Controls

- **SPACE**: Pause/Resume
- **←/→**: Rewind / Fast Forward
- **↑/↓**: Increase/Decrease playback speed
- **1-4**: Set speed directly (0.5x, 1x, 2x, 4x)
- **R**: Restart from beginning
- **Click on cars**: Select/deselect drivers
- **Click on leaderboard**: Select/deselect drivers

## File Structure

```
├── app.py                 # Flask web server
├── templates/
│   └── index.html        # Main HTML template
├── static/
│   ├── css/
│   │   └── style.css    # All styling
│   └── js/
│       ├── app.js       # Main application logic
│       ├── menu.js      # Selection menu logic
│       └── replay.js    # Replay visualization
├── src/
│   ├── f1_data.py       # Python telemetry processing (unchanged)
│   └── arcade_replay.py # Original Arcade version (still available)
└── images/
    └── drivers/         # Car images (VER.png, HAM.png, etc.)
```

## API Endpoints

- `POST /api/load-session`: Load a race session and return telemetry data
- `GET /api/get-frame/<frame_index>`: Get a specific frame by index
- `GET /images/drivers/<filename>`: Serve driver car images
- `GET /images/tyres/<filename>`: Serve tyre compound images

## Notes

- The Python backend logic remains unchanged - all F1 data processing is still done in Python
- The web version uses Canvas for track rendering instead of Arcade
- All features from the CLI version are available in the web version
- The original CLI version (`main.py`) still works if you prefer that interface

