from flask import Flask, request, jsonify, render_template, send_from_directory, redirect, send_file
from flask_cors import CORS  # Allow WebGL CORS requests
import os
# import datetime
import logging
import json
from screenshot_handler import start_screenshot_capture, stop_screenshot_capture, get_screenshots_zip
from datetime import datetime


# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app, resources={r"/*": {"origins": "*"}})  # Allow all CORS requests

# Configure app
app.config['PROPAGATE_EXCEPTIONS'] = True
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

# Store received parameters - updated with default values for simulator page
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
    """Automatically upgrade HTTP to HTTPS in production and log request info"""
    logger.debug(f"Request URL: {request.url}")
    logger.debug(f"Request path: {request.path}")
    
    if "localhost" not in request.url and "127.0.0.1" not in request.url and request.headers.get("X-Forwarded-Proto", "http") == "http":
        url = request.url.replace("http://", "https://", 1)
        return redirect(url, code=301)
    
@app.context_processor
def inject_now():
    return {'now': datetime.now()}

# Error handler for bad requests
@app.errorhandler(404)
def handle_not_found(e):
    logger.error(f"Not found: {request.path}")
    return "", 404

# Serve the Self-Organization page (main landing page)
@app.route('/')
def index():
    logger.info("Index route accessed!")
    return render_template('index.html')

# Serve the simulator introduction page with "Go to Simulator Form" button
@app.route('/simulator')
def simulator():
    return render_template('simulator.html')

# Serve the simulator configuration form page
@app.route('/simulator_form')
def simulator_form():
    return render_template('simulator-form.html', params=simulation_data)

# Handle form submission and redirect to Unity WebGL game
@app.route('/set-data', methods=['POST'])
def set_data():
    global simulation_data
    simulation_data = request.json
    print("Received Data:", simulation_data)
    return jsonify({"message": "Data received!", "redirect_url": "/game"})

# Unity WebGL fetches stored parameters
@app.route('/get-data', methods=['GET'])
def get_data():
    return jsonify(simulation_data)

# ✅ Serve Unity WebGL `index.html`
@app.route('/game')
def game():
    return send_from_directory("static/Try_web_build", "index.html")

# Allow direct access to favicon.ico
@app.route('/favicon.ico')
def favicon():
    try:
        logger.debug("Serving favicon.ico")
        return send_from_directory(os.path.join(app.static_folder, "Try_web_build", "TemplateData"), "favicon.ico")
    except Exception as e:
        logger.error(f"Error serving favicon: {str(e)}")
        return "", 404

# Serve style.css directly 
@app.route('/style.css')
def style_css():
    try:
        logger.debug("Serving style.css")
        return send_from_directory(os.path.join(app.static_folder, "Try_web_build", "TemplateData"), "style.css")
    except Exception as e:
        logger.error(f"Error serving style.css: {str(e)}")
        return "", 404

# Serve Try_web_build.loader.js directly (noted in your error screenshot)
@app.route('/Try_web_build.loader.js')
def loader_js():
    try:
        logger.debug("Serving Try_web_build.loader.js")
        return send_from_directory(os.path.join(app.static_folder, "Try_web_build"), "Try_web_build.loader.js")
    except Exception as e:
        logger.error(f"Error serving loader: {str(e)}")
        return "", 404

# Serve Unity WebGL files with proper prefixes
@app.route('/Build/<path:filename>')
def serve_build_files_direct(filename):
    try:
        logger.debug(f"Serving build file: {filename}")
        return send_from_directory(os.path.join(app.static_folder, "Try_web_build", "Build"), filename)
    except Exception as e:
        logger.error(f"Error serving build file {filename}: {str(e)}")
        return "", 404

@app.route('/TemplateData/<path:filename>')
def serve_template_files_direct(filename):
    try:
        logger.debug(f"Serving template file: {filename}")
        return send_from_directory(os.path.join(app.static_folder, "Try_web_build", "TemplateData"), filename)
    except Exception as e:
        logger.error(f"Error serving template file {filename}: {str(e)}")
        return "", 404

# The original routes with /game prefix
@app.route('/game/Build/<path:filename>')
def serve_build_files(filename):
    try:
        return send_from_directory(os.path.join(app.static_folder, "Try_web_build", "Build"), filename)
    except Exception as e:
        logger.error(f"Error serving build file {filename}: {str(e)}")
        return "", 404

@app.route('/game/TemplateData/<path:filename>')
def serve_template_files(filename):
    try:
        return send_from_directory(os.path.join(app.static_folder, "Try_web_build", "TemplateData"), filename)
    except Exception as e:
        logger.error(f"Error serving template file {filename}: {str(e)}")
        return "", 404

@app.route('/game/<path:filename>')
def serve_game_root_files(filename):
    try:
        return send_from_directory(os.path.join(app.static_folder, "Try_web_build"), filename)
    except Exception as e:
        logger.error(f"Error serving game file {filename}: {str(e)}")
        return "", 404

# Catch-all route for other static files
@app.route('/<path:filename>')
def serve_static_root_files(filename):
    try:
        # Check if it's an existing static file
        potential_path = os.path.join(app.static_folder, filename)
        if os.path.exists(potential_path) and os.path.isfile(potential_path):
            logger.debug(f"Serving static file: {filename}")
            return send_from_directory(app.static_folder, filename)
        
        # Check if it's a Unity build file
        potential_unity_path = os.path.join(app.static_folder, "Try_web_build", filename)
        if os.path.exists(potential_unity_path) and os.path.isfile(potential_unity_path):
            logger.debug(f"Serving Unity root file: {filename}")
            return send_from_directory(os.path.join(app.static_folder, "Try_web_build"), filename)
            
        logger.warning(f"File not found: {filename}")
        return "", 404
    except Exception as e:
        logger.error(f"Error serving file {filename}: {str(e)}")
        return "", 404

@app.route('/start-capture', methods=['POST'])
def start_capture():
    """Start capturing screenshots at regular intervals"""
    result = start_screenshot_capture()
    return jsonify(result)

@app.route('/stop-capture', methods=['POST'])
def stop_capture():
    """Stop capturing screenshots"""
    result = stop_screenshot_capture()
    return jsonify(result)

@app.route('/static/js/UnityVideoRecorder.js')
def serve_video_recorder_js():
    """Serve the UnityVideoRecorder.js file"""
    return send_from_directory('static/js', 'UnityVideoRecorder.js')

# If using a custom FindGameObjects script to help locate GameManager
@app.route('/static/js/FindGameObjects.js')
def serve_find_gameobjects_js():
    """Serve the FindGameObjects.js helper file"""
    return send_from_directory('static/js', 'FindGameObjects.js')

@app.route('/download-screenshots', methods=['GET'])
def download_screenshots():
    """Download all captured screenshots as a ZIP file"""
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

@app.route('/download-metrics', methods=['POST'])
def download_metrics():
    """Receive metrics data and return it as a downloadable file"""
    try:
        # Get JSON data from request
        metrics_data = request.json
        
        if not metrics_data:
            return jsonify({"error": "No metrics data received"}), 400
        
        # Log the incoming data
        logger.info(f"Received metrics data: {len(str(metrics_data))} bytes")
        
        # Generate a unique filename with timestamp
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"vibration_simulation_metrics_{timestamp}.json"
        
        # Create response with JSON file attachment
        response = make_response(json.dumps(metrics_data, indent=2))
        response.headers["Content-Disposition"] = f"attachment; filename={filename}"
        response.headers["Content-Type"] = "application/json"
        
        logger.info(f"Returning downloadable metrics file: {filename}")
        return response
        
    except Exception as e:
        logger.error(f"Error processing metrics download: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/healthz')
def health_check():
    try:
        return jsonify({"status": "healthy"}), 200
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

if __name__ == '__main__':
    # Print info about where we're serving from
    logger.info(f"Static folder: {app.static_folder}")
    logger.info(f"Template folder: {app.template_folder}")
    
    # Check key paths exist
    unity_path = os.path.join(app.static_folder, "Try_web_build")
    if not os.path.exists(unity_path):
        logger.error(f"Unity build path does not exist: {unity_path}")
    
    # Start the app on localhost for better security
    app.run(host="0.0.0.0", port=5000, debug=True)