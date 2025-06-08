/**
 * UnityVideoRecorder.js - Simple, Reliable Screen Recording for 4D Printing Simulator
 * 
 * This implementation prioritizes reliability and cross-browser compatibility:
 * 1. Ensures recording only starts after permissions are granted
 * 2. Pauses simulation until user grants screen recording permissions
 * 3. Only stops recording when the stop button is clicked
 * 4. Works across all major browsers
 */

class UnityVideoRecorder {
  constructor() {
    // Recording state
    this.isRecording = false;
    this.isPaused = false;
    this.isWaitingForPermission = false;
    this.recordingStartTime = null;
    this.recordedChunks = [];
    
    // Media objects
    this.mediaRecorder = null;
    this.stream = null;
    
    // UI elements
    this.statusElement = document.getElementById('recording-status');
    this.timeDisplay = this.statusElement ? this.statusElement.querySelector('.recording-time') : null;
    this.notificationElement = document.getElementById('recorder-notification-container');
    if (!this.notificationElement) {
      this.createNotificationElement();
    }
    
    // Reference to Unity
    this.unityInstance = null;
    this.gameManagerName = "GameManager"; // Default name
    
    // Recording settings
    this.settings = {
      filename: 'simulation-recording',
      autoDownload: true,
      format: 'webm'
    };
    
    // Capture original Unity elements state
    this.originalState = {
      statusText: null,
      pauseButtonHtml: null
    };
    
    // Timers
    this.recordingTimer = null;
    
    // Bind methods to maintain correct 'this' context
    this.startRecording = this.startRecording.bind(this);
    this.stopRecording = this.stopRecording.bind(this);
    this.updateTimer = this.updateTimer.bind(this);
    this.showNotification = this.showNotification.bind(this);
    this.hideNotification = this.hideNotification.bind(this);
    this.findUnityInstance = this.findUnityInstance.bind(this);
    
    // Initialize
    this.initialize();
  }
  
  /**
   * Initialize the recorder
   */
  initialize() {
    console.log('Initializing Unity Video Recorder...');
    
    // Find Unity instance
    this.findUnityInstance();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Check browser support
    if (!this.checkBrowserSupport()) {
      console.warn('Browser does not support screen recording');
      this.showNotification('This browser does not support screen recording.', 'error', 5000);
      return;
    }
    
    console.log('UnityVideoRecorder initialized successfully');
  }
  
  /**
   * Create notification element
   */
  createNotificationElement() {
    this.notificationElement = document.createElement('div');
    this.notificationElement.id = 'recorder-notification-container';
    this.notificationElement.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      background-color: rgba(0, 0, 0, 0.85);
      border-radius: 8px;
      padding: 16px 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      border-left: 4px solid #BA0C2F;
      max-width: 90%;
      width: auto;
      opacity: 0;
      visibility: hidden;
      font-family: 'Inter', sans-serif;
      color: white;
    `;
    document.body.appendChild(this.notificationElement);
  }
  
  /**
   * Check if browser supports screen recording
   */
  checkBrowserSupport() {
    // Check for MediaRecorder API
    if (!window.MediaRecorder) {
      return false;
    }
    
    // Check for screen capture support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Handle stop button click
    const stopButton = document.getElementById('stop-button');
    if (stopButton) {
      stopButton.addEventListener('click', () => {
        if (this.isRecording) {
          console.log('Stop button clicked, stopping recording');
          this.stopRecording();
        }
      });
    }
    
    // Hook into Unity status updates
    if (typeof window.updateStatus === 'function') {
      const originalUpdateStatus = window.updateStatus;
      window.updateStatus = (status) => {
        // Call original function
        originalUpdateStatus(status);
        
        // Start recording when simulation starts running (if not already started)
        if (status === "Running" && !this.isRecording && !this.isWaitingForPermission) {
          setTimeout(() => {
            console.log("Simulation running detected, starting recording");
            this.startRecording();
          }, 500);
        }
      };
    }
    
    // Handle page unload
    window.addEventListener('beforeunload', (e) => {
      if (this.isRecording) {
        this.stopRecording(false);
        e.preventDefault();
        e.returnValue = 'Recording in progress. Are you sure you want to leave?';
        return e.returnValue;
      }
    });
  }
  
  /**
   * Find Unity instance and game manager
   */
  findUnityInstance() {
    // Try different ways to find Unity instance
    if (window.gameInstance) {
      this.unityInstance = window.gameInstance;
      console.log('Found Unity instance via gameInstance');
    } else if (window.unityInstance) {
      this.unityInstance = window.unityInstance;
      console.log('Found Unity instance via unityInstance');
    }
    
    // If found, try to detect game manager name
    if (this.unityInstance) {
      const possibleNames = [
        "GameManager",
        "GameManger", // Common typo
        "SimulationManager",
        "GameController"
      ];
      
      for (const name of possibleNames) {
        try {
          this.unityInstance.SendMessage(name, "TestMessage");
          this.gameManagerName = name;
          console.log(`Found game manager: ${name}`);
          return;
        } catch (e) {
          // Just try the next name
        }
      }
    }
    
    // If Unity not found immediately, check again later
    setTimeout(() => {
      if (!this.unityInstance) {
        this.findUnityInstance();
      }
    }, 2000);
  }
  
  /**
   * Pause simulation while waiting for permission
   */
  pauseSimulation() {
    if (!this.unityInstance) return;
    
    try {
      // Store original state
      const statusText = document.getElementById('status-text');
      if (statusText) {
        this.originalState.statusText = statusText.textContent;
        statusText.textContent = 'Waiting for Permission';
      }
      
      const pauseButton = document.getElementById('pause-button');
      if (pauseButton) {
        this.originalState.pauseButtonHtml = pauseButton.innerHTML;
        pauseButton.disabled = true;
        pauseButton.innerHTML = `
          <svg class="button-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          Waiting...
        `;
      }
      
      // Pause simulation using multiple approaches for compatibility
      // 1. Direct method used in your code
      this.unityInstance.SendMessage(this.gameManagerName, "pauseF", "true");
      this.unityInstance.SendMessage(this.gameManagerName, "prevStateF", "true");
      this.unityInstance.SendMessage(this.gameManagerName, "timesStateSetF", "true");
      
      // 2. Alternative approaches as backup
      try { this.unityInstance.SendMessage(this.gameManagerName, "PauseSimulation"); } catch(e) {}
      try { this.unityInstance.SendMessage(this.gameManagerName, "SetTimeScale", "0"); } catch(e) {}
      
      console.log('Simulation paused while waiting for screen recording permission');
    } catch (error) {
      console.warn('Error pausing simulation:', error);
    }
  }
  
  /**
   * Resume simulation after permission is granted or denied
   */
  resumeSimulation() {
    if (!this.unityInstance) return;
    
    try {
      // Restore original state
      const statusText = document.getElementById('status-text');
      if (statusText && this.originalState.statusText) {
        statusText.textContent = this.originalState.statusText;
      }
      
      const pauseButton = document.getElementById('pause-button');
      if (pauseButton) {
        pauseButton.disabled = false;
        if (this.originalState.pauseButtonHtml) {
          pauseButton.innerHTML = this.originalState.pauseButtonHtml;
        } else {
          pauseButton.innerHTML = `
            <svg class="button-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="6" y="4" width="4" height="16"></rect>
              <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
            Pause
          `;
        }
      }
      
      // Resume simulation using multiple approaches for compatibility
      // 1. Direct method used in your code
      this.unityInstance.SendMessage(this.gameManagerName, "pauseF", "false");
      this.unityInstance.SendMessage(this.gameManagerName, "prevStateF", "false");
      this.unityInstance.SendMessage(this.gameManagerName, "timesStateSetF", "true");
      
      // 2. Alternative approaches as backup
      try { this.unityInstance.SendMessage(this.gameManagerName, "ResumeSimulation"); } catch(e) {}
      try { this.unityInstance.SendMessage(this.gameManagerName, "SetTimeScale", "1"); } catch(e) {}
      
      console.log('Simulation resumed after screen recording permission');
    } catch (error) {
      console.warn('Error resuming simulation:', error);
    }
  }
  
  /**
   * Start recording
   */
  async startRecording() {
    if (this.isRecording || this.isWaitingForPermission) {
      console.log('Recording already in progress or waiting for permission');
      return;
    }
    
    try {
      this.isWaitingForPermission = true;
      
      // Pause simulation while we get permission
      this.pauseSimulation();
      
      // Show permission notification
      this.showNotification('Please select your browser tab in the prompt', 'info', 0); // Persistent
      
      // Request screen capture permission
      let stream;
      try {
        const displayMediaOptions = {
          video: {
            cursor: "always",
            displaySurface: "browser"
          },
          audio: false
        };
        
        stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
      } catch (error) {
        console.error('Error getting screen capture permission:', error);
        this.showNotification('Screen recording permission denied', 'error', 3000);
        this.isWaitingForPermission = false;
        this.resumeSimulation();
        return;
      }
      
      // Hide the permission notification
      this.hideNotification();
      
      // Resume simulation
      this.resumeSimulation();
      
      // Find supported MIME type
      let mimeType = 'video/webm';
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        mimeType = 'video/webm;codecs=vp9';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
        mimeType = 'video/webm;codecs=vp8';
      }
      
      // Create MediaRecorder
      this.stream = stream;
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 2500000
      });
      
      // Set up event handlers
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.onstop = () => {
        // Clean up
        this.stream.getTracks().forEach(track => track.stop());
        
        // Download if enabled
        if (this.settings.autoDownload) {
          this.downloadRecording();
        }
        
        // Update state
        this.isRecording = false;
        this.recordingStartTime = null;
        clearInterval(this.recordingTimer);
        
        // Hide recording status
        if (this.statusElement) {
          this.statusElement.style.display = 'none';
        }
        
        console.log('Recording completed');
      };
      
      // Handle user stopping screen share
      this.stream.getVideoTracks()[0].onended = () => {
        if (this.isRecording) {
          console.log('Screen sharing ended by user');
          this.stopRecording();
        }
      };
      
      // Start recording
      this.mediaRecorder.start(1000); // Collect data in 1-second chunks
      
      // Update state
      this.isWaitingForPermission = false;
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      
      // Show recording indicator
      if (this.statusElement) {
        this.statusElement.style.display = 'flex';
      }
      
      // Start timer
      this.updateTimer();
      this.recordingTimer = setInterval(this.updateTimer, 1000);
      
      console.log('Recording started successfully');
    } catch (error) {
      console.error('Error starting recording:', error);
      this.showNotification('Error starting recording: ' + error.message, 'error', 5000);
      this.isWaitingForPermission = false;
      this.resumeSimulation();
    }
  }
  
  /**
   * Stop recording
   */
  stopRecording() {
    if (!this.isRecording) {
      console.log('No recording to stop');
      return;
    }
    
    try {
      // Stop MediaRecorder
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      
      // This will trigger mediaRecorder.onstop which handles cleanup
      console.log('Stopping recording...');
    } catch (error) {
      console.error('Error stopping recording:', error);
      this.showNotification('Error stopping recording', 'error', 3000);
      
      // Attempt cleanup even if error occurs
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
      }
      
      // Update state
      this.isRecording = false;
      clearInterval(this.recordingTimer);
      
      // Hide recording status
      if (this.statusElement) {
        this.statusElement.style.display = 'none';
      }
    }
  }
  
  /**
   * Download the recorded video
   */
  downloadRecording() {
    if (this.recordedChunks.length === 0) {
      console.warn('No recorded data to download');
      return;
    }
    
    try {
      // Create blob from recorded chunks
      const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${this.settings.filename}-${timestamp}.${this.settings.format}`;
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      
      // Trigger download
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.recordedChunks = []; // Clear chunks after download
      }, 100);
      
      console.log(`Recording downloaded as ${filename}`);
      this.showNotification('Recording downloaded', 'success', 3000);
    } catch (error) {
      console.error('Error downloading recording:', error);
      this.showNotification('Error downloading recording', 'error', 3000);
    }
  }
  
  /**
   * Update the recording timer display
   */
  updateTimer() {
    if (!this.timeDisplay || !this.recordingStartTime) return;
    
    const elapsed = Date.now() - this.recordingStartTime;
    const seconds = Math.floor((elapsed / 1000) % 60);
    const minutes = Math.floor((elapsed / (1000 * 60)) % 60);
    
    this.timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  /**
   * Show a notification to the user
   */
  showNotification(message, type = 'info', duration = 3000) {
    if (!this.notificationElement) return;
    
    // Set color based on type
    let borderColor = '#BA0C2F'; // Default UGA Red
    switch (type) {
      case 'error': borderColor = '#EF4444'; break; // Red
      case 'warning': borderColor = '#F59E0B'; break; // Amber
      case 'success': borderColor = '#10B981'; break; // Green
    }
    
    // Set border color
    this.notificationElement.style.borderLeftColor = borderColor;
    
    // Create icon based on type
    let icon = '';
    switch (type) {
      case 'info':
        icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
        break;
      case 'error':
        icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
        break;
      case 'warning':
        icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
        break;
      case 'success':
        icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
        break;
    }
    
    // Update content
    this.notificationElement.innerHTML = `
      <div style="display: flex; align-items: center; color: white; font-family: 'Inter', sans-serif;">
        <div style="margin-right: 16px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
          ${icon}
        </div>
        <div style="font-size: 16px; font-weight: 500;">${message}</div>
      </div>
    `;
    
    // Show notification
    this.notificationElement.style.opacity = '1';
    this.notificationElement.style.visibility = 'visible';
    
    // Auto-hide after duration (if not persistent)
    if (duration > 0) {
      setTimeout(() => {
        this.hideNotification();
      }, duration);
    }
  }
  
  /**
   * Hide the notification
   */
  hideNotification() {
    if (!this.notificationElement) return;
    
    this.notificationElement.style.opacity = '0';
    this.notificationElement.style.visibility = 'hidden';
  }
}

// Initialize the recorder when the page loads
window.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for Unity to initialize
  setTimeout(() => {
    try {
      window.unityVideoRecorder = new UnityVideoRecorder();
      console.log('Video recorder initialized');
    } catch (e) {
      console.error('Error initializing video recorder:', e);
    }
  }, 2000);
});

// Make it globally available
window.UnityVideoRecorder = UnityVideoRecorder;