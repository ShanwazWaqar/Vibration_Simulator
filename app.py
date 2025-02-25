from flask import Flask, request, jsonify, render_template, send_from_directory, redirect
from flask_cors import CORS  # Allow WebGL CORS requests
import os

app = Flask(__name__, static_folder="static", template_folder="templates")  # Ensure Flask serves static files
CORS(app, resources={r"/*": {"origins": "*"}})  # Allow all CORS requests

# Store received parameters
simulation_data = {}

@app.before_request
def before_request():
    """Automatically upgrade HTTP to HTTPS in production"""
    if "localhost" not in request.url and request.headers.get("X-Forwarded-Proto", "http") == "http":
        url = request.url.replace("http://", "https://", 1)
        return redirect(url, code=301)

# Serve the HTML form where the user enters parameters
@app.route('/')
def index():
    return render_template('index.html')

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