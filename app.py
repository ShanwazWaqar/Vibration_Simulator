from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS  # Allow WebGL CORS requests
import os

app = Flask(__name__, static_folder="static",template_folder="templates")  # Ensure Flask serves static files
CORS(app)  # Enable CORS to avoid browser security issues

# Store received parameters
simulation_data = {}

# Serve the HTML form where the user enters parameters
@app.route('/')
def index():
    return render_template('index.html')

# Handle form submission and redirect to Unity WebGL game
@app.route('/set-data', methods=['POST'])
def set_data():
    global simulation_data
    simulation_data = request.json  # Store received data
    print("Received Data:", simulation_data)

    # Redirect to the Unity WebGL game
    return jsonify({"message": "Data received! Redirecting...", "redirect_url": "/game"})

# Unity WebGL fetches stored parameters
@app.route('/get-data', methods=['GET'])
def get_data():
    return jsonify(simulation_data)  # Unity fetches this

# ✅ FIX: Serve Unity WebGL `index.html`
@app.route('/game')
def game():
    return send_from_directory("static/Try_web_build", "index.html")

# # ✅ FIX: Serve **all** Unity WebGL files (CSS, JS, Data, WASM)
# @app.route('/game/<path:filename>')
# def serve_game_files(filename):
#     webgl_folder = os.path.join("static", "Try_web_build")  # Full path to WebGL files
#     return send_from_directory(webgl_folder, filename)  # Serve WebGL files

@app.route('/game/Build/<path:filename>')
def serve_build_files(filename):
    return send_from_directory("static/Try_web_build/Build", filename)

@app.route('/game/TemplateData/<path:filename>')
def serve_template_files(filename):
    return send_from_directory("static/Try_web_build/TemplateData", filename)

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000, debug=True)
