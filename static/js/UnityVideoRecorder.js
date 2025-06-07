/**
 * UnityVideoRecorder.js - Video recording functionality for Unity WebGL simulations
 * 
 * This script enables screen recording of Unity WebGL simulations and handles the
 * complete recording lifecycle:
 * - Starting recording when simulation begins
 * - Stopping and downloading recording when simulation stops
 * - Managing recording UI and status indicators
 */

class UnityVideoRecorder {
    constructor(options = {}) {
      // Configuration with defaults
      this.config = {
        fps: options.fps || 30,
        videoBitsPerSecond: options.videoBitsPerSecond || 2500000,
        mimeType: 'video/webm;codecs=vp9',
        canvasSelector: options.canvasSelector || '#unity-canvas',
        filename: options.filename || 'simulation-recording',
        showNotifications: options.showNotifications !== false,
        autoStart: options.autoStart !== false,
        autoDownload: options.autoDownload !== false,
        maxRecordingTime: options.maxRecordingTime || 300000, // 5 minutes
      };
  
      // Initialize state
      this.mediaRecorder = null;
      this.recordedChunks = [];
      this.recordingStartTime = null;
      this.isRecording = false;
      this.canvas = null;
      this.stream = null;
      this.recordingTimer = null;
      this.customUI = {};
  
      // Bind methods to maintain 'this' context
      this.startRecording = this.startRecording.bind(this);
      this.stopRecording = this.stopRecording.bind(this);
      this.downloadRecording = this.downloadRecording.bind(this);
      this.createUI = this.createUI.bind(this);
      this.showNotification = this.showNotification.bind(this);
      this.setupEventListeners = this.setupEventListeners.bind(this);
      
      // Set up UI if desired
      if (options.createUI !== false) {
        this.createUI();
      }
  
      // Check browser compatibility
      this.checkCompatibility();
      
      // Set up event listeners
      this.setupEventListeners();
  
      console.log('UnityVideoRecorder initialized');
    }
  
    /**
     * Check if the browser supports the required APIs
     */
    checkCompatibility() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        console.error('Screen Capture API is not supported in this browser');
        this.showNotification('Recording not supported in this browser', 'error');
        return false;
      }
  
      const mimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
      ];
  
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          this.config.mimeType = type;
          console.log(`Using mime type: ${type}`);
          return true;
        }
      }
  
      console.error('No supported mime types found for video recording');
      this.showNotification('Video recording not supported in this browser', 'error');
      return false;
    }
  
    /**
     * Create recording UI elements
     */
    createUI() {
      // Recording button
      const recordButton = document.createElement('button');
      recordButton.id = 'video-record-button';
      recordButton.className = 'control-button';
      recordButton.innerHTML = `
        <svg class="button-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="3" fill="currentColor"></circle>
        </svg>
        Start Recording
      `;
      recordButton.style.position = 'absolute';
      recordButton.style.top = '70px';
      recordButton.style.right = '80px';
      recordButton.style.zIndex = '100';
      recordButton.style.backgroundColor = '#BA0C2F';
      recordButton.style.display = 'none'; // Hide initially, will show when simulation starts
  
      // Recording status indicator
      const statusIndicator = document.createElement('div');
      statusIndicator.id = 'recording-status';
      statusIndicator.style.position = 'absolute';
      statusIndicator.style.bottom = '20px';
      statusIndicator.style.left = '50%';
      statusIndicator.style.transform = 'translateX(-50%)';
      statusIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      statusIndicator.style.borderRadius = '20px';
      statusIndicator.style.padding = '8px 16px';
      statusIndicator.style.display = 'none';
      statusIndicator.style.alignItems = 'center';
      statusIndicator.style.gap = '8px';
      statusIndicator.style.zIndex = '10';
      statusIndicator.style.color = 'white';
      statusIndicator.style.fontSize = '14px';
      statusIndicator.innerHTML = `
        <span class="indicator-dot" style="width: 10px; height: 10px; border-radius: 50%; background-color: #ff0000; display: inline-block; animation: pulse 1s infinite;"></span>
        <span class="recording-time">00:00</span>
      `;
  
      // Append UI elements to document
      document.body.appendChild(recordButton);
      document.body.appendChild(statusIndicator);
  
      // Add pulse animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `;
      document.head.appendChild(style);
  
      // Store references to UI elements
      this.customUI = {
        recordButton,
        statusIndicator,
        timeDisplay: statusIndicator.querySelector('.recording-time')
      };
  
      // Add event listeners
      recordButton.addEventListener('click', () => {
        if (this.isRecording) {
          this.stopRecording();
        } else {
          this.startRecording();
        }
      });
    }
  
    /**
     * Set up event listeners for simulation control buttons
     */
    setupEventListeners() {
      // Connect to start button
      const startButton = document.getElementById('startButton');
      if (startButton && this.config.autoStart) {
        startButton.addEventListener('click', () => {
          // Wait for Unity to initialize
          setTimeout(() => {
            if (this.customUI.recordButton) {
              this.customUI.recordButton.style.display = 'flex';
            }
          }, 2000);
        });
      }
  
      // Connect to stop button
      const stopButton = document.getElementById('stop-button');
      if (stopButton && this.config.autoDownload) {
        stopButton.addEventListener('click', () => {
          if (this.isRecording) {
            this.stopRecording();
          }
        });
      }
  
      // Add event listener for page unload
      window.addEventListener('beforeunload', (e) => {
        if (this.isRecording) {
          this.stopRecording(false); // Stop without downloading
          e.preventDefault();
          e.returnValue = 'Recording in progress. Are you sure you want to leave?';
          return e.returnValue;
        }
      });
    }
  
    /**
     * Start recording the canvas
     */
    async startRecording() {
        try {
          if (this.isRecording) {
            console.warn('Recording already in progress');
            return;
          }
      
          console.log("Attempting to start recording...");
          this.showNotification('Preparing to record...');
      
          // Find canvas element
          this.canvas = document.querySelector(this.config.canvasSelector);
          if (!this.canvas) {
            console.error(`Canvas not found: ${this.config.canvasSelector}`);
            this.showNotification(`Canvas not found: ${this.config.canvasSelector}`, 'error');
            return;
          }
          console.log("Canvas found:", this.canvas);
      
          try {
            // Use tab capture as a workaround if available
            this.stream = await navigator.mediaDevices.getDisplayMedia({
              video: {
                displaySurface: 'browser',
                cursor: 'never',
                frameRate: this.config.fps
              },
              audio: false
            });
            
            console.log("Display media obtained successfully");
          } catch (err) {
            console.error("Error getting display media:", err);
            this.showNotification(`Please share your screen to record the simulation`, 'warning');
            return;
          }
      
          // Initialize MediaRecorder
          this.mediaRecorder = new MediaRecorder(this.stream, {
            mimeType: this.config.mimeType,
            videoBitsPerSecond: this.config.videoBitsPerSecond
          });
      
          // Set up recording chunks
          this.recordedChunks = [];
          this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              this.recordedChunks.push(event.data);
            }
          };
      
          // Handle recording stop
          this.mediaRecorder.onstop = () => {
            this.stream.getTracks().forEach(track => track.stop());
            
            if (this.config.autoDownload) {
              this.downloadRecording();
            }
            
            this.updateUI(false);
            this.showNotification('Recording stopped');
            
            clearInterval(this.recordingTimer);
            this.isRecording = false;
          };
      
          // Start recording
          this.mediaRecorder.start(1000); // Capture in 1-second chunks
          console.log("MediaRecorder started, state:", this.mediaRecorder.state);
          
          this.recordingStartTime = Date.now();
          this.isRecording = true;
          
          // Start recording timer
          this.startRecordingTimer();
          
          // Update UI
          this.updateUI(true);
          this.showNotification('Recording started. Please select the browser tab to capture.');
      
          // Set max recording time safety limit if configured
          if (this.config.maxRecordingTime > 0) {
            setTimeout(() => {
              if (this.isRecording && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.showNotification('Maximum recording time reached');
                this.stopRecording();
              }
            }, this.config.maxRecordingTime);
          }
      
          console.log('Recording started successfully');
        } catch (error) {
          console.error('Error starting recording:', error);
          this.showNotification(`Recording error: ${error.message}`, 'error');
          this.isRecording = false;
          this.updateUI(false);
        }
      }
  
    /**
     * Stop recording
     */
    stopRecording(withDownload = true) {
      if (!this.isRecording || !this.mediaRecorder) {
        console.warn('No active recording to stop');
        return;
      }
  
      try {
        // Only stop if currently recording
        if (this.mediaRecorder.state === 'recording') {
          this.config.autoDownload = withDownload;
          this.mediaRecorder.stop();
          console.log('Recording stopped');
        }
      } catch (error) {
        console.error('Error stopping recording:', error);
        this.showNotification(`Error stopping recording: ${error.message}`, 'error');
      }
    }
  
    /**
     * Download the recorded video
     */
    downloadRecording() {
      if (this.recordedChunks.length === 0) {
        console.warn('No recorded data available');
        this.showNotification('No recording data available', 'warning');
        return;
      }
  
      try {
        // Create blob from recorded chunks
        const blob = new Blob(this.recordedChunks, { type: this.config.mimeType });
        
        // Generate timestamped filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${this.config.filename}-${timestamp}.webm`;
        
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
        }, 100);
  
        this.showNotification('Recording downloaded');
        console.log(`Recording downloaded as ${filename}`);
      } catch (error) {
        console.error('Error downloading recording:', error);
        this.showNotification(`Error downloading: ${error.message}`, 'error');
      }
    }
  
    /**
     * Start the recording timer display
     */
    startRecordingTimer() {
      if (!this.customUI.timeDisplay) return;
      
      this.recordingTimer = setInterval(() => {
        if (!this.recordingStartTime) return;
        
        const elapsedMs = Date.now() - this.recordingStartTime;
        const seconds = Math.floor((elapsedMs / 1000) % 60);
        const minutes = Math.floor((elapsedMs / (1000 * 60)) % 60);
        
        this.customUI.timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }, 1000);
    }
  
    /**
     * Update UI elements based on recording state
     */
    updateUI(isRecording) {
      if (this.customUI.recordButton) {
        if (isRecording) {
          this.customUI.recordButton.innerHTML = `
            <svg class="button-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="6" y="6" width="12" height="12" rx="1"></rect>
            </svg>
            Stop Recording
          `;
          this.customUI.recordButton.style.backgroundColor = '#333333';
        } else {
          this.customUI.recordButton.innerHTML = `
            <svg class="button-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <circle cx="12" cy="12" r="3" fill="currentColor"></circle>
            </svg>
            Start Recording
          `;
          this.customUI.recordButton.style.backgroundColor = '#BA0C2F';
        }
      }
  
      if (this.customUI.statusIndicator) {
        this.customUI.statusIndicator.style.display = isRecording ? 'flex' : 'none';
      }
    }
  
    /**
     * Show notification to user
     */
    showNotification(message, type = 'info') {
      if (!this.config.showNotifications) return;
      
      // Check if notification container exists, create if not
      let notificationContainer = document.getElementById('notification-container');
      if (!notificationContainer) {
        // Use existing notification container if available in the template
        notificationContainer = document.getElementById('notification-container');
        if (!notificationContainer) {
          console.warn('Notification container not found, creating one');
          // Create basic notification if needed
          notificationContainer = document.createElement('div');
          notificationContainer.id = 'notification-container';
          notificationContainer.style.position = 'fixed';
          notificationContainer.style.top = '80px';
          notificationContainer.style.left = '50%';
          notificationContainer.style.transform = 'translateX(-50%)';
          notificationContainer.style.zIndex = '1000';
          notificationContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
          notificationContainer.style.borderRadius = '8px';
          notificationContainer.style.padding = '16px 24px';
          notificationContainer.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)';
          notificationContainer.style.display = 'flex';
          notificationContainer.style.alignItems = 'center';
          notificationContainer.style.justifyContent = 'center';
          notificationContainer.style.transition = 'all 0.3s ease';
          notificationContainer.style.borderLeft = '4px solid #BA0C2F';
          notificationContainer.style.maxWidth = '90%';
          notificationContainer.style.width = 'auto';
          document.body.appendChild(notificationContainer);
        }
      }
      
      // Set color based on type
      let borderColor = '#BA0C2F';
      switch (type) {
        case 'error':
          borderColor = '#EF4444';
          break;
        case 'warning':
          borderColor = '#F59E0B';
          break;
        case 'success':
          borderColor = '#10B981';
          break;
      }
      notificationContainer.style.borderLeftColor = borderColor;
      
      // Update content
      notificationContainer.innerHTML = `
        <div style="display: flex; align-items: center; color: white; font-family: 'Inter', sans-serif;">
          <div style="margin-right: 16px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
            ${type === 'info' ? 
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>' : 
              type === 'error' ? 
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>' :
              type === 'warning' ?
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>' :
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
            }
          </div>
          <div style="font-size: 16px; font-weight: 500;">${message}</div>
        </div>
      `;
      
      // Make visible
      notificationContainer.style.opacity = '1';
      notificationContainer.style.visibility = 'visible';
      
      // Auto-hide after delay
      setTimeout(() => {
        notificationContainer.style.opacity = '0';
        notificationContainer.style.visibility = 'hidden';
      }, 3000);
    }
  }
  
  // Auto-initialize if window is loaded
  window.addEventListener('DOMContentLoaded', () => {
    // Wait for Unity to initialize
    setTimeout(() => {
      try {
        window.unityVideoRecorder = new UnityVideoRecorder();
        console.log('Video recorder initialized');
      } catch (e) {
        console.error('Error initializing video recorder:', e);
      }
    }, 2000);
  });
  
  // Expose globally
  window.UnityVideoRecorder = UnityVideoRecorder;