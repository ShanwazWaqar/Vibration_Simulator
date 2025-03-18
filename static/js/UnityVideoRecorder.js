// UnityVideoRecorder.js - Fixed Layout for All Views
// This version guarantees all three views are displayed properly regardless of received frames

window.UnityVideoRecorder = {
    recorder: null,
    frameBuffer: [],
    recordingInfo: null,
    isRecording: false,
    recordingStartTime: 0,
    frameSkip: 1, // Reduced frame skipping for more reliable capture
    frameCounter: 0,
    recordingCanvas: null,
    recordingCtx: null,
    chunks: [],
    processingQueue: [],
    isProcessing: false,
    lastFrameTimes: {}, // Track when we last received frames for each view
    frameImages: {}, // Store the latest frame for each view
    
    // Called by Unity to start recording
    startRecording: function(jsonData) {
        try {
            console.log("UnityVideoRecorder: Starting recording...");
            
            // Parse recording info from Unity
            const info = JSON.parse(jsonData);
            this.recordingInfo = info;
            
            if (!info.viewCount || info.viewCount < 1) {
                console.error("Invalid view count", info);
                alert("Recording failed: Invalid camera configuration");
                return;
            }
            
            console.log(`Found ${info.viewCount} camera views to record`);
            
            // Balanced quality settings
            const viewWidth = Math.min(info.width, 720); 
            const viewHeight = Math.min(info.height, 480);
            
            // 2+1 layout (2 views on left stacked vertically, 1 view on right taking full height)
            this.combinedWidth = viewWidth * 2;
            this.combinedHeight = viewHeight * 2;
            
            console.log(`Creating recording canvas: ${this.combinedWidth}x${this.combinedHeight}`);
            
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
            const stream = this.recordingCanvas.captureStream(20); // Balanced 20fps
            
            // Create a media recorder with moderate quality
            this.recorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9',
                videoBitsPerSecond: 3000000 // 3Mbps for balanced quality/performance
            });
            
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
            this.lastFrameTimes = {}; // Reset frame times
            this.frameImages = {}; // Reset stored frames
            
            // Show recording indicator
            const recordingIndicator = document.getElementById('recording-indicator');
            if (recordingIndicator) {
                recordingIndicator.classList.add('active');
            }
            
            // Remember canvas info for later use
            this.viewCount = info.viewCount;
            this.viewWidth = viewWidth;
            this.viewHeight = viewHeight;
            
            console.log("Recording started with balanced quality/performance settings");
            
            // Setup a regular redraw interval to ensure all views stay visible
            this.redrawInterval = setInterval(() => this.redrawAllViews(), 100);
        } catch (error) {
            console.error('Error starting recording:', error);
            alert("Failed to start recording: " + error.message);
        }
    },
    
    // Draw view placeholders so we know where each view should be
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
        
        // Throttle frame processing to reduce CPU load
        this.frameCounter++;
        if (this.frameCounter % (this.frameSkip + 1) !== 0) {
            return; // Skip this frame
        }
        
        try {
            const frameInfo = JSON.parse(jsonData);
            const viewIndex = frameInfo.viewIndex;
            
            // Update last frame time for this view
            this.lastFrameTimes[viewIndex] = Date.now();
            
            // Limit queue size to prevent memory issues
            if (this.processingQueue.length < 30) {
                this.processingQueue.push(frameInfo);
                
                // Log frame reception for debugging
                if (this.frameCounter % 100 === 0) {
                    console.log(`Queued frame for view ${viewIndex}, queue size: ${this.processingQueue.length}`);
                }
            }
            
            // Start processing if not already doing so
            if (!this.isProcessing) {
                this.processNextFrameInQueue();
            }
        } catch (error) {
            console.error('Error adding frame:', error);
        }
    },
    
    // Process frames one at a time from the queue
    processNextFrameInQueue: function() {
        if (this.processingQueue.length === 0) {
            this.isProcessing = false;
            return;
        }
        
        this.isProcessing = true;
        
        // Get next frame to process
        const frameInfo = this.processingQueue.shift();
        
        // Process the frame
        this.processFrame(frameInfo).then(() => {
            // Process next frame after a delay to maintain browser responsiveness
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
        
        // First, clear everything
        this.recordingCtx.fillStyle = 'black';
        this.recordingCtx.fillRect(0, 0, this.combinedWidth, this.combinedHeight);
        
        // Draw each view with its most recent frame
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
                height = this.combinedHeight; // Full height
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
                    console.warn(`Invalid view index: ${viewIndex}, forcing to range 0-2`);
                    viewIndex = Math.min(2, Math.max(0, viewIndex));
                }
                
                // Calculate position based on custom layout
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
                    height = this.combinedHeight; // Full height
                }
                
                // Create and load image
                const img = new Image();
                
                img.onload = () => {
                    // Store this frame for the view
                    this.frameImages[viewIndex] = img;
                    
                    // Draw the image at the calculated position
                    this.recordingCtx.drawImage(img, x, y, width, height);
                    
                    // Add debugging view labels
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
        console.log("Frame reception summary:");
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
        const recordingIndicator = document.getElementById('recording-indicator');
        if (recordingIndicator) {
            recordingIndicator.classList.remove('active');
        }
        
        // Stop the recorder after processing remaining frames
        if (this.recorder && this.recorder.state !== 'inactive') {
            // Show processing message
            // alert("Processing video. Please wait...");
            
            this.recorder.onstop = () => {
                try {
                    // Create blob from chunks
                    const blob = new Blob(this.chunks, { type: 'video/webm; codecs=vp9' });
                    
                    // Download the file
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = `simulation-views-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
                    document.body.appendChild(a);
                    a.click();
                    
                    // Cleanup
                    setTimeout(() => {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        
                        // Clean up resources
                        this.chunks = [];
                        this.recordingCanvas = null;
                        this.recordingCtx = null;
                        this.recorder = null;
                        this.frameImages = {};
                        
                        console.log('Recording downloaded and resources cleaned up');
                    }, 100);
                } catch (err) {
                    console.error("Error finishing recording:", err);
                    alert("Error finishing recording: " + err.message);
                }
            };
            
            // Give a moment for any pending frames to be processed
            setTimeout(() => {
                this.recorder.stop();
            }, 500);
        } else {
            console.warn("Recorder not available or already inactive");
            // alert("No video recorded or recorder already stopped.");
        }
    },
    
    // Method to download recordings
    downloadAllRecordings: function() {
        if (this.isRecording) {
            this.stopRecording();
        } else if (this.chunks && this.chunks.length > 0) {
            // If we have chunks but we're not recording, create a download
            const blob = new Blob(this.chunks, { type: 'video/webm; codecs=vp9' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `simulation-views-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        } else {
            alert('No video recordings available to download');
        }
    }
};