/**
 * UnifiedRecorderLoader.js
 * 
 * Smart platform detection and initialization for simulation recording.
 * This script handles the complexities of choosing the right recording method
 * based on device capabilities and prevents duplicate initialization.
 */

class UnifiedRecorderLoader {
    constructor(options = {}) {
      // Default options
      this.options = Object.assign({
        canvasSelector: '#unity-canvas',
        fps: 30,
        fileName: 'simulation-recording',
        statusElementId: 'recording-status',
        timeDisplaySelector: '.recording-time',
        autoInitialize: true
      }, options);
      
      // State variables
      this.recorder = null;
      this.platform = null;
      this.isRecording = false;
      this.recordingTimer = null;
      this.recordingSeconds = 0;
      
      // UI elements
      this.statusElement = document.getElementById(this.options.statusElementId);
      this.timeDisplay = this.statusElement ? 
        this.statusElement.querySelector(this.options.timeDisplaySelector) : null;
      
      // Set global flag to prevent double initialization
      if (window.RECORDER_INITIALIZED) {
        console.log("A recorder is already initialized elsewhere");
        // Try to get the existing recorder
        this.recorder = window.unifiedRecorder || window.unityVideoRecorder;
        return;
      }
      
      // Flag to prevent auto initialization in other scripts
      window.DISABLE_AUTO_RECORDER_INIT = true;
      
      // Flag to show we're handling initialization
      window.RECORDER_INITIALIZED = true;
      
      // Detect platform
      this.detectPlatform();
      
      // Auto-initialize if configured
      if (this.options.autoInitialize) {
        this.initialize();
      }
    }
    
    /**
     * Detect platform capabilities
     */
    detectPlatform() {
      const ua = navigator.userAgent;
      
      this.platform = {
        isIOS: /iPad|iPhone|iPod/.test(ua) && !window.MSStream,
        isIPad: /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1),
        isAndroid: /Android/.test(ua),
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua),
        isDesktop: !(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)),
        browser: 'unknown',
        
        // Feature detection
        canvasStreamSupported: typeof HTMLCanvasElement !== 'undefined' && 
                             HTMLCanvasElement.prototype.captureStream,
        displayMediaSupported: navigator.mediaDevices && 
                              typeof navigator.mediaDevices.getDisplayMedia === 'function'
      };
      
      // Detect browser
      if (/CriOS/.test(ua)) {
        this.platform.browser = 'chrome-ios';
      } else if (/FxiOS/.test(ua)) {
        this.platform.browser = 'firefox-ios';
      } else if (/EdgiOS/.test(ua)) {
        this.platform.browser = 'edge-ios';
      } else if (/Chrome/.test(ua)) {
        this.platform.browser = 'chrome';
      } else if (/Firefox/.test(ua)) {
        this.platform.browser = 'firefox';
      } else if (/Safari/.test(ua)) {
        this.platform.browser = 'safari';
      } else if (/Edge|Edg/.test(ua)) {
        this.platform.browser = 'edge';
      }
      
      // Store the platform info for later access
      window.PLATFORM_INFO = this.platform;
      
      console.log('Platform detected:', this.platform);
      return this.platform;
    }
    
    /**
     * Determine if canvas recorder should be used
     */
    shouldUseCanvasRecorder() {
      // Always use canvas recorder on iOS
      if (this.platform.isIOS) {
        return true;
      }
      
      // Use canvas recorder on Android unless display media is supported
      if (this.platform.isAndroid) {
        return !this.platform.displayMediaSupported;
      }
      
      // User preference via options
      if (this.options.preferCanvasRecorder) {
        return true;
      }
      
      // Default to screen recording on desktop
      return false;
    }
    
    /**
     * Initialize the appropriate recorder
     */
    initialize() {
      console.log('Initializing recorder based on platform capabilities...');
      
      // Determine which recorder to use
      const useCanvasRecorder = this.shouldUseCanvasRecorder();
      console.log(useCanvasRecorder ? 
        'Using canvas recorder for this device' : 
        'Using screen recorder for this device');
      
      // Store the decision for other components
      window.USE_CANVAS_RECORDER = useCanvasRecorder;
      
      // Initialize the appropriate recorder
      if (useCanvasRecorder) {
        this.initializeCanvasRecorder();
      } else {
        this.initializeScreenRecorder();
      }
      
      // Set up recording events
      this.setupRecordingEvents();
      
      return this.recorder;
    }
    
    /**
     * Initialize canvas-based recorder
     */
    initializeCanvasRecorder() {
      try {
        // Check if UnityCanvasRecorder exists
        if (typeof UnityCanvasRecorder !== 'function') {
          console.error('UnityCanvasRecorder not found! Make sure to include UnityCanvasRecorder.js');
          // Try fallback to UnifiedRecorder
          return this.initializeUnifiedRecorder(true);
        }
        
        // Create canvas recorder instance
        this.recorder = new UnityCanvasRecorder({
          canvasSelector: this.options.canvasSelector,
          fps: this.options.fps,
          fileName: this.options.fileName,
          showIndicator: true,
          indicatorPosition: 'bottom-right',
          autoDownloadOnStop: !this.platform.isIOS // No auto-download on iOS
        });
        
        // Store globally for access from elsewhere
        window.canvasRecorder = this.recorder;
        
        console.log('Canvas recorder initialized successfully');
        return this.recorder;
      } catch (error) {
        console.error('Failed to initialize canvas recorder:', error);
        // Try fallback to UnifiedRecorder
        return this.initializeUnifiedRecorder(true);
      }
    }
    
    /**
     * Initialize screen-based recorder
     */
    initializeScreenRecorder() {
      try {
        // Check if UnityVideoRecorder exists
        if (typeof UnityVideoRecorder !== 'function' && 
            typeof window.unityVideoRecorder === 'undefined') {
          console.error('UnityVideoRecorder not found! Make sure to include UnityVideoRecorder.js');
          // Try fallback to UnifiedRecorder
          return this.initializeUnifiedRecorder(false);
        }
        
        // Use existing instance if available
        if (window.unityVideoRecorder) {
          this.recorder = window.unityVideoRecorder;
        } 
        // Or create a new instance if UnityVideoRecorder constructor is available
        else if (typeof UnityVideoRecorder === 'function') {
          this.recorder = new UnityVideoRecorder();
          window.unityVideoRecorder = this.recorder;
        }
        
        console.log('Screen recorder initialized successfully');
        return this.recorder;
      } catch (error) {
        console.error('Failed to initialize screen recorder:', error);
        // Try fallback to UnifiedRecorder
        return this.initializeUnifiedRecorder(false);
      }
    }
    
    /**
     * Initialize UnifiedRecorder as a fallback
     */
    initializeUnifiedRecorder(preferCanvas) {
      try {
        // Check if UnifiedRecorder exists
        if (typeof UnifiedRecorder !== 'function') {
          console.error('UnifiedRecorder not found! Make sure to include UnifiedRecorder.js');
          return null;
        }
        
        // Create unified recorder instance
        this.recorder = new UnifiedRecorder({
          canvasSelector: this.options.canvasSelector,
          fps: this.options.fps,
          fileName: this.options.fileName,
          preferCanvasRecorder: preferCanvas,
          autoInitialize: true
        });
        
        // Store globally
        window.unifiedRecorder = this.recorder;
        
        console.log('Unified recorder initialized as fallback');
        return this.recorder;
      } catch (error) {
        console.error('Failed to initialize unified recorder:', error);
        return null;
      }
    }
    
    /**
     * Set up recording event handlers
     */
    setupRecordingEvents() {
      if (!this.recorder) return;
      
      // Add recording events based on recorder type
      if (typeof this.recorder.onRecordingStart === 'function') {
        // Already has event handlers - just hook into them
        const originalStart = this.recorder.onRecordingStart;
        this.recorder.onRecordingStart = () => {
          originalStart.call(this.recorder);
          this.handleRecordingStart();
        };
        
        const originalStop = this.recorder.onRecordingStop;
        this.recorder.onRecordingStop = () => {
          originalStop.call(this.recorder);
          this.handleRecordingStop();
        };
      } else {
        // Need to add handlers based on recorder type
        if (typeof this.recorder.startRecording === 'function') {
          // For UnityVideoRecorder
          const originalStartMethod = this.recorder.startRecording;
          this.recorder.startRecording = () => {
            const result = originalStartMethod.call(this.recorder);
            this.handleRecordingStart();
            return result;
          };
          
          const originalStopMethod = this.recorder.stopRecording;
          this.recorder.stopRecording = () => {
            const result = originalStopMethod.call(this.recorder);
            this.handleRecordingStop();
            return result;
          };
        }
      }
      
      // Handle stop button click
      const stopButton = document.getElementById('stop-button');
      if (stopButton) {
        // Store the original click handler if it exists
        const originalClickHandler = stopButton.onclick;
        
        // Add our handler
        stopButton.onclick = (e) => {
          // First stop any active recording
          if (this.isRecording) {
            console.log("Stopping recording from stop button");
            this.stopRecording();
          }
          
          // Then call the original handler if it exists
          if (typeof originalClickHandler === 'function') {
            originalClickHandler.call(stopButton, e);
          }
        };
      }
      
      // Handle status updates for recording
      if (typeof window.updateStatus === 'function') {
        const originalUpdateStatus = window.updateStatus;
        window.updateStatus = (status) => {
          // Call original function
          originalUpdateStatus(status);
          
          // Handle recording based on simulation status
          if (status === "Running" && !this.isRecording) {
            // Give Unity a moment to start properly
            setTimeout(() => {
              this.startRecording();
            }, 500);
          } else if (status === "Stopped" && this.isRecording) {
            this.stopRecording();
          }
        };
      }
    }
    
    /**
     * Handle recording start event
     */
    handleRecordingStart() {
      this.isRecording = true;
      
      // Update UI
      if (this.statusElement) {
        this.statusElement.style.display = "flex";
      }
      
      // Reset and start timer
      this.recordingSeconds = 0;
      if (this.timeDisplay) {
        this.timeDisplay.textContent = "00:00";
      }
      
      // Clear any existing timer
      if (this.recordingTimer) {
        clearInterval(this.recordingTimer);
      }
      
      // Start new timer
      this.recordingTimer = setInterval(() => {
        this.recordingSeconds++;
        if (this.timeDisplay) {
          const minutes = Math.floor(this.recordingSeconds / 60).toString().padStart(2, '0');
          const seconds = (this.recordingSeconds % 60).toString().padStart(2, '0');
          this.timeDisplay.textContent = `${minutes}:${seconds}`;
        }
      }, 1000);
      
      console.log("Recording started");
    }
    
    /**
     * Handle recording stop event
     */
    handleRecordingStop() {
      this.isRecording = false;
      
      // Update UI
      if (this.statusElement) {
        this.statusElement.style.display = "none";
      }
      
      // Stop timer
      if (this.recordingTimer) {
        clearInterval(this.recordingTimer);
        this.recordingTimer = null;
      }
      
      console.log("Recording stopped");
    }
    
    /**
     * Start recording
     */
    startRecording() {
      if (this.isRecording) {
        console.log("Already recording");
        return true;
      }
      
      if (!this.recorder) {
        console.error("No recorder available");
        return false;
      }
      
      try {
        console.log("Starting recording");
        
        // Call the appropriate method based on recorder type
        if (typeof this.recorder.startRecording === 'function') {
          this.recorder.startRecording();
        }
        
        return true;
      } catch (error) {
        console.error("Error starting recording:", error);
        return false;
      }
    }
    
    /**
     * Stop recording
     */
    stopRecording() {
      if (!this.isRecording) {
        console.log("No active recording to stop");
        return false;
      }
      
      if (!this.recorder) {
        console.error("No recorder available");
        return false;
      }
      
      try {
        console.log("Stopping recording");
        
        // Call the appropriate method based on recorder type
        if (typeof this.recorder.stopRecording === 'function') {
          this.recorder.stopRecording();
        }
        
        return true;
      } catch (error) {
        console.error("Error stopping recording:", error);
        
        // Force cleanup in case of error
        this.handleRecordingStop();
        
        return false;
      }
    }
    
    /**
     * Handle custom iOS recording workflow
     */
    handleIOSRecording() {
      // On iOS, we need special handling due to browser limitations
      if (this.platform.isIOS) {
        // Implement iOS-specific UI
        this.showIOSRecordingInstructions();
        return true;
      }
      return false;
    }
    
    /**
     * Show iOS recording instructions
     */
    showIOSRecordingInstructions() {
      // Create or show instructions modal
      console.log("Showing iOS recording instructions");
      
      // This would be implemented to show a native iOS recording instructions modal
      // Code omitted for brevity, but would involve creating a modal explaining
      // how to use iOS screen recording from Control Center
    }
  }
  
  // Create a global initialization function
  function initializeRecorder(options = {}) {
    // Check if already initialized
    if (window.recorderLoader) {
      return window.recorderLoader;
    }
    
    // Create new loader
    window.recorderLoader = new UnifiedRecorderLoader(options);
    
    // Return the loader instance
    return window.recorderLoader;
  }
  
  // Initialize when the page loads
  document.addEventListener('DOMContentLoaded', () => {
    // Check if auto-initialization is disabled
    if (window.DISABLE_AUTO_RECORDER_INIT === true && !window.MANUAL_INIT) {
      console.log("Auto initialization disabled, waiting for manual init");
      return;
    }
    
    // Wait for Unity to initialize (if needed)
    setTimeout(() => {
      // Create recorder loader if not already created
      if (!window.recorderLoader && !window.RECORDER_INITIALIZED) {
        console.log("Initializing recorder");
        initializeRecorder();
      }
    }, 2000);
  });
  
  // Expose globally
  window.UnifiedRecorderLoader = UnifiedRecorderLoader;
  window.initializeRecorder = initializeRecorder;