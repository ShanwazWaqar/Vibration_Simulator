/**
 * MobileRecordingHelper.js
 * Provides platform-specific recording guidance for mobile users
 * 
 * This helper detects the user's platform and provides appropriate
 * recording instructions and alternatives when browser-based
 * screen recording is not available.
 */

class MobileRecordingHelper {
    constructor() {
      // Platform detection
      this.platform = this.detectPlatform();
      
      // UI elements
      this.banner = null;
      this.helpModal = null;
      
      // Initialize
      this.initialize();
    }
    
    /**
     * Detect platform details
     */
    detectPlatform() {
      const ua = navigator.userAgent;
      const platform = {
        isIOS: /iPad|iPhone|iPod/.test(ua) && !window.MSStream,
        isAndroid: /Android/.test(ua),
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua),
        browser: 'unknown',
        version: 0,
        isiPadOS: false
      };
      
      // Detect iOS versions
      if (platform.isIOS) {
        const match = ua.match(/OS (\d+)_(\d+)_?(\d+)?/);
        platform.version = match ? parseInt(match[1], 10) : 0;
      }
      
      // Special case: detect iPadOS (which may report as desktop Safari)
      // iPadOS 13+ can use desktop Safari which doesn't show up as iPad in UA
      if (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua)) {
        platform.isiPadOS = true;
        platform.isIOS = true;
        platform.isMobile = true;
      }
      
      // Detect browser
      if (/CriOS/.test(ua)) {
        platform.browser = 'chrome-ios'; // Chrome on iOS
      } else if (/Chrome/.test(ua)) {
        platform.browser = 'chrome';
      } else if (/Firefox/.test(ua)) {
        platform.browser = 'firefox';
      } else if (/Safari/.test(ua)) {
        platform.browser = 'safari';
      } else if (/Edge|Edg/.test(ua)) {
        platform.browser = 'edge';
      }
      
      // Check for iOS browsers (all use WebKit internally)
      if (platform.isIOS && platform.browser !== 'safari') {
        platform.realBrowser = 'webkit';
      }
      
      // Check for specific screen recording API support
      platform.supportsScreenCapture = false;
      
      // Test for screen capture API
      if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
        platform.supportsScreenCapture = true;
        
        // Exception: On iOS, getDisplayMedia might exist but doesn't actually work
        if (platform.isIOS && !platform.isiPadOS) {
          platform.supportsScreenCapture = false;
        }
      }
      
      console.log('Platform detected:', platform);
      return platform;
    }
    
    /**
     * Initialize the helper
     */
    initialize() {
      // Only run for mobile devices
      if (!this.platform.isMobile) return;
      
      // Create UI components
      this.createBanner();
      this.createHelpModal();
      
      // Create help button in header (if header exists)
      const header = document.getElementById('header');
      if (header) {
        this.createHelpButton(header);
      }
      
      // Initialize recording functionality based on platform
      this.initializeRecording();
    }
    
    /**
     * Initialize platform-specific recording functionality
     */
    initializeRecording() {
      // Check if the UnityVideoRecorder exists
      const hasRecorder = window.unityVideoRecorder && 
                          typeof window.unityVideoRecorder.startRecording === 'function';
      
      // Handle iOS-specific logic
      if (this.platform.isIOS) {
        if (this.platform.isiPadOS) {
          // iPadOS with desktop Safari - might support screen capture API
          console.log('iPadOS detected, may support screen capture');
          
          // Will attempt to use the recorder if it exists
          if (!hasRecorder) {
            this.showBanner('ipados-no-recorder');
          }
        } else {
          // Regular iOS - recommend using built-in recording
          console.log('iOS detected, showing native recording recommendation');
          this.showBanner('ios');
        }
      }
      
      // Handle Android-specific logic
      else if (this.platform.isAndroid) {
        if (this.platform.supportsScreenCapture) {
          console.log('Android with screen capture support detected');
          
          // In desktop mode, don't show the banner
          if (this.isDesktopMode()) {
            console.log('Android in desktop mode, should work normally');
          } else {
            // In mobile mode, suggest desktop mode for better results
            this.showBanner('android-mobile-mode');
          }
        } else {
          // Android but no screen capture support
          console.log('Android without screen capture support detected');
          this.showBanner('android-no-support');
        }
      }
      
      // Replace start recording functionality if original recorder exists
      if (hasRecorder) {
        // Store original method
        this.originalStartRecording = window.unityVideoRecorder.startRecording;
        
        // Replace with our platform-aware version
        window.unityVideoRecorder.startRecording = () => {
          // For iOS (except iPadOS in desktop mode), show our instructions instead
          if (this.platform.isIOS && !this.platform.isiPadOS) {
            console.log('iOS detected, showing iOS recording instructions');
            this.showIOSInstructions();
            return;
          }
          
          // For Android in mobile mode, suggest desktop mode first but allow trying
          if (this.platform.isAndroid && !this.isDesktopMode() && !this.hasTriedRecording) {
            console.log('First Android recording attempt, showing suggestions');
            this.showAndroidInstructions();
            this.hasTriedRecording = true;
            return;
          }
          
          // For all other cases, use the original recording method
          console.log('Using original recording method');
          this.originalStartRecording.call(window.unityVideoRecorder);
        };
      }
    }
    
    /**
     * Check if browser is in desktop mode (rough estimation)
     */
    isDesktopMode() {
      // A very rough heuristic - real desktop mode detection is complex
      // and not entirely reliable without user agent spoofing detection
      const viewportWidth = window.innerWidth;
      return viewportWidth >= 1000; // Arbitrary threshold
    }
    
    /**
     * Create informational banner
     */
    createBanner() {
      this.banner = document.createElement('div');
      this.banner.id = 'mobile-recording-banner';
      this.banner.style.cssText = `
        position: fixed;
        top: ${document.getElementById('header') ? '60px' : '0'};
        left: 0;
        right: 0;
        background-color: rgba(0, 0, 0, 0.85);
        color: white;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        padding: 12px 16px;
        z-index: 1000;
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        border-bottom: 2px solid #BA0C2F;
      `;
      
      // Create content container
      const contentContainer = document.createElement('div');
      contentContainer.className = 'banner-content';
      this.banner.appendChild(contentContainer);
      
      // Create button container
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'banner-button-container';
      this.banner.appendChild(buttonContainer);
      
      // Add close button
      const closeButton = document.createElement('button');
      closeButton.innerHTML = '&times;';
      closeButton.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      
      closeButton.addEventListener('click', () => {
        this.hideBanner();
      });
      
      this.banner.appendChild(closeButton);
      
      // Add to document
      document.body.appendChild(this.banner);
    }
    
    /**
     * Get standard button styles
     */
    getButtonStyles() {
      return `
        background-color: #BA0C2F;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        margin-top: 8px;
      `;
    }
    
    /**
     * Create help button in header
     */
    createHelpButton(headerElement) {
      const helpButton = document.createElement('button');
      helpButton.id = 'recording-help-button';
      helpButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        Recording Help
      `;
      
      helpButton.style.cssText = `
        background-color: rgba(255, 255, 255, 0.1);
        border: none;
        border-radius: 8px;
        color: white;
        padding: 8px 12px;
        font-size: 14px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-left: 8px;
      `;
      
      helpButton.addEventListener('click', () => {
        if (this.platform.isIOS) {
          this.showIOSInstructions();
        } else if (this.platform.isAndroid) {
          this.showAndroidInstructions();
        } else {
          this.showGeneralInstructions();
        }
      });
      
      // Add to header (before the last child)
      const controls = headerElement.querySelector('#controls');
      if (controls) {
        controls.insertBefore(helpButton, controls.lastChild);
      } else {
        headerElement.appendChild(helpButton);
      }
    }
    
    /**
     * Show the banner
     * @param {string} type - Type of banner to show (ios, android-mobile-mode, etc.)
     */
    showBanner(type = 'default') {
      if (!this.banner) return;
      
      let bannerContent = '';
      let actionButton = null;
      
      switch (type) {
        case 'ios':
          bannerContent = `
            <div style="margin-bottom: 8px;">
              <strong>Need to record?</strong> Use iOS Screen Recording from Control Center.
            </div>
            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 8px;">
              In-browser recording is not available on iOS devices.
            </div>
          `;
          
          actionButton = document.createElement('button');
          actionButton.textContent = 'Show Recording Instructions';
          actionButton.style.cssText = this.getButtonStyles();
          
          actionButton.addEventListener('click', () => {
            this.showIOSInstructions();
          });
          break;
          
        case 'ipados-no-recorder':
          bannerContent = `
            <div style="margin-bottom: 8px;">
              <strong>iPadOS Detected</strong> Recording should work if you request desktop site.
            </div>
            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 8px;">
              Try enabling "Request Desktop Website" in Safari settings.
            </div>
          `;
          break;
          
        case 'android-mobile-mode':
          bannerContent = `
            <div style="margin-bottom: 8px;">
              <strong>For better recording</strong>, try switching to Desktop Mode in Chrome.
            </div>
            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 8px;">
              Chrome menu → Desktop site
            </div>
          `;
          
          actionButton = document.createElement('button');
          actionButton.textContent = 'Show Recording Instructions';
          actionButton.style.cssText = this.getButtonStyles();
          
          actionButton.addEventListener('click', () => {
            this.showAndroidInstructions();
          });
          break;
          
        case 'android-no-support':
          bannerContent = `
            <div style="margin-bottom: 8px;">
              <strong>Recording API not detected</strong> Use your device's built-in screen recorder.
            </div>
            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 8px;">
              Usually found in quick settings or notification shade.
            </div>
          `;
          
          actionButton = document.createElement('button');
          actionButton.textContent = 'Show Instructions';
          actionButton.style.cssText = this.getButtonStyles();
          
          actionButton.addEventListener('click', () => {
            this.showAndroidNativeInstructions();
          });
          break;
          
        default:
          bannerContent = `
            <div style="margin-bottom: 8px;">
              <strong>Need help recording?</strong> Click for platform-specific instructions.
            </div>
          `;
          
          actionButton = document.createElement('button');
          actionButton.textContent = 'Recording Instructions';
          actionButton.style.cssText = this.getButtonStyles();
          
          actionButton.addEventListener('click', () => {
            if (this.platform.isIOS) {
              this.showIOSInstructions();
            } else if (this.platform.isAndroid) {
              this.showAndroidInstructions();
            } else {
              this.showGeneralInstructions();
            }
          });
      }
      
      // Update banner content
      const contentContainer = this.banner.querySelector('.banner-content');
      if (contentContainer) {
        contentContainer.innerHTML = bannerContent;
      }
      
      // Update action button
      const buttonContainer = this.banner.querySelector('.banner-button-container');
      if (buttonContainer) {
        buttonContainer.innerHTML = '';
        if (actionButton) {
          buttonContainer.appendChild(actionButton);
        }
      }
      
      // Show the banner
      this.banner.style.display = 'flex';
    }
    
    /**
     * Hide the banner
     */
    hideBanner() {
      if (this.banner) {
        this.banner.style.display = 'none';
      }
    }
    
    /**
     * Show iOS recording instructions
     */
    showIOSInstructions() {
      // Set iOS-specific content
      const contentDiv = this.helpModal.querySelector('.help-modal-content');
      
      // Different content for iPadOS vs iOS
      if (this.platform.isiPadOS) {
        contentDiv.innerHTML = `
          <h2 style="margin-top: 0; margin-bottom: 16px; color: #333; font-size: 20px;">Recording on iPad</h2>
          
          <div style="margin-bottom: 24px;">
            <p style="margin-bottom: 12px;">You have two options for recording on iPad:</p>
            
            <h3 style="margin: 16px 0 8px 0; color: #444; font-size: 16px;">Option 1: Request Desktop Site</h3>
            <ol style="padding-left: 24px; margin-bottom: 20px; line-height: 1.5;">
              <li>Tap the <strong>aA</strong> icon in Safari's address bar</li>
              <li>Select <strong>Request Desktop Website</strong></li>
              <li>Reload this page</li>
              <li>Try the recording button again</li>
            </ol>
            
            <h3 style="margin: 16px 0 8px 0; color: #444; font-size: 16px;">Option 2: Use Built-in Screen Recording</h3>
            <ol style="padding-left: 24px; margin-bottom: 20px; line-height: 1.5;">
              <li><strong>Swipe down</strong> from the top-right corner to open Control Center</li>
              <li>Tap the Screen Recording button <span style="display: inline-block; width: 18px; height: 18px; background-color: #f2f2f2; border-radius: 50%; border: 2px solid #999; position: relative;"><span style="position: absolute; top: 4px; left: 4px; width: 10px; height: 10px; background-color: #ff3b30; border-radius: 50%;"></span></span></li>
              <li>Wait for the <strong>3-second countdown</strong></li>
              <li>When finished, tap the red status bar and select <strong>Stop</strong></li>
            </ol>
          </div>
          
          <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
            <button id="ios-reminder-button" style="flex: 1; min-width: 120px; background-color: #BA0C2F; color: white; border: none; border-radius: 8px; padding: 10px 12px; font-size: 14px; font-weight: 600; cursor: pointer;">Set Recording Reminder</button>
            <button id="try-desktop-recording" style="flex: 1; min-width: 120px; background-color: #4A5568; color: white; border: none; border-radius: 8px; padding: 10px 12px; font-size: 14px; font-weight: 600; cursor: pointer;">Try Browser Recording</button>
          </div>
        `;
        
        // Show the modal
        this.showHelpModal();
        
        // Add event listeners
        document.getElementById('ios-reminder-button')?.addEventListener('click', () => {
          this.setRecordingReminder();
        });
        
        document.getElementById('try-desktop-recording')?.addEventListener('click', () => {
          this.hideHelpModal();
          
          // Try to start recording via the original method
          if (this.originalStartRecording) {
            this.originalStartRecording.call(window.unityVideoRecorder);
          }
          // Fallback if we don't have the original method
          else if (window.unityVideoRecorder && typeof window.unityVideoRecorder.startRecording === 'function') {
            window.unityVideoRecorder.startRecording();
          }
        });
      }
      else {
        // Regular iOS content
        contentDiv.innerHTML = `
          <h2 style="margin-top: 0; margin-bottom: 16px; color: #333; font-size: 20px;">Recording on iPhone</h2>
          
          <div style="margin-bottom: 24px;">
            <p style="margin-bottom: 12px;">Unfortunately, Safari and other browsers on iPhone can't record screens directly due to iOS restrictions. But you can use the built-in iOS Screen Recording feature:</p>
            
            <ol style="padding-left: 24px; margin-bottom: 20px; line-height: 1.5;">
              <li><strong>Swipe down</strong> from the top-right corner to open Control Center</li>
              <li><strong>Tap</strong> the Screen Recording button <span style="display: inline-block; width: 18px; height: 18px; background-color: #f2f2f2; border-radius: 50%; border: 2px solid #999; position: relative;"><span style="position: absolute; top: 4px; left: 4px; width: 10px; height: 10px; background-color: #ff3b30; border-radius: 50%;"></span></span></li>
              <li>Wait for the <strong>3-second countdown</strong></li>
              <li>Return to this simulator</li>
              <li>When finished, tap the <strong>red status bar</strong> and select <strong>Stop</strong></li>
            </ol>
            
            <p style="margin-bottom: 12px;">Your recording will be saved to your Photos app.</p>
            
            <div style="margin-top: 20px; padding: 12px; background: #f8f9fa; border-radius: 8px; font-size: 13px;">
              <strong>Note:</strong> If you don't see the Screen Recording button in Control Center, you can add it through Settings → Control Center → Customize Controls.
            </div>
          </div>
          
          <div style="text-align: center;">
            <button id="ios-reminder-button" style="background-color: #BA0C2F; color: white; border: none; border-radius: 8px; padding: 10px 16px; font-size: 14px; font-weight: 600; cursor: pointer;">Set 3-Second Reminder</button>
            <p style="font-size: 12px; color: #666; margin-top: 8px;">This gives you time to open Control Center</p>
          </div>
        `;
        
        // Show the modal
        this.showHelpModal();
        
        // Add event listener for the reminder button
        const reminderButton = document.getElementById('ios-reminder-button');
        if (reminderButton) {
          reminderButton.addEventListener('click', () => {
            this.setRecordingReminder();
          });
        }
      }
    }
    
    /**
     * Show Android instructions
     */
    showAndroidInstructions() {
      // Set Android-specific content
      const contentDiv = this.helpModal.querySelector('.help-modal-content');
      contentDiv.innerHTML = `
        <h2 style="margin-top: 0; margin-bottom: 16px; color: #333; font-size: 20px;">Recording on Android</h2>
        
        <div style="margin-bottom: 24px;">
          <p style="margin-bottom: 12px;">You have two options for recording on Android:</p>
          
          <h3 style="margin: 16px 0 8px 0; color: #444; font-size: 16px;">Option 1: Browser Recording (Recommended)</h3>
          <ol style="padding-left: 24px; margin-bottom: 16px; line-height: 1.5;">
            <li>Enable <strong>Desktop site</strong> in Chrome menu (three dots)</li>
            <li>Reload this page</li>
            <li>Tap <strong>Try Browser Recording</strong> below</li>
            <li>Select <strong>This tab</strong> when prompted</li>
            <li>When finished, tap the <strong>Stop</strong> button</li>
          </ol>
          
          <h3 style="margin: 16px 0 8px 0; color: #444; font-size: 16px;">Option 2: Built-in Screen Recorder</h3>
          <ol style="padding-left: 24px; margin-bottom: 16px; line-height: 1.5;">
            <li><strong>Swipe down twice</strong> from the top of your screen</li>
            <li>Find and tap the <strong>Screen Record</strong> button</li>
            <li>Select options and tap <strong>Start</strong></li>
            <li>When finished, pull down the notification shade and tap <strong>Stop</strong></li>
          </ol>
        </div>
        
        <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <button id="try-recording-button" style="flex: 1; min-width: 120px; background-color: #BA0C2F; color: white; border: none; border-radius: 8px; padding: 10px 12px; font-size: 14px; font-weight: 600; cursor: pointer;">Try Browser Recording</button>
          <button id="try-desktop-button" style="flex: 1; min-width: 120px; background-color: #4A5568; color: white; border: none; border-radius: 8px; padding: 10px 12px; font-size: 14px; font-weight: 600; cursor: pointer;">Show Desktop Mode Help</button>
        </div>
      `;
      
      // Show the modal
      this.showHelpModal();
      
      // Add event listener for the try recording button
      const tryRecordingButton = document.getElementById('try-recording-button');
      if (tryRecordingButton) {
        tryRecordingButton.addEventListener('click', () => {
          this.hideHelpModal();
          
          // Try to start recording via the original method
          if (this.originalStartRecording) {
            this.originalStartRecording.call(window.unityVideoRecorder);
          }
          // Fallback if we don't have the original method
          else if (window.unityVideoRecorder && typeof window.unityVideoRecorder.startRecording === 'function') {
            window.unityVideoRecorder.startRecording();
          }
        });
      }
      
      // Add event listener for the desktop mode help button
      const desktopHelpButton = document.getElementById('try-desktop-button');
      if (desktopHelpButton) {
        desktopHelpButton.addEventListener('click', () => {
          this.showDesktopModeInstructions();
        });
      }
    }
    
    /**
     * Show Android native recording instructions
     */
    showAndroidNativeInstructions() {
      // Set Android-specific content for native recording
      const contentDiv = this.helpModal.querySelector('.help-modal-content');
      contentDiv.innerHTML = `
        <h2 style="margin-top: 0; margin-bottom: 16px; color: #333; font-size: 20px;">Android Screen Recording</h2>
        
        <div style="margin-bottom: 24px;">
          <p style="margin-bottom: 12px;">Your browser doesn't support screen recording, but you can use Android's built-in screen recorder:</p>
          
          <ol style="padding-left: 24px; margin-bottom: 16px; line-height: 1.5;">
            <li><strong>Swipe down twice</strong> from the top of your screen to open Quick Settings</li>
            <li>Find the <strong>Screen Record</strong> button 
              <span style="display: inline-block; padding: 2px 6px; background: #f0f0f0; border-radius: 4px; font-size: 12px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </span>
            </li>
            <li>If you don't see it, you may need to edit your Quick Settings tiles</li>
            <li>Select recording options and tap <strong>Start</strong></li>
            <li>Return to this simulator</li>
            <li>When finished, pull down notification shade and tap <strong>Stop</strong></li>
          </ol>
          
          <div style="margin-top: 20px; padding: 12px; background: #f8f9fa; border-radius: 8px; font-size: 13px;">
            <strong>Note:</strong> Location and appearance of screen recording controls may vary by device manufacturer and Android version.
          </div>
        </div>
        
        <div style="display: flex; justify-content: center;">
          <button id="close-help-button" style="background-color: #f2f2f2; color: #333; border: none; border-radius: 8px; padding: 10px 16px; font-size: 14px; font-weight: 600; cursor: pointer; min-width: 120px;">Got It</button>
        </div>
      `;
      
      // Show the modal
      this.showHelpModal();
      
      // Add event listener for the close button
      const closeButton = document.getElementById('close-help-button');
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          this.hideHelpModal();
        });
      }
    }
    
    /**
     * Show desktop mode instructions for Android
     */
    showDesktopModeInstructions() {
      // Set desktop mode instructions content
      const contentDiv = this.helpModal.querySelector('.help-modal-content');
      contentDiv.innerHTML = `
        <h2 style="margin-top: 0; margin-bottom: 16px; color: #333; font-size: 20px;">Enable Desktop Mode</h2>
        
        <div style="margin-bottom: 24px;">
          <p style="margin-bottom: 16px;">Follow these steps to enable Desktop Mode in Chrome:</p>
          
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div style="display: flex; gap: 16px; align-items: center;">
              <div style="flex: 0 0 30px; text-align: center; font-weight: bold; font-size: 18px; color: #BA0C2F;">1</div>
              <div>
                <p>Tap the <strong>three dots</strong> menu in the top-right corner of Chrome</p>
              </div>
            </div>
            
            <div style="display: flex; gap: 16px; align-items: center;">
              <div style="flex: 0 0 30px; text-align: center; font-weight: bold; font-size: 18px; color: #BA0C2F;">2</div>
              <div>
                <p>Scroll down and check the box for <strong>Desktop site</strong></p>
              </div>
            </div>
            
            <div style="display: flex; gap: 16px; align-items: center;">
              <div style="flex: 0 0 30px; text-align: center; font-weight: bold; font-size: 18px; color: #BA0C2F;">3</div>
              <div>
                <p>The page will reload in desktop mode</p>
              </div>
            </div>
            
            <div style="display: flex; gap: 16px; align-items: center;">
              <div style="flex: 0 0 30px; text-align: center; font-weight: bold; font-size: 18px; color: #BA0C2F;">4</div>
              <div>
                <p>Try the recording button again</p>
              </div>
            </div>
          </div>
        </div>
        
        <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <button id="back-button" style="flex: 1; min-width: 120px; background-color: #f2f2f2; color: #333; border: none; border-radius: 8px; padding: 10px 12px; font-size: 14px; font-weight: 600; cursor: pointer;">Back</button>
          <button id="try-recording-button-2" style="flex: 1; min-width: 120px; background-color: #BA0C2F; color: white; border: none; border-radius: 8px; padding: 10px 12px; font-size: 14px; font-weight: 600; cursor: pointer;">Try Recording</button>
        </div>
      `;
      
      // Show the modal
      this.showHelpModal();
      
      // Add event listener for the back button
      const backButton = document.getElementById('back-button');
      if (backButton) {
        backButton.addEventListener('click', () => {
          this.showAndroidInstructions();
        });
      }
      
      // Add event listener for the try recording button
      const tryRecordingButton = document.getElementById('try-recording-button-2');
      if (tryRecordingButton) {
        tryRecordingButton.addEventListener('click', () => {
          this.hideHelpModal();
          
          // Try to start recording via the original method
          if (this.originalStartRecording) {
            this.originalStartRecording.call(window.unityVideoRecorder);
          }
          // Fallback if we don't have the original method
          else if (window.unityVideoRecorder && typeof window.unityVideoRecorder.startRecording === 'function') {
            window.unityVideoRecorder.startRecording();
          }
        });
      }
    }
    
    /**
     * Show general recording instructions
     */
    showGeneralInstructions() {
      // Create modal if it doesn't exist
      if (!this.helpModal) {
        this.createHelpModal();
      }
      
      // Set general content
      const contentDiv = this.helpModal.querySelector('.help-modal-content');
      contentDiv.innerHTML = `
        <h2 style="margin-top: 0; margin-bottom: 16px; color: #333; font-size: 20px;">Recording Instructions</h2>
        
        <div style="margin-bottom: 24px;">
          <p style="margin-bottom: 12px;">To record your simulation:</p>
          
          <ol style="padding-left: 24px; margin-bottom: 16px; line-height: 1.5;">
            <li>Click the <strong>Start Simulation</strong> button</li>
            <li>When prompted, select <strong>This Tab</strong> to share your screen</li>
            <li>The recording will start automatically</li>
            <li>When finished, click the <strong>Stop</strong> button to end recording</li>
            <li>Your recording will download automatically</li>
          </ol>
          
          <p style="margin: 12px 0; color: #444;">If you encounter any issues:</p>
          <ul style="padding-left: 24px; margin-bottom: 16px; line-height: 1.5;">
            <li>Make sure you're using a supported browser (Chrome, Firefox, Edge)</li>
            <li>Check that you've granted the proper permissions</li>
            <li>Try refreshing the page and starting again</li>
          </ul>
        </div>
        
        <div style="text-align: center;">
          <button id="close-help-button" style="background-color: #f2f2f2; color: #333; border: none; border-radius: 8px; padding: 10px 16px; font-size: 14px; font-weight: 600; cursor: pointer;">Close</button>
        </div>
      `;
      
      // Show the modal
      this.showHelpModal();
      
      // Add event listener for the close button
      const closeButton = document.getElementById('close-help-button');
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          this.hideHelpModal();
        });
      }
    }
    
    /**
     * Create help modal
     */
    createHelpModal() {
      this.helpModal = document.createElement('div');
      this.helpModal.className = 'recording-help-modal';
      this.helpModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
      `;
      
      // Create modal container
      const modalContainer = document.createElement('div');
      modalContainer.style.cssText = `
        background-color: white;
        border-radius: 12px;
        width: 90%;
        max-width: 400px;
        max-height: 90%;
        overflow-y: auto;
        padding: 24px;
        position: relative;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
      `;
      
      // Create close button
      const closeButton = document.createElement('button');
      closeButton.innerHTML = '&times;';
      closeButton.style.cssText = `
        position: absolute;
        top: 12px;
        right: 12px;
        background: none;
        border: none;
        color: #666;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      
      closeButton.addEventListener('click', () => {
        this.hideHelpModal();
      });
      
      // Create content container
      const contentDiv = document.createElement('div');
      contentDiv.className = 'help-modal-content';
      
      // Assemble modal
      modalContainer.appendChild(closeButton);
      modalContainer.appendChild(contentDiv);
      this.helpModal.appendChild(modalContainer);
      
      // Add to document
      document.body.appendChild(this.helpModal);
    }
    
    /**
     * Show help modal
     */
    showHelpModal() {
      if (!this.helpModal) return;
      
      this.helpModal.style.opacity = '1';
      this.helpModal.style.visibility = 'visible';
    }
    
    /**
     * Hide help modal
     */
    hideHelpModal() {
      if (!this.helpModal) return;
      
      this.helpModal.style.opacity = '0';
      this.helpModal.style.visibility = 'hidden';
    }
    
    /**
     * Set a recording reminder notification
     * This gives users 3 seconds to open Control Center on iOS
     */
    setRecordingReminder() {
      // Hide the help modal
      this.hideHelpModal();
      
      // Show countdown notification
      this.showCountdownNotification();
    }
    
    /**
     * Show countdown notification
     */
    showCountdownNotification() {
      // Create notification element
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(0, 0, 0, 0.9);
        color: white;
        border-radius: 12px;
        padding: 20px;
        text-align: center;
        z-index: 2000;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
      `;
      
      notification.innerHTML = `
        <div style="font-size: 20px; margin-bottom: 10px;">Open Control Center Now</div>
        <div style="font-size: 40px; font-weight: bold; margin: 15px 0;" id="countdown-number">3</div>
        <div style="font-size: 14px;">Swipe down from top-right corner</div>
      `;
      
      // Add to document
      document.body.appendChild(notification);
      
      // Start countdown
      let count = 3;
      const countdownElement = document.getElementById('countdown-number');
      
      const interval = setInterval(() => {
        count--;
        
        if (countdownElement) {
          countdownElement.textContent = count;
        }
        
        if (count <= 0) {
          clearInterval(interval);
          
          // Remove notification after countdown
          setTimeout(() => {
            document.body.removeChild(notification);
          }, 500);
        }
      }, 1000);
    }
  }
  
  // Initialize helper when the page loads
  window.addEventListener('DOMContentLoaded', () => {
    window.mobileRecordingHelper = new MobileRecordingHelper();
  });