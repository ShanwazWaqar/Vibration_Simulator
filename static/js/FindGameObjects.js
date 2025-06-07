/**
 * FindGameObjects.js - Helper script to communicate with Unity GameObjects
 * 
 * This script helps locate the appropriate GameManager object in Unity
 * and adds support for recording operations.
 */

class UnityGameObjectFinder {
    constructor() {
      this.gameInstance = null;
      this.gameManagerName = null;
      this.possibleGameManagerNames = [
        "GameManager",
        "GameManger", // Common typo/variant (without 'a')
        "MyGameNamespace.GameManager", // With namespace
        "MyGameNamespace.GameManger", // With namespace (without 'a')
        "/GameManager", // Root path
        "/GameManger", // Root path (without 'a')
        "GameController", // Alternative name
        "SimulationManager", // Alternative name
        "Game Manager", // With space
        "SimulationController" // Another possibility
      ];
  
      // Bind methods
      this.findGameManager = this.findGameManager.bind(this);
      this.addRecordingSupport = this.addRecordingSupport.bind(this);
      this.setupUnityTakeScreenshotHandler = this.setupUnityTakeScreenshotHandler.bind(this);
      this.waitForUnityInstance = this.waitForUnityInstance.bind(this);
      this.waitForUnityInstance();
    }
  
    /**
     * Wait for Unity instance to be initialized
     */
    waitForUnityInstance() {
      const checkInterval = setInterval(() => {
        // Check if Unity instance exists in any of the common variable names
        const possibleInstanceNames = ['gameInstance', 'unityInstance', 'unityGame'];
        
        for (const name of possibleInstanceNames) {
          if (window[name] && typeof window[name].SendMessage === 'function') {
            this.gameInstance = window[name];
            console.log(`Found Unity instance as window.${name}`);
            clearInterval(checkInterval);
            this.findGameManager();
            this.addRecordingSupport();
            return;
          }
        }
        
        // Also check for any global variable that has SendMessage method
        for (const key in window) {
          if (window[key] && 
              typeof window[key] === 'object' && 
              typeof window[key].SendMessage === 'function') {
            this.gameInstance = window[key];
            console.log(`Found Unity instance as window.${key}`);
            clearInterval(checkInterval);
            this.findGameManager();
            this.addRecordingSupport();
            return;
          }
        }
      }, 1000);
  
      // Stop checking after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!this.gameInstance) {
          console.warn("Could not find Unity instance after 30 seconds");
        }
      }, 30000);
    }
  
    /**
     * Find the correct GameManager object in Unity
     */
    findGameManager() {
      if (!this.gameInstance) {
        console.error("Cannot find GameManager: Unity instance not available");
        return null;
      }
  
      console.log("Attempting to find Unity GameManager...");
      
      // Log all root GameObjects to console for debugging
      try {
        console.log("Checking for available Unity GameObjects...");
        this.gameInstance.SendMessage("GameObject", "LogAllRootObjects");
      } catch (e) {
        console.log("Cannot log root objects");
      }
  
      // Test each possible name
      for (const name of this.possibleGameManagerNames) {
        try {
          console.log(`Testing GameObject name: ${name}`);
          this.gameInstance.SendMessage(name, "TestMessageReceived");
          console.log(`Found valid GameObject: ${name}`);
          this.gameManagerName = name;
          return name;
        } catch (e) {
          console.log(`Cannot find GameObject: ${name}`);
        }
      }
  
      // Default fallback
      console.log("Using GameManager as fallback");
      this.gameManagerName = "GameManager";
      return "GameManager";
    }
  
    /**
     * Add recording support to Unity
     */
    addRecordingSupport() {
      if (!this.gameInstance || !this.gameManagerName) {
        console.warn("Cannot add recording support: Unity instance or GameManager not found");
        return;
      }
  
      // Set up handling for Unity-initiated screenshots
      this.setupUnityTakeScreenshotHandler();
  
      // Add recording methods to Unity GameObject
      try {
        // Expose recording functions to the game manager
        window.startRecordingFromUnity = () => {
          if (window.unityVideoRecorder) {
            window.unityVideoRecorder.startRecording();
          }
        };
  
        window.stopRecordingFromUnity = () => {
          if (window.unityVideoRecorder) {
            window.unityVideoRecorder.stopRecording();
          }
        };
  
        console.log("Recording support added to Unity GameManager");
      } catch (error) {
        console.error("Error adding recording support:", error);
      }
    }
  
    /**
     * Set up handler for Unity screenshot function
     */
    setupUnityTakeScreenshotHandler() {
      // This will be called from Unity's GameManager.TakeScreenshot method
      window.receiveUnityScreenshot = function(base64Data) {
        try {
          // Create a download link for the screenshot
          const a = document.createElement('a');
          a.href = "data:image/png;base64," + base64Data;
          a.download = `unity-screenshot-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
          }, 100);
          
          console.log("Screenshot saved from Unity");
        } catch (error) {
          console.error("Error handling Unity screenshot:", error);
        }
      };
    }
  
    /**
     * Get the current game manager name
     */
    getGameManagerName() {
      return this.gameManagerName;
    }
  
    /**
     * Get the Unity instance
     */
    getUnityInstance() {
      return this.gameInstance;
    }
  
    /**
     * Send a message to Unity
     */
    sendMessage(methodName, parameter = null) {
      if (!this.gameInstance || !this.gameManagerName) {
        console.error("Cannot send message: Unity instance or GameManager not found");
        return false;
      }
  
      try {
        if (parameter !== null) {
          this.gameInstance.SendMessage(this.gameManagerName, methodName, parameter.toString());
        } else {
          this.gameInstance.SendMessage(this.gameManagerName, methodName);
        }
        return true;
      } catch (error) {
        console.error(`Error sending message to Unity (${methodName}):`, error);
        return false;
      }
    }
  }
  
  // Initialize on page load
  window.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for Unity to load
    setTimeout(() => {
      try {
        window.unityGameObjectFinder = new UnityGameObjectFinder();
        console.log('Unity GameObject finder initialized');
      } catch (e) {
        console.error('Error initializing Unity GameObject finder:', e);
      }
    }, 2000);
  });
  
  // Expose globally
  window.UnityGameObjectFinder = UnityGameObjectFinder;