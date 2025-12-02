from flask import Flask, render_template, jsonify, send_from_directory
from flask_cors import CORS
import os
import sys
import json
import math
from src.f1_data import get_race_telemetry, load_race_session, enable_cache, get_circuit_rotation

app = Flask(__name__)
CORS(app)

# Increase max content length for large JSON responses
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500 MB

# Enable cache for fastf1
enable_cache()

# Store current session data in memory (for simplicity, in production use Redis or similar)
current_session_data = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/load-session', methods=['POST'])
def load_session():
    """Load a race session and return telemetry data"""
    from flask import request
    data = request.json
    year = data.get('year')
    round_number = data.get('round')
    session_type = data.get('session_type', 'R')
    force_refresh = data.get('force_refresh', False)
    
    try:
        print(f"Loading session: Year={year}, Round={round_number}, Type={session_type}, Refresh={force_refresh}")
        session = load_race_session(year, round_number, session_type)
        print(f"Loaded session: {session.event['EventName']} - {session.event['RoundNumber']}")
        
        # Get telemetry
        print("Getting race telemetry...")
        race_telemetry = get_race_telemetry(session, session_type=session_type, force_refresh=force_refresh)
        print(f"Telemetry loaded: {len(race_telemetry.get('frames', []))} frames")
        
        # Get example lap for track layout
        example_lap = session.laps.pick_fastest().get_telemetry()
        
        # Get circuit rotation
        circuit_rotation = get_circuit_rotation(session)
        
        # Get driver names and teams mapping (code -> full name, code -> team name)
        driver_names = {}
        driver_teams = {}
        
        # Team mapping (manual override for 2025 season)
        team_mapping = {
            'VER': 'Red Bull Racing',
            'TSU': 'Red Bull Racing',
            'LEC': 'Scuderia Ferrari',
            'HAM': 'Scuderia Ferrari',
            'NOR': 'McLaren',
            'PIA': 'McLaren',
            'RUS': 'Mercedes-AMG PETRONAS',
            'ANT': 'Mercedes-AMG PETRONAS',
            'ALO': 'Aston Martin Aramco',
            'STR': 'Aston Martin Aramco',
            'GAS': 'Alpine',
            'DOO': 'Alpine',
            'ALB': 'Williams Racing',
            'SAI': 'Williams Racing',
            'HAD': 'Racing Bulls',
            'LAW': 'Racing Bulls',
            'OCO': 'Haas F1 Team',
            'BEA': 'Haas F1 Team',
            'HUL': 'Kick Sauber',
            'BOR': 'Kick Sauber'
        }
        
        for driver_num in session.drivers:
            driver_info = session.get_driver(driver_num)
            code = driver_info["Abbreviation"]
            first_name = driver_info.get("FirstName", "")
            last_name = driver_info.get("LastName", "")
            full_name = f"{first_name} {last_name}".strip()
            
            # Special case: Replace Franco Colapinto with Jack Doohan
            if full_name == "Franco Colapinto":
                full_name = "Jack Doohan"
                code = "DOO"
            
            if full_name:
                driver_names[code] = full_name
            else:
                driver_names[code] = code  # Fallback to code if name not available
            
            # Get team name (try from mapping first, then from session data)
            if code in team_mapping:
                driver_teams[code] = team_mapping[code]
            else:
                # Try to get from session laps data
                try:
                    driver_laps = session.laps.pick_drivers(driver_num)
                    if not driver_laps.empty:
                        team_name = driver_laps.iloc[0].get('Team', '')
                        if team_name:
                            driver_teams[code] = team_name
                        else:
                            driver_teams[code] = 'Unknown Team'
                    else:
                        driver_teams[code] = 'Unknown Team'
                except:
                    driver_teams[code] = 'Unknown Team'
        
        # Prepare track layout data
        track_layout = {
            'x': example_lap["X"].tolist(),
            'y': example_lap["Y"].tolist(),
        }
        
        # Store in memory
        session_id = f"{year}_{round_number}_{session_type}"
        current_session_data[session_id] = {
            'telemetry': race_telemetry,
            'track_layout': track_layout,
            'circuit_rotation': circuit_rotation,
            'event_name': session.event['EventName'],
            'session_type': 'Sprint' if session_type == 'S' else 'Race'
        }
        
        print(f"Preparing response: {len(race_telemetry.get('frames', []))} frames")
        
        try:
            # Don't send all frames at once - send metadata only
            # Frames will be loaded on-demand via /api/get-frame endpoint
            # Clean track_layout for JSON (handle NaN values)
            cleaned_track_layout = clean_for_json(track_layout)
            
            # Convert numpy/pandas types to native Python types
            round_num = session.event['RoundNumber']
            if hasattr(round_num, 'item'):  # numpy/pandas scalar
                round_num = int(round_num.item())
            else:
                round_num = int(round_num)
            
            response_data = {
                'success': True,
                'session_id': session_id,
                'total_frames': len(race_telemetry['frames']),
                'track_layout': cleaned_track_layout,
                'driver_colors': race_telemetry['driver_colors'],
                'driver_names': driver_names,
                'driver_teams': driver_teams,
                'track_statuses': race_telemetry['track_statuses'],
                'total_laps': race_telemetry['total_laps'],
                'circuit_rotation': circuit_rotation,
                'event_name': session.event['EventName'],
                'round_number': round_num,
                'year': int(year),
                'session_type': 'Sprint' if session_type == 'S' else 'Race'
            }
            
            # Clean entire response to ensure all values are JSON serializable
            cleaned_response = clean_for_json(response_data)
            
            print("Creating JSON response (metadata only)...")
            response = jsonify(cleaned_response)
            print("Response created successfully")
            return response
        except Exception as json_error:
            import traceback
            print(f"Error creating JSON response: {str(json_error)}")
            print(traceback.format_exc())
            return jsonify({
                'success': False,
                'error': f'Failed to create response: {str(json_error)}'
            }), 500
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error loading session: {str(e)}")
        print(error_trace)
        return jsonify({
            'success': False, 
            'error': str(e),
            'traceback': error_trace
        }), 500

@app.route('/api/get-frame/<int:frame_index>')
def get_frame(frame_index):
    """Get a specific frame by index"""
    from flask import request
    session_id = request.args.get('session_id')
    
    if session_id not in current_session_data:
        return jsonify({'error': 'Session not found'}), 404
    
    frames = current_session_data[session_id]['telemetry']['frames']
    
    if frame_index < 0 or frame_index >= len(frames):
        return jsonify({'error': 'Frame index out of range'}), 400
    
    # Clean NaN values before sending
    cleaned_frame = clean_for_json(frames[frame_index])
    return jsonify(cleaned_frame)

def clean_for_json(obj):
    """Recursively clean NaN, Infinity values from data for JSON serialization"""
    import numpy as np
    import pandas as pd
    
    if isinstance(obj, dict):
        return {k: clean_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [clean_for_json(item) for item in obj]
    elif hasattr(obj, 'item'):  # numpy/pandas scalar types (int64, float64, etc.) - check this first
        return clean_for_json(obj.item())
    elif hasattr(obj, 'tolist'):  # numpy array
        return clean_for_json(obj.tolist())
    elif isinstance(obj, (float, np.floating)):
        if math.isnan(obj) or (hasattr(np, 'isnan') and np.isnan(obj)):
            return 0.0
        elif math.isinf(obj) or (hasattr(np, 'isinf') and np.isinf(obj)):
            return 0.0
        return float(obj)
    elif isinstance(obj, (int, np.integer)):
        return int(obj)
    elif isinstance(obj, pd.Timestamp):  # Handle pandas Timestamp
        return str(obj)
    else:
        return obj

@app.route('/api/get-frames-batch', methods=['POST'])
def get_frames_batch():
    """Get multiple frames in a batch"""
    from flask import request
    data = request.json
    session_id = data.get('session_id')
    start_index = data.get('start_index', 0)
    count = data.get('count', 1000)  # Default to 1000 frames per batch
    
    if session_id not in current_session_data:
        return jsonify({'error': 'Session not found'}), 404
    
    frames = current_session_data[session_id]['telemetry']['frames']
    end_index = min(start_index + count, len(frames))
    
    # Clean NaN values from frames before sending
    frames_batch = frames[start_index:end_index]
    cleaned_frames = clean_for_json(frames_batch)
    
    return jsonify({
        'frames': cleaned_frames,
        'start_index': start_index,
        'end_index': end_index,
        'total_frames': len(frames)
    })

@app.route('/images/drivers/<filename>')
def serve_driver_image(filename):
    """Serve driver car images"""
    return send_from_directory('images/drivers', filename)

@app.route('/images/tyres/<filename>')
def serve_tyre_image(filename):
    """Serve tyre images"""
    return send_from_directory('images/tyres', filename)

@app.route('/images/<filename>')
def serve_image(filename):
    """Serve general images like background"""
    return send_from_directory('images', filename)

if __name__ == '__main__':
    app.run(debug=True, port=5000)

