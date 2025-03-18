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
    
    // Check if the browser is Safari or iOS
    isIOSorSafari: function() {
        const userAgent = navigator.userAgent.toLowerCase();
        const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
        const isIOS = /iphone|ipad|ipod/.test(userAgent);
        return isSafari || isIOS;
    },
    
    // Show a pre-recording notice for iOS users
    showIOSPreRecordingNotice: function(callback) {
        if (!this.isIOSorSafari()) {
            // Not iOS or Safari, proceed immediately
            callback();
            return;
        }
        
        // Create a modal dialog
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0,0,0,0.7)';
        modal.style.zIndex = '99999';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        
        modal.innerHTML = `
            <div style="background:white; width:90%; max-width:500px; border-radius:10px; overflow:hidden;">
                <div style="background:#BA0C2F; color:white; padding:15px; text-align:center;">
                    <h2 style="margin:0; font-size:18px;">iOS Recording Notice</h2>
                </div>
                <div style="padding:20px;">
                    <p style="margin-top:0;">Since you're using an iOS device, please note:</p>
                    <ul style="padding-left:20px; margin-bottom:20px;">
                        <li>After recording, you'll need to manually save the video</li>
                        <li>We'll show you clear instructions when the recording is complete</li>
                        <li>You'll need to tap and hold on the video to save it</li>
                    </ul>
                    <div style="text-align:center;">
                        <button id="ios-notice-continue" style="background:#BA0C2F; color:white; border:none; padding:10px 25px; border-radius:5px; font-size:16px; cursor:pointer;">
                            Continue to Recording
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Set up continue button
        document.getElementById('ios-notice-continue').addEventListener('click', function() {
            modal.remove();
            callback();
        });
    },
    
    // Called by Unity to start recording
    startRecording: function(jsonData) {
        const self = this;
        
        try {
            console.log("UnityVideoRecorder: Starting recording...");
            
            // Show iOS notice if needed, then proceed
            this.showIOSPreRecordingNotice(function() {
                try {
                    // Parse recording info from Unity
                    const info = JSON.parse(jsonData);
                    self.recordingInfo = info;
                    
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
                    self.combinedWidth = viewWidth * 2;
                    self.combinedHeight = viewHeight * 2;
                    
                    console.log(`Creating recording canvas: ${self.combinedWidth}x${self.combinedHeight}`);
                    
                    // Create canvas for the combined view
                    self.recordingCanvas = document.createElement('canvas');
                    self.recordingCanvas.width = self.combinedWidth;
                    self.recordingCanvas.height = self.combinedHeight;
                    self.recordingCtx = self.recordingCanvas.getContext('2d');
                    
                    // Fill with black background
                    self.recordingCtx.fillStyle = 'black';
                    self.recordingCtx.fillRect(0, 0, self.combinedWidth, self.combinedHeight);
                    
                    // Draw placeholders for each view
                    self.drawViewPlaceholders(viewWidth, viewHeight);
                    
                    // Create a stream from the canvas
                    const stream = self.recordingCanvas.captureStream(20); // Balanced 20fps
                    
                    // Get supported MIME type
                    const mimeType = self.getSupportedMimeType();
                    
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
                        self.recorder = new MediaRecorder(stream, recorderOptions);
                    } catch (e) {
                        console.error("Failed to create MediaRecorder with options. Trying with defaults:", e);
                        // Fallback to default options
                        self.recorder = new MediaRecorder(stream);
                    }
                    
                    // Store recorded chunks
                    self.chunks = [];
                    self.recorder.ondataavailable = (e) => {
                        if (e.data.size > 0) {
                            self.chunks.push(e.data);
                        }
                    };
                    
                    // Start recording
                    self.recorder.start(1000); // Collect data every second
                    
                    // Reset state
                    self.frameBuffer = [];
                    self.processingQueue = [];
                    self.isProcessing = false;
                    self.isRecording = true;
                    self.recordingStartTime = Date.now();
                    self.frameCounter = 0;
                    self.lastFrameTimes = {}; // Reset frame times
                    self.frameImages = {}; // Reset stored frames
                    
                    // Show recording indicator
                    const recordingIndicator = document.getElementById('recording-indicator');
                    if (recordingIndicator) {
                        recordingIndicator.classList.add('active');
                    }
                    
                    // Remember canvas info for later use
                    self.viewCount = info.viewCount;
                    self.viewWidth = viewWidth;
                    self.viewHeight = viewHeight;
                    
                    console.log("Recording started with cross-platform settings");
                    
                    // Setup a regular redraw interval to ensure all views stay visible
                    self.redrawInterval = setInterval(() => self.redrawAllViews(), 100);
                    
                    // We removed the iOS indicator code here
                } catch (error) {
                    console.error('Error in recording callback:', error);
                    alert("Failed to start recording: " + error.message);
                }
            });
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
        
        // Hide recording indicators
        const recordingIndicator = document.getElementById('recording-indicator');
        if (recordingIndicator) {
            recordingIndicator.classList.remove('active');
        }
        
        // Remove iOS-specific indicator if present
        const iosIndicator = document.getElementById('ios-recording-indicator');
        if (iosIndicator) {
            iosIndicator.remove();
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
    
    // Updated handleSafariDownload function for improved iOS video download

handleSafariDownload: function(blob, fileExtension) {
    const url = URL.createObjectURL(blob);
    const filename = `simulation-views-${new Date().toISOString().replace(/[:.]/g, '-')}.${fileExtension}`;
    
    // Create a full-screen overlay that sits above everything else
    const overlay = document.createElement('div');
    overlay.id = 'video-download-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.95)';
    overlay.style.zIndex = '99999999'; // Extremely high z-index to ensure it's on top
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    
    // Create a clean, modern UI container
    overlay.innerHTML = `
        <div style="background:white; width:90%; max-width:600px; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.3); position:relative; z-index:9999999;">
            <!-- Header - UGA Red color -->
            <div style="background:#BA0C2F; color:white; padding:15px 20px; display:flex; justify-content:space-between; align-items:center;">
                <h2 style="margin:0; font-size:18px; font-family:Arial,sans-serif;">Your Video is Ready</h2>
                <button id="close-overlay-btn" style="background:transparent; border:none; color:white; font-size:22px; cursor:pointer; padding:0 5px;">×</button>
            </div>
            
            <!-- Instructions with numbered steps -->
            <div style="padding:20px; border-bottom:1px solid #eee; font-family:Arial,sans-serif;">
                <div style="display:flex; align-items:center; margin-bottom:15px;">
                    <div style="min-width:40px; height:40px; background:#BA0C2F; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-right:15px; font-weight:bold;">1</div>
                    <p style="margin:0; font-size:16px;">Tap and hold on the video below</p>
                </div>
                <div style="display:flex; align-items:center; margin-bottom:15px;">
                    <div style="min-width:40px; height:40px; background:#BA0C2F; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-right:15px; font-weight:bold;">2</div>
                    <p style="margin:0; font-size:16px;">Select "Download Video" or "Save Video"</p>
                </div>
                <div style="display:flex; align-items:center;">
                    <div style="min-width:40px; height:40px; background:#BA0C2F; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-right:15px; font-weight:bold;">3</div>
                    <p style="margin:0; font-size:16px;">Your video will be saved to your device</p>
                </div>
            </div>
            
            <!-- Video player with attention-grabbing border - clearly marked TAP AND HOLD HERE -->
            <div style="padding:20px; position:relative; text-align:center;">
                <div style="border:2px dashed #BA0C2F; padding:8px; border-radius:8px; position:relative; overflow:hidden;">
                    <div style="position:absolute; top:-12px; left:50%; transform:translateX(-50%); background:white; padding:0 10px; color:#BA0C2F; font-weight:bold; font-family:Arial,sans-serif; z-index:2;">TAP AND HOLD HERE</div>
                    
                    <!-- Animated tap hint overlay that pulses -->
                    <div id="tap-hint-overlay" style="position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(186,12,47,0.1); z-index:1; pointer-events:none; animation:tapPulse 2s infinite;"></div>
                    
                    <video controls style="width:100%; display:block; border-radius:4px; position:relative; z-index:1;">
                        <source src="${url}" type="video/${fileExtension}">
                        Your browser does not support the video tag.
                    </video>
                </div>
                <p style="text-align:center; margin-top:15px; color:#666; font-size:14px; font-family:Arial,sans-serif;">Filename: ${filename}</p>
            </div>
            
            <!-- Bottom controls - improved for iOS -->
            <div style="padding:15px 20px; background:#f5f5f5; text-align:center; font-family:Arial,sans-serif;">
                <button id="remind-later-btn" style="background:#666; color:white; border:none; padding:10px 20px; border-radius:4px; margin-right:10px; cursor:pointer; font-family:Arial,sans-serif;">Remind me later</button>
                <button id="direct-link-btn" style="background:#BA0C2F; color:white; border:none; padding:10px 20px; border-radius:4px; cursor:pointer; font-family:Arial,sans-serif;">Try Direct Link</button>
            </div>
        </div>
    `;
    
    // Append to document body
    document.body.appendChild(overlay);
    
    // Add the animation style
    const animationStyle = document.createElement('style');
    animationStyle.innerHTML = `
        @keyframes tapPulse {
            0% { opacity: 0; }
            50% { opacity: 0.5; }
            100% { opacity: 0; }
        }
        
        @keyframes pulseAttention {
            0% { box-shadow: 0 0 0 0 rgba(186, 12, 47, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(186, 12, 47, 0); }
            100% { box-shadow: 0 0 0 0 rgba(186, 12, 47, 0); }
        }
        
        #video-download-overlay video {
            animation: pulseAttention 2s infinite;
        }
    `;
    document.head.appendChild(animationStyle);
    
    // Set up event listeners
    document.getElementById('close-overlay-btn').addEventListener('click', function() {
        overlay.remove();
        animationStyle.remove();
    });
    
    document.getElementById('remind-later-btn').addEventListener('click', function() {
        overlay.remove();
        animationStyle.remove();
        
        // Show a small floating reminder button that can reopen the overlay
        const reminderBtn = document.createElement('div');
        reminderBtn.style.position = 'fixed';
        reminderBtn.style.bottom = '20px';
        reminderBtn.style.right = '20px';
        reminderBtn.style.backgroundColor = '#BA0C2F';
        reminderBtn.style.color = 'white';
        reminderBtn.style.padding = '12px';
        reminderBtn.style.borderRadius = '50%';
        reminderBtn.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
        reminderBtn.style.cursor = 'pointer';
        reminderBtn.style.zIndex = '999999';
        reminderBtn.style.width = '50px';
        reminderBtn.style.height = '50px';
        reminderBtn.style.display = 'flex';
        reminderBtn.style.alignItems = 'center';
        reminderBtn.style.justifyContent = 'center';
        reminderBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>';
        
        reminderBtn.addEventListener('click', function() {
            document.body.appendChild(overlay);
            document.head.appendChild(animationStyle);
            reminderBtn.remove();
        });
        
        document.body.appendChild(reminderBtn);
    });
    
    document.getElementById('direct-link-btn').addEventListener('click', function() {
        // Create and open a direct link
        // This may work on some iOS devices/versions
        window.location.href = url;
        
        // Show a timeout message after 3 seconds if the user is still here
        setTimeout(function() {
            const directLinkBtn = document.getElementById('direct-link-btn');
            if (directLinkBtn) {
                directLinkBtn.textContent = "Continue with manual download";
                directLinkBtn.style.backgroundColor = "#4CAF50";
            }
        }, 3000);
    });
    
    // Auto-play the video
    const videoElement = overlay.querySelector('video');
    if (videoElement) {
        videoElement.play().catch(e => console.log("Auto-play prevented:", e));
    }
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