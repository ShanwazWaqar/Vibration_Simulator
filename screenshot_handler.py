import os
import time
import datetime
import threading
from io import BytesIO
from zipfile import ZipFile
from PIL import ImageGrab

# Create screenshots directory
SCREENSHOT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'screenshots')
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

# Global variables for screenshot control
screenshot_thread = None
should_capture_screenshots = False
screenshot_interval = 60  # seconds
screenshots = []  # List to store paths to screenshots

def capture_screenshot():
    """Capture a screenshot of the entire screen"""
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"screenshot_{timestamp}.png"
    filepath = os.path.join(SCREENSHOT_DIR, filename)
    
    # Capture screenshot
    try:
        img = ImageGrab.grab()
        img.save(filepath)
        screenshots.append(filepath)
        print(f"Screenshot captured: {filepath}")
        return filepath
    except Exception as e:
        print(f"Error capturing screenshot: {e}")
        return None

def capture_screenshots_thread():
    """Thread function to capture screenshots at regular intervals"""
    global should_capture_screenshots, screenshots
    
    while should_capture_screenshots:
        try:
            capture_screenshot()
        except Exception as e:
            print(f"Error in screenshot thread: {e}")
        
        # Sleep for the interval
        time.sleep(screenshot_interval)

def start_screenshot_capture():
    """Start capturing screenshots at regular intervals"""
    global screenshot_thread, should_capture_screenshots, screenshots
    
    if screenshot_thread is None or not screenshot_thread.is_alive():
        # Clear previous screenshots
        screenshots = []
        
        # Take initial screenshot immediately
        try:
            capture_screenshot()
        except Exception as e:
            print(f"Error capturing initial screenshot: {e}")
        
        # Start background thread for regular captures
        should_capture_screenshots = True
        screenshot_thread = threading.Thread(target=capture_screenshots_thread)
        screenshot_thread.daemon = True
        screenshot_thread.start()
        
        return {"status": "started", "message": "Screenshot capture started"}
    
    return {"status": "already_running", "message": "Screenshot capture already running"}

def stop_screenshot_capture():
    """Stop capturing screenshots"""
    global should_capture_screenshots, screenshot_thread
    
    should_capture_screenshots = False
    
    # Take final screenshot
    try:
        capture_screenshot()
    except Exception as e:
        print(f"Error capturing final screenshot: {e}")
    
    if screenshot_thread and screenshot_thread.is_alive():
        screenshot_thread.join(timeout=1.0)
    
    return {
        "status": "stopped", 
        "message": "Screenshot capture stopped", 
        "screenshot_count": len(screenshots)
    }

def get_screenshots_zip():
    """Create a ZIP file with all screenshots"""
    global screenshots
    
    if not screenshots:
        return None
    import os
import time
import datetime
import threading
from io import BytesIO
from zipfile import ZipFile
from PIL import ImageGrab

# Create screenshots directory
SCREENSHOT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'screenshots')
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

# Global variables for screenshot control
screenshot_thread = None
should_capture_screenshots = False
screenshot_interval = 60  # seconds
screenshots = []  # List to store paths to screenshots

def capture_screenshot():
    """Capture a screenshot of the entire screen"""
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"screenshot_{timestamp}.png"
    filepath = os.path.join(SCREENSHOT_DIR, filename)
    
    # Capture screenshot
    try:
        img = ImageGrab.grab()
        img.save(filepath)
        screenshots.append(filepath)
        print(f"Screenshot captured: {filepath}")
        return filepath
    except Exception as e:
        print(f"Error capturing screenshot: {e}")
        return None

def capture_screenshots_thread():
    """Thread function to capture screenshots at regular intervals"""
    global should_capture_screenshots, screenshots
    
    while should_capture_screenshots:
        try:
            capture_screenshot()
        except Exception as e:
            print(f"Error in screenshot thread: {e}")
        
        # Sleep for the interval
        time.sleep(screenshot_interval)

def start_screenshot_capture():
    """Start capturing screenshots at regular intervals"""
    global screenshot_thread, should_capture_screenshots, screenshots
    
    if screenshot_thread is None or not screenshot_thread.is_alive():
        # Clear previous screenshots
        screenshots = []
        
        # Take initial screenshot immediately
        try:
            capture_screenshot()
        except Exception as e:
            print(f"Error capturing initial screenshot: {e}")
        
        # Start background thread for regular captures
        should_capture_screenshots = True
        screenshot_thread = threading.Thread(target=capture_screenshots_thread)
        screenshot_thread.daemon = True
        screenshot_thread.start()
        
        return {"status": "started", "message": "Screenshot capture started"}
    
    return {"status": "already_running", "message": "Screenshot capture already running"}

def stop_screenshot_capture():
    """Stop capturing screenshots"""
    global should_capture_screenshots, screenshot_thread
    
    should_capture_screenshots = False
    
    # Take final screenshot
    try:
        capture_screenshot()
    except Exception as e:
        print(f"Error capturing final screenshot: {e}")
    
    if screenshot_thread and screenshot_thread.is_alive():
        screenshot_thread.join(timeout=1.0)
    
    return {
        "status": "stopped", 
        "message": "Screenshot capture stopped", 
        "screenshot_count": len(screenshots)
    }

def get_screenshots_zip():
    """Create a ZIP file with all screenshots"""
    global screenshots
    
    if not screenshots:
        return None
    
    # Create in-memory ZIP file
    memory_file = BytesIO()
    with ZipFile(memory_file, 'w') as zf:
        for i, filepath in enumerate(screenshots):
            if os.path.exists(filepath):
                # Add file to the ZIP with a simplified name
                filename = os.path.basename(filepath)
                zf.write(filepath, filename)
    
    # Reset the file pointer
    memory_file.seek(0)
    return memory_file
    # Create in-memory ZIP file
    memory_file = BytesIO()
    with ZipFile(memory_file, 'w') as zf:
        for i, filepath in enumerate(screenshots):
            if os.path.exists(filepath):
                # Add file to the ZIP with a simplified name
                filename = os.path.basename(filepath)
                zf.write(filepath, filename)
    
    # Reset the file pointer
    memory_file.seek(0)
    return memory_file