from flask import Flask, request, jsonify, render_template, send_from_directory, redirect, send_file
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import os
import datetime
import logging
from screenshot_handler import start_screenshot_capture, stop_screenshot_capture, get_screenshots_zip

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Create Flask app with explicit template and static paths
template_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'templates'))
static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'static'))
app = Flask(__name__, 
           static_folder=static_dir,
           template_folder=template_dir)

# Configure app with stricter settings
app.config['PROPAGATE_EXCEPTIONS'] = True
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # Limit request size to 16MB

# More restrictive CORS - only allow what you need
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5001", "http://127.0.0.1:5001"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Configure SocketIO with explicit allowed origins
socketio = SocketIO(
    app,
    cors_allowed_origins=["http://localhost:5001", "http://127.0.0.1:5001"],
    logger=True,
    engineio_logger=True
)

# Store received parameters with default values
simulation_data = {
    "SC": 800,
    "BF": 300,
    "AmpX": 0.2,
    "AmpY": 1.0,
    "AmpZ": 0.2,
    "freqX": 1.0,
    "freqY": 2.0,
    "freqZ": 1.0,
    "sphereCount": 0,
    "rectangleCount": 0,
    "quartersphereCount": 0,
    "airfoilCount": 0,
    "halfsphereCount": 0,
    "pyramidCount": 0
}

@app.before_request
def before_request():
    """Log request details and upgrade HTTP to HTTPS in production"""
    logger.debug(f"Request URL: {request.url}")
    logger.debug(f"Request Headers: {request.headers}")
    
    # Only redirect in production
    if "localhost" not in request.url and "127.0.0.1" not in request.url and request.headers.get("X-Forwarded-Proto", "http") == "http":
        url = request.url.replace("http://", "https://", 1)
        return redirect(url, code=301)

# Error handler for bad requests
@app.errorhandler(400)
def handle_bad_request(e):
    logger.error(f"Bad request: {e}")
    return jsonify({"error": "Bad request", "message": str(e)}), 400

# Serve the Self-Organization page (main landing page)
@app.route('/')
def index():
    logger.info("Index route accessed!")
    return render_template('index.html')

@app.route('/test')
def test():
    return "Test route is working!"

# Serve the simulator introduction page
@app.route('/simulator')
def simulator():
    logger.info("Simulator route accessed")
    return render_template('simulator.html')

# Serve the simulator configuration form page
@app.route('/simulator_form')
def simulator_form():
    logger.info("Simulator form route accessed")
    return render_template('simulator-form.html', params=simulation_data)

# Handle form submission and redirect to Unity WebGL game
@app.route('/set-data', methods=['POST'])
def set_data():
    global simulation_data
    try:
        simulation_data = request.json
        logger.info(f"Received Data: {simulation_data}")
        return jsonify({"message": "Data received!", "redirect_url": "/game"})
    except Exception as e:
        logger.error(f"Error processing data: {str(e)}")
        return jsonify({"error": str(e)}), 400

# Unity WebGL fetches stored parameters
@app.route('/get-data', methods=['GET'])
def get_data():
    return jsonify(simulation_data)

# Serve Unity WebGL `index.html`
@app.route('/game')
def game():
    try:
        return send_from_directory("static/Try_web_build", "index.html")
    except Exception as e:
        logger.error(f"Error serving game index: {str(e)}")
        return jsonify({"error": str(e)}), 404

# Serve Build files properly
@app.route('/game/Build/<path:filename>')
def serve_build_files(filename):
    try:
        logger.debug(f"Serving build file: {filename}")
        return send_from_directory("static/Try_web_build/Build", filename)
    except Exception as e:
        logger.error(f"Error serving build file {filename}: {str(e)}")
        return "", 404

# Serve TemplateData files
@app.route('/game/TemplateData/<path:filename>')
def serve_template_files(filename):
    try:
        logger.debug(f"Serving template file: {filename}")
        return send_from_directory("static/Try_web_build/TemplateData", filename)
    except Exception as e:
        logger.error(f"Error serving template file {filename}: {str(e)}")
        return "", 404

# Add a route for root-level static files in Try_web_build
@app.route('/game/<path:filename>')
def serve_game_root_files(filename):
    try:
        logger.debug(f"Serving game root file: {filename}")
        return send_from_directory("static/Try_web_build", filename)
    except Exception as e:
        logger.error(f"Error serving game root file {filename}: {str(e)}")
        return "", 404

@app.route('/start-capture', methods=['POST'])
def start_capture():
    """Start capturing screenshots at regular intervals"""
    try:
        result = start_screenshot_capture()
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error starting capture: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/stop-capture', methods=['POST'])
def stop_capture():
    """Stop capturing screenshots"""
    try:
        result = stop_screenshot_capture()
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error stopping capture: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/static/js/UnityVideoRecorder.js')
def serve_video_recorder_js():
    """Serve the UnityVideoRecorder.js file"""
    try:
        return send_from_directory('static/js', 'UnityVideoRecorder.js')
    except Exception as e:
        logger.error(f"Error serving UnityVideoRecorder.js: {str(e)}")
        return "", 404

@app.route('/static/js/FindGameObjects.js')
def serve_find_gameobjects_js():
    """Serve the FindGameObjects.js helper file"""
    try:
        return send_from_directory('static/js', 'FindGameObjects.js')
    except Exception as e:
        logger.error(f"Error serving FindGameObjects.js: {str(e)}")
        return "", 404

@app.route('/download-screenshots', methods=['GET'])
def download_screenshots():
    """Download all captured screenshots as a ZIP file"""
    try:
        zip_file = get_screenshots_zip()
        
        if not zip_file:
            return jsonify({"error": "No screenshots available"}), 400
        
        # Return the ZIP file
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        return send_file(
            zip_file,
            mimetype='application/zip',
            as_attachment=True,
            download_name=f'simulation_screenshots_{timestamp}.zip'
        )
    except Exception as e:
        logger.error(f"Error downloading screenshots: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/healthz')
def health_check():
    try:
        return jsonify({"status": "healthy"}), 200
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

# Socket.IO event handlers
@socketio.on('connect')
def handle_connect():
    logger.info('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    logger.info('Client disconnected')

@socketio.on_error()
def handle_error(e):
    logger.error(f'SocketIO error: {str(e)}')

if __name__ == '__main__':
    logger.info(f"Template directory: {template_dir}")
    logger.info(f"Static directory: {static_dir}")
    
    # Check if directories exist
    if not os.path.exists(template_dir):
        logger.error(f"Template directory does not exist: {template_dir}")
    if not os.path.exists(static_dir):
        logger.error(f"Static directory does not exist: {static_dir}")
    
    # Start server with explicit host binding to localhost only
    socketio.run(app, host='127.0.0.1', port=5001, debug=True, use_reloader=True)