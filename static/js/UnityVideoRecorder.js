// UnityVideoRecorder.js - iOS-Optimized Version
// Streamlined for all platforms with improved iOS handling

window.UnityVideoRecorder = {
    recorder: null,
    frameBuffer: [],
    recordingInfo: null,
    isRecording: false,
    recordingStartTime: 0,
    frameSkip: 1,
    frameCounter: 0,
    recordingCanvas: null,
    recordingCtx: null,
    chunks: [],
    processingQueue: [],
    isProcessing: false,
    lastFrameTimes: {},
    frameImages: {},
    lastVideoUrl: null, // Store URL for access after navigation
    
    // Get the best supported MIME type for the current browser
    getSupportedMimeType: function() {
        const mimeTypes = [
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
            'video/mp4',
            'video/mp4;codecs=h264',
            'video/mp4;codecs=avc1',
            'video/quicktime'
        ];
        
        for (let type of mimeTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                console.log(`Browser supports MIME type: ${type}`);
                return type;
            }
        }
        
        console.warn("No preferred MIME types supported by this browser");
        return null;
    },
    
    // Check if the browser is Safari or iOS
    isIOSorSafari: function() {
        const userAgent = navigator.userAgent.toLowerCase();
        const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
        const isIOS = /iphone|ipad|ipod/.test(userAgent);
        return isSafari || isIOS;
    },
    
    // Check if it's specifically iOS (not macOS Safari)
    isIOS: function() {
        const userAgent = navigator.userAgent.toLowerCase();
        return /iphone|ipad|ipod/.test(userAgent);
    },
    
    // Get the top window (in case we're in an iframe)
    getTopWindow: function() {
        try {
            if (window.parent && window.parent !== window && window.parent.document) {
                console.log("Using parent window for downloads");
                return window.parent;
            }
        } catch (e) {
            console.log("Cannot access parent window, using current window", e);
        }
        return window;
    },
    
    // Show a simple notification
    showNotification: function(message, duration = 3000) {
        const topWindow = this.getTopWindow();
        
        // Remove any existing notification
        const existingNotification = topWindow.document.getElementById('video-recorder-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // Create notification element
        const notification = document.createElement('div');
        notification.id = 'video-recorder-notification';
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        notification.style.color = 'white';
        notification.style.padding = '12px 20px';
        notification.style.borderRadius = '5px';
        notification.style.fontFamily = 'Arial, sans-serif, -apple-system, BlinkMacSystemFont';
        notification.style.fontSize = '14px';
        notification.style.zIndex = '2147483646';
        notification.style.textAlign = 'center';
        notification.style.maxWidth = '90%';
        notification.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
        notification.innerHTML = message;
        
        topWindow.document.body.appendChild(notification);
        
        // Auto-hide after duration
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, duration);
        }
        
        return notification;
    },
    
    // Called by Unity to start recording
    startRecording: function(jsonData) {
        try {
            console.log("UnityVideoRecorder: Starting recording...");
            
            // Parse recording info from Unity
            const info = JSON.parse(jsonData);
            this.recordingInfo = info;
            
            if (!info.viewCount || info.viewCount < 1) {
                console.error("Invalid view count", info);
                this.showNotification("Recording failed: Invalid camera configuration");
                return;
            }
            
            console.log(`Found ${info.viewCount} camera views to record`);
            
            // Balanced quality settings
            const viewWidth = Math.min(info.width, 720); 
            const viewHeight = Math.min(info.height, 480);
            
            // Layout configuration
            this.combinedWidth = viewWidth * 2;
            this.combinedHeight = viewHeight * 2;
            
            // Create canvas for the combined view
            this.recordingCanvas = document.createElement('canvas');
            this.recordingCanvas.width = this.combinedWidth;
            this.recordingCanvas.height = this.combinedHeight;
            this.recordingCtx = this.recordingCanvas.getContext('2d');
            
            // Fill with black background
            this.recordingCtx.fillStyle = 'black';
            this.recordingCtx.fillRect(0, 0, this.combinedWidth, this.combinedHeight);
            
            // Draw placeholders for each view
            this.drawViewPlaceholders(viewWidth, viewHeight);
            
            // Create a stream from the canvas
            const stream = this.recordingCanvas.captureStream(20); // 20fps
            
            // Get supported MIME type
            const mimeType = this.getSupportedMimeType();
            
            // Set recorder options
            const recorderOptions = {};
            if (mimeType) {
                recorderOptions.mimeType = mimeType;
                recorderOptions.videoBitsPerSecond = 3000000; // 3Mbps
            }
            
            try {
                // Create media recorder
                this.recorder = new MediaRecorder(stream, recorderOptions);
            } catch (e) {
                console.error("Failed to create MediaRecorder with options. Using defaults:", e);
                this.recorder = new MediaRecorder(stream);
            }
            
            // Store recorded chunks
            this.chunks = [];
            this.recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this.chunks.push(e.data);
                }
            };
            
            // Start recording
            this.recorder.start(1000); // Collect data every second
            
            // Reset state
            this.frameBuffer = [];
            this.processingQueue = [];
            this.isProcessing = false;
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            this.frameCounter = 0;
            this.lastFrameTimes = {};
            this.frameImages = {};
            
            // Show recording indicator
            this.showRecordingIndicator(true);
            
            // Remember canvas info
            this.viewCount = info.viewCount;
            this.viewWidth = viewWidth;
            this.viewHeight = viewHeight;
            
            console.log("Recording started with cross-platform settings");
            
            // Setup redraw interval
            this.redrawInterval = setInterval(() => this.redrawAllViews(), 100);
        } catch (error) {
            console.error('Error starting recording:', error);
            this.showNotification("Failed to start recording: " + error.message);
        }
    },
    
    // Show/hide recording indicator
    showRecordingIndicator: function(isVisible) {
        try {
            // Try to find indicator in current window
            let recordingIndicator = document.getElementById('recording-indicator');
            
            // If not found in current window, check parent window
            if (!recordingIndicator && window.parent && window.parent !== window) {
                try {
                    recordingIndicator = window.parent.document.getElementById('recording-indicator');
                } catch (e) {
                    console.log("Cannot access parent window recording indicator");
                }
            }
            
            if (recordingIndicator) {
                recordingIndicator.style.display = isVisible ? "flex" : "none";
            }
            
            // Also call global handler if it exists
            if (typeof window.setRecordingActive === 'function') {
                window.setRecordingActive(isVisible);
            }
        } catch (e) {
            console.error("Error updating recording indicator:", e);
        }
    },
    
    // Draw view placeholders
    drawViewPlaceholders: function(viewWidth, viewHeight) {
        const ctx = this.recordingCtx;
        
        // Top-left view (0)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, viewWidth, viewHeight);
        ctx.fillStyle = 'white';
        ctx.font = '24px Arial';
        ctx.fillText('View 0', viewWidth/2 - 40, viewHeight/2);
        
        // Bottom-left view (1)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, viewHeight, viewWidth, viewHeight);
        ctx.fillStyle = 'white';
        ctx.fillText('View 1', viewWidth/2 - 40, viewHeight + viewHeight/2);
        
        // Right view (2) - full height
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(viewWidth, 0, viewWidth, viewHeight*2);
        ctx.fillStyle = 'white';
        ctx.fillText('View 2', viewWidth + viewWidth/2 - 40, viewHeight);
    },
    
    // Called by Unity to add a frame to the buffer
    addFrame: function(jsonData) {
        if (!this.isRecording) return;
        
        // Throttle frame processing
        this.frameCounter++;
        if (this.frameCounter % (this.frameSkip + 1) !== 0) {
            return; // Skip this frame
        }
        
        try {
            const frameInfo = JSON.parse(jsonData);
            const viewIndex = frameInfo.viewIndex;
            
            // Update last frame time for this view
            this.lastFrameTimes[viewIndex] = Date.now();
            
            // Limit queue size
            if (this.processingQueue.length < 30) {
                this.processingQueue.push(frameInfo);
            }
            
            // Start processing if not already
            if (!this.isProcessing) {
                this.processNextFrameInQueue();
            }
        } catch (error) {
            console.error('Error adding frame:', error);
        }
    },
    
    // Process frames one at a time
    processNextFrameInQueue: function() {
        if (this.processingQueue.length === 0) {
            this.isProcessing = false;
            return;
        }
        
        this.isProcessing = true;
        
        // Get next frame
        const frameInfo = this.processingQueue.shift();
        
        // Process the frame
        this.processFrame(frameInfo).then(() => {
            // Process next frame after a small delay
            setTimeout(() => this.processNextFrameInQueue(), 10);
        }).catch(err => {
            console.error("Error processing frame:", err);
            // Continue with next frame despite error
            setTimeout(() => this.processNextFrameInQueue(), 10);
        });
    },
    
    // Redraw all views with their latest frames
    redrawAllViews: function() {
        if (!this.isRecording || !this.recordingCtx) return;
        
        // Clear everything
        this.recordingCtx.fillStyle = 'black';
        this.recordingCtx.fillRect(0, 0, this.combinedWidth, this.combinedHeight);
        
        // Draw each view
        for (let viewIndex = 0; viewIndex < 3; viewIndex++) {
            let x, y, width, height;
            
            if (viewIndex === 0) {
                // Top left view
                x = 0;
                y = 0;
                width = this.viewWidth;
                height = this.viewHeight;
            } else if (viewIndex === 1) {
                // Bottom left view
                x = 0;
                y = this.viewHeight;
                width = this.viewWidth;
                height = this.viewHeight;
            } else if (viewIndex === 2) {
                // Right side view (full height)
                x = this.viewWidth;
                y = 0;
                width = this.viewWidth;
                height = this.combinedHeight;
            }
            
            // If we have a saved frame for this view, draw it
            if (this.frameImages[viewIndex]) {
                this.recordingCtx.drawImage(this.frameImages[viewIndex], x, y, width, height);
            } else {
                // Draw placeholder
                this.recordingCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                this.recordingCtx.fillRect(x, y, width, height);
                this.recordingCtx.fillStyle = 'white';
                this.recordingCtx.font = '20px Arial';
                this.recordingCtx.fillText(`View ${viewIndex}`, x + width/2 - 40, y + height/2);
            }
            
            // Add debugging view labels
            this.recordingCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            this.recordingCtx.font = '12px Arial';
            this.recordingCtx.fillText(`V${viewIndex}`, x + 5, y + 12);
        }
    },
    
    // Process a single frame
    processFrame: function(frameInfo) {
        return new Promise((resolve, reject) => {
            try {
                let viewIndex = frameInfo.viewIndex;
                
                if (viewIndex < 0 || viewIndex >= 3) {
                    viewIndex = Math.min(2, Math.max(0, viewIndex));
                }
                
                // Calculate position
                let x, y, width, height;
                
                if (viewIndex === 0) {
                    // Top left view
                    x = 0;
                    y = 0;
                    width = this.viewWidth;
                    height = this.viewHeight;
                } else if (viewIndex === 1) {
                    // Bottom left view
                    x = 0;
                    y = this.viewHeight;
                    width = this.viewWidth;
                    height = this.viewHeight;
                } else if (viewIndex === 2) {
                    // Right side view (full height)
                    x = this.viewWidth;
                    y = 0;
                    width = this.viewWidth;
                    height = this.combinedHeight;
                }
                
                // Create and load image
                const img = new Image();
                
                img.onload = () => {
                    // Store this frame
                    this.frameImages[viewIndex] = img;
                    
                    // Draw the image
                    this.recordingCtx.drawImage(img, x, y, width, height);
                    
                    // Add label
                    this.recordingCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                    this.recordingCtx.font = '12px Arial';
                    this.recordingCtx.fillText(`V${viewIndex}`, x + 5, y + 12);
                    
                    resolve();
                };
                
                img.onerror = (e) => {
                    console.error("Error loading frame image:", e);
                    reject(e);
                };
                
                img.src = 'data:image/png;base64,' + frameInfo.data;
            } catch (error) {
                reject(error);
            }
        });
    },
    
    // Called by Unity to stop recording
    stopRecording: function() {
        if (!this.isRecording) {
            console.warn("Not recording, nothing to stop");
            return;
        }
        
        console.log("Stopping recording...");
        this.isRecording = false;
        
        // Log frame reception summary
        for (let viewIndex in this.lastFrameTimes) {
            console.log(`View ${viewIndex}: Last frame received ${Date.now() - this.lastFrameTimes[viewIndex]}ms ago`);
        }
        
        // Stop the redraw interval
        if (this.redrawInterval) {
            clearInterval(this.redrawInterval);
            this.redrawInterval = null;
        }
        
        // Stop accepting new frames
        this.processingQueue = [];
        
        const recordingDuration = (Date.now() - this.recordingStartTime) / 1000;
        console.log(`Recording duration: ${recordingDuration.toFixed(2)} seconds`);
        
        // Hide recording indicator
        this.showRecordingIndicator(false);
        
        // Show processing notification
        const notification = this.showNotification("Processing video. Please wait...", 0);
        
        // Stop the recorder
        if (this.recorder && this.recorder.state !== 'inactive') {
            this.recorder.onstop = () => {
                try {
                    // Create blob from chunks
                    let mimeType = 'video/webm';
                    
                    // Try to determine MIME type from recorder
                    if (this.recorder.mimeType) {
                        mimeType = this.recorder.mimeType.split(';')[0];
                    }
                    
                    console.log(`Creating blob with MIME type: ${mimeType}`);
                    const blob = new Blob(this.chunks, { type: mimeType });
                    
                    // Determine file extension
                    let fileExtension = 'webm';
                    if (mimeType.includes('mp4')) {
                        fileExtension = 'mp4';
                    } else if (mimeType.includes('quicktime')) {
                        fileExtension = 'mov';
                    }
                    
                    // Remove processing notification
                    if (notification && notification.parentNode) {
                        notification.remove();
                    }
                    
                    // iOS/Safari handling
                    if (this.isIOSorSafari()) {
                        // iOS-specific download method
                        this.iOSDownload(blob, fileExtension);
                    } else {
                        // Standard download for other browsers
                        this.standardDownload(blob, fileExtension);
                    }
                    
                    // Cleanup
                    this.chunks = [];
                    this.recordingCanvas = null;
                    this.recordingCtx = null;
                    this.recorder = null;
                    this.frameImages = {};
                    
                    console.log('Recording resources cleaned up');
                } catch (err) {
                    console.error("Error finalizing recording:", err);
                    
                    // Remove processing notification
                    if (notification && notification.parentNode) {
                        notification.remove();
                    }
                    
                    this.showNotification("Error processing video: " + err.message, 3000);
                }
            };
            
            // Wait a moment for any pending frames
            setTimeout(() => {
                this.recorder.stop();
            }, 500);
        } else {
            console.warn("Recorder not available or already inactive");
            
            // Remove processing notification
            if (notification && notification.parentNode) {
                notification.remove();
            }
            
            this.showNotification("No video recorded", 3000);
        }
    },
    
    // Create a minimal pop-up for iOS users with save instructions
    createIOSSaveModal: function(videoUrl, filename) {
        const topWindow = this.getTopWindow();
        
        // Create container
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0,0,0,0.9)';
        modal.style.zIndex = '2147483647';
        modal.style.display = 'flex';
        modal.style.flexDirection = 'column';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.padding = '20px';
        modal.style.boxSizing = 'border-box';
        
        // Build modal content
        modal.innerHTML = `
            <div style="background-color: white; max-width: 500px; width: 90%; border-radius: 12px; overflow: hidden; box-shadow: 0 5px 15px rgba(0,0,0,0.5);">
                <div style="background-color: #BA0C2F; color: white; padding: 15px; text-align: center; font-weight: bold; font-family: Arial, -apple-system;">
                    Save Your Video
                    <button id="close-modal-btn" style="position: absolute; right: 15px; top: 10px; background: transparent; border: none; color: white; font-size: 24px; cursor: pointer;">×</button>
                </div>
                
                <div style="padding: 20px; text-align: center;">
                    <p style="margin-bottom: 15px; font-family: Arial, -apple-system; line-height: 1.4;">
                        Your video is ready. When the video opens, tap the <strong>Share icon</strong> and select <strong>"Save to Files"</strong> to keep it.
                    </p>
                    
                    <div style="margin: 15px auto; width: 80px; height: 80px;">
                        <svg viewBox="0 0 24 24" width="80" height="80" stroke="#000" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"></path>
                        </svg>
                        <div style="text-align: center; font-size: 12px; margin-top: 5px; font-weight: bold;">Share Icon</div>
                    </div>
                    
                    <button id="open-video-btn" style="background-color: #BA0C2F; color: white; border: none; padding: 12px 30px; border-radius: 8px; font-size: 16px; font-weight: bold; margin-top: 15px; cursor: pointer; font-family: Arial, -apple-system;">
                        Open Video Now
                    </button>
                    
                    <p style="margin-top: 20px; margin-bottom: 0; font-size: 14px; color: #777; font-family: Arial, -apple-system;">
                        The video will also be available for download again if needed
                    </p>
                </div>
            </div>
        `;
        
        topWindow.document.body.appendChild(modal);
        
        // Set up button handlers
        topWindow.document.getElementById('close-modal-btn').addEventListener('click', function() {
            modal.remove();
        });
        
        topWindow.document.getElementById('open-video-btn').addEventListener('click', function() {
            // Open the video in a new tab
            window.open(videoUrl, '_blank');
            modal.remove();
            
            // Create download button that persists on the page
            this.createPersistentDownloadButton(videoUrl, filename);
        }.bind(this));
        
        return modal;
    },
    
    // Create a persistent download button that stays on the page
    createPersistentDownloadButton: function(videoUrl, filename) {
        const topWindow = this.getTopWindow();
        
        // Check if a button already exists
        let existingButton = topWindow.document.getElementById('persistent-video-download');
        if (existingButton) {
            existingButton.remove();
        }
        
        // Create the button
        const button = document.createElement('div');
        button.id = 'persistent-video-download';
        button.style.position = 'fixed';
        button.style.bottom = '20px';
        button.style.right = '20px';
        button.style.backgroundColor = '#BA0C2F';
        button.style.color = 'white';
        button.style.padding = '12px 15px';
        button.style.borderRadius = '10px';
        button.style.fontFamily = 'Arial, -apple-system';
        button.style.fontSize = '14px';
        button.style.fontWeight = 'bold';
        button.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
        button.style.cursor = 'pointer';
        button.style.zIndex = '999999';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download Video
        `;
        
        // Add to document
        topWindow.document.body.appendChild(button);
        
        // Store the URL for later use
        this.lastVideoUrl = videoUrl;
        
        // Add click event
        button.addEventListener('click', function() {
            // Try to open the video in a new tab
            window.open(videoUrl, '_blank');
        });
    },
    
    // iOS-optimized download method
    iOSDownload: function(blob, fileExtension) {
        try {
            const filename = `simulation-video-${new Date().toISOString().replace(/[:.]/g, '-')}.${fileExtension}`;
            const url = URL.createObjectURL(blob);
            
            console.log("Using iOS-optimized download method");
            
            // Store the URL for later use
            this.lastVideoUrl = url;
            
            // Show a notification first
            this.showNotification("Video ready! Opening save instructions...", 2000);
            
            // Create the iOS-specific save modal with instructions
            this.createIOSSaveModal(url, filename);
            
            // Create a hidden backup download link
            const downloadLink = document.createElement('a');
            downloadLink.style.display = 'none';
            downloadLink.href = url;
            downloadLink.download = filename;
            
            // Add to document
            document.body.appendChild(downloadLink);
            
            // Do not auto-click for iOS as it causes issues, let user click from the modal
            
        } catch (err) {
            console.error("iOS download error:", err);
            this.showNotification("Download error: " + err.message, 3000);
        }
    },
    
    // Standard download for Chrome/Firefox/etc
    standardDownload: function(blob, fileExtension) {
        const url = URL.createObjectURL(blob);
        const filename = `simulation-video-${new Date().toISOString().replace(/[:.]/g, '-')}.${fileExtension}`;
        
        // Store the URL for later recovery if needed
        this.lastVideoUrl = url;
        
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            // Don't revoke URL in case user needs it again
        }, 100);
    },
    
    // Method to download recordings (can be called from outside)
    downloadAllRecordings: function() {
        if (this.isRecording) {
            this.stopRecording();
        } else if (this.chunks && this.chunks.length > 0) {
            // If we have chunks but we're not recording, create a download
            let mimeType = 'video/webm';
            let fileExtension = 'webm';
            
            // Check for Safari/iOS
            if (this.isIOSorSafari()) {
                mimeType = 'video/mp4';
                fileExtension = 'mp4';
            }
            
            const blob = new Blob(this.chunks, { type: mimeType });
            
            // Use appropriate download method
            if (this.isIOS()) {
                this.iOSDownload(blob, fileExtension);
            } else {
                this.standardDownload(blob, fileExtension);
            }
        } else if (this.lastVideoUrl) {
            // If we have a previous video URL but no chunks, use that
            if (this.isIOS()) {
                window.open(this.lastVideoUrl, '_blank');
            } else {
                window.location.href = this.lastVideoUrl;
            }
        } else {
            this.showNotification('No video recordings available', 3000);
        }
    }
};