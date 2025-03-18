// UnityVideoRecorder.js - Cross-Browser Compatible Version
// This version works on Chrome, Firefox, Safari (macOS and iOS)

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
    
    // Get the best supported MIME type for the current browser
    getSupportedMimeType: function() {
        // Try different MIME types in order of preference
        const mimeTypes = [
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
            'video/mp4',
            'video/mp4;codecs=h264',
            'video/mp4;codecs=avc1',
            'video/quicktime' // For Safari
        ];
        
        for (let type of mimeTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                console.log(`Browser supports MIME type: ${type}`);
                return type;
            }
        }
        
        // If none are supported, return null and we'll handle the fallback
        console.warn("No preferred MIME types supported by this browser");
        return null;
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
            
            // Get supported MIME type
            const mimeType = this.getSupportedMimeType();
            
            // Set recorder options based on browser support
            const recorderOptions = {};
            
            if (mimeType) {
                recorderOptions.mimeType = mimeType;
                recorderOptions.videoBitsPerSecond = 3000000; // 3Mbps
            } else {
                // If no specified mime type is supported, use browser defaults
                console.log("Using browser default encoding settings");
            }
            
            try {
                // Create a media recorder with appropriate settings
                this.recorder = new MediaRecorder(stream, recorderOptions);
            } catch (e) {
                console.error("Failed to create MediaRecorder with options. Trying with defaults:", e);
                // Fallback to default options
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
            
            console.log("Recording started with cross-platform settings");
            
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
                    // The type must match what we're recording with, or use a compatible format
                    let mimeType = 'video/webm';
                    
                    // Try to determine the MIME type from the recorder
                    if (this.recorder.mimeType) {
                        // Extract base MIME type without codecs
                        mimeType = this.recorder.mimeType.split(';')[0];
                    }
                    
                    console.log(`Creating blob with MIME type: ${mimeType}`);
                    const blob = new Blob(this.chunks, { type: mimeType });
                    
                    // Determine file extension based on MIME type
                    let fileExtension = 'webm';
                    if (mimeType.includes('mp4')) {
                        fileExtension = 'mp4';
                    } else if (mimeType.includes('quicktime')) {
                        fileExtension = 'mov';
                    }
                    
                    // For Safari/iOS special handling
                    if (this.isIOSorSafari()) {
                        console.log("iOS/Safari detected, using special download method");
                        this.handleSafariDownload(blob, fileExtension);
                    } else {
                        // Standard download method for other browsers
                        this.standardDownload(blob, fileExtension);
                    }
                    
                    // Cleanup
                    this.chunks = [];
                    this.recordingCanvas = null;
                    this.recordingCtx = null;
                    this.recorder = null;
                    this.frameImages = {};
                    
                    console.log('Recording downloaded and resources cleaned up');
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
    
    // Check if the browser is Safari or iOS
    isIOSorSafari: function() {
        const userAgent = navigator.userAgent.toLowerCase();
        const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
        const isIOS = /iphone|ipad|ipod/.test(userAgent);
        return isSafari || isIOS;
    },
    
    // Standard download for Chrome/Firefox/etc
    standardDownload: function(blob, fileExtension) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `simulation-views-${new Date().toISOString().replace(/[:.]/g, '-')}.${fileExtension}`;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    },
    
    // Special handling for Safari/iOS
    handleSafariDownload: function(blob, fileExtension) {
        const url = URL.createObjectURL(blob);
        
        // For iOS Safari, we open the video in a new window
        // The user can then save it manually
        const newWindow = window.open();
        if (newWindow) {
            newWindow.document.write(`
                <html>
                <head>
                    <title>Download Recorded Video</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { 
                            font-family: Arial, sans-serif;
                            text-align: center;
                            padding: 20px;
                            background-color: #f5f5f5;
                        }
                        h1 { color: #333; }
                        .container {
                            max-width: 800px;
                            margin: 0 auto;
                            background-color: white;
                            padding: 20px;
                            border-radius: 10px;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        }
                        video {
                            max-width: 100%;
                            margin: 20px 0;
                            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                        }
                        .instructions {
                            background-color: #f8f9fa;
                            padding: 15px;
                            border-radius: 5px;
                            margin: 20px 0;
                            text-align: left;
                        }
                        .instructions li {
                            margin-bottom: 10px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Your Video is Ready</h1>
                        <p>Since you're using Safari/iOS, please follow these steps to save the video:</p>
                        
                        <video controls autoplay>
                            <source src="${url}" type="video/${fileExtension}">
                            Your browser does not support the video tag.
                        </video>
                        
                        <div class="instructions">
                            <strong>To save the video:</strong>
                            <ol>
                                <li>Tap and hold on the video above</li>
                                <li>Select "Download Video" or "Save Video" from the menu</li>
                                <li>The video will be saved to your device</li>
                            </ol>
                        </div>
                        
                        <p>Filename: simulation-views-${new Date().toISOString().replace(/[:.]/g, '-')}.${fileExtension}</p>
                    </div>
                </body>
                </html>
            `);
            newWindow.document.close();
        } else {
            // If popup is blocked, fall back to an alert with instructions
            alert("Please enable popups to download the video, or long-press the video player and select 'Download Video'");
            
            // Create an element in the current page
            const container = document.createElement('div');
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.left = '0';
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.backgroundColor = 'rgba(0,0,0,0.8)';
            container.style.zIndex = '9999';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.alignItems = 'center';
            container.style.justifyContent = 'center';
            container.style.padding = '20px';
            container.style.boxSizing = 'border-box';
            
            container.innerHTML = `
                <div style="background:white; max-width:800px; padding:20px; border-radius:10px; text-align:center;">
                    <h2>Your Video is Ready</h2>
                    <p>Tap and hold the video to save it:</p>
                    <video controls style="max-width:100%; margin:10px 0;" src="${url}"></video>
                    <button style="padding:10px 20px; background:#007bff; color:white; border:none; border-radius:5px; cursor:pointer;" onclick="this.parentNode.parentNode.remove()">Close</button>
                </div>
            `;
            
            document.body.appendChild(container);
        }
        
        // Keep the URL object alive as we're showing it to the user
        // The user needs to manually save it now
    },
    
    // Method to download recordings
    downloadAllRecordings: function() {
        if (this.isRecording) {
            this.stopRecording();
        } else if (this.chunks && this.chunks.length > 0) {
            // If we have chunks but we're not recording, create a download
            // Determine the appropriate MIME type
            let mimeType = 'video/webm';
            let fileExtension = 'webm';
            
            // Check for Safari/iOS
            if (this.isIOSorSafari()) {
                mimeType = 'video/mp4';
                fileExtension = 'mp4';
            }
            
            const blob = new Blob(this.chunks, { type: mimeType });
            
            // Use appropriate download method based on browser
            if (this.isIOSorSafari()) {
                this.handleSafariDownload(blob, fileExtension);
            } else {
                this.standardDownload(blob, fileExtension);
            }
        } else {
            alert('No video recordings available to download');
        }
    }
};