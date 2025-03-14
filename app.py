from flask import Flask, request, jsonify, render_template, send_from_directory, redirect, send_file
from flask_cors import CORS  # Allow WebGL CORS requests
import os
import datetime
from screenshot_handler import start_screenshot_capture, stop_screenshot_capture, get_screenshots_zip

app = Flask(__name__, static_folder="static", template_folder="templates")  # Ensure Flask serves static files
CORS(app, resources={r"/*": {"origins": "*"}})  # Allow all CORS requests

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
    """Automatically upgrade HTTP to HTTPS in production"""
    if "localhost" not in request.url and request.headers.get("X-Forwarded-Proto", "http") == "http":
        url = request.url.replace("http://", "https://", 1)
        return redirect(url, code=301)

# Serve the Self-Organization page (main landing page)
@app.route('/')
def index():
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

# ✅ Serve Build files properly
@app.route('/game/Build/<path:filename>')
def serve_build_files(filename):
    try:
        return send_from_directory("static/Try_web_build/Build", filename)
    except Exception as e:
        print(f"Error serving build file {filename}: {str(e)}")
        return "", 404

# ✅ Serve TemplateData files
@app.route('/game/TemplateData/<path:filename>')
def serve_template_files(filename):
    try:
        return send_from_directory("static/Try_web_build/TemplateData", filename)
    except Exception as e:
        print(f"Error serving template file {filename}: {str(e)}")
        return "", 404

# ✅ Add a route for root-level static files in Try_web_build
@app.route('/game/<path:filename>')
def serve_game_root_files(filename):
    return send_from_directory("static/Try_web_build", filename)

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

@app.route('/healthz')
def health_check():
    try:
        return jsonify({"status": "healthy"}), 200
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

# if __name__ == '__main__':
#     app.run(host="0.0.0.0", port=5000, debug=True)


#  For production with gunicorn
app.config['PROPAGATE_EXCEPTIONS'] = True