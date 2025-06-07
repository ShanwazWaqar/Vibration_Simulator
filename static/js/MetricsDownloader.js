// MetricsDownloader.js - Handles simulation metrics collection and download

class MetricsDownloader {
    constructor() {
        // Initialize metrics storage
        this.metricsData = {
            // Simulation parameters
            SC: 0,
            BF: 0,
            AmpX: 0,
            AmpY: 0, 
            AmpZ: 0,
            freqX: 0,
            freqY: 0,
            freqZ: 0,
            sphereCount: 0,
            rectangleCount: 0,
            quartersphereCount: 0,
            halfsphereCount: 0,
            
            // Metrics data container
            metrics: {
                simulation_duration: 0,
                total_bonds: 0,
                bonds_formed: 0,
                bonds_broken: 0,
                max_cluster_size: 0,
                final_cluster_count: 0,
                bond_events: [],
                cluster_sizes: []
            },
            
            // Timestamps
            start_time: new Date().toISOString(),
            end_time: null,
            device_info: this.getDeviceInfo()
        };
        
        this.isRecording = false;
    }
    
    // Get basic device info
    getDeviceInfo() {
        return {
            userAgent: navigator.userAgent,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            platform: navigator.platform,
            language: navigator.language
        };
    }
    
    // Start collecting metrics
    startRecording(simulationParameters) {
        console.log("Starting metrics collection");
        this.isRecording = true;
        
        // Store simulation parameters
        if (simulationParameters) {
            Object.assign(this.metricsData, simulationParameters);
        }
        
        // Reset metrics
        this.metricsData.metrics = {
            simulation_duration: 0,
            total_bonds: 0,
            bonds_formed: 0,
            bonds_broken: 0,
            max_cluster_size: 0,
            final_cluster_count: 0,
            bond_events: [],
            cluster_sizes: []
        };
        
        this.metricsData.start_time = new Date().toISOString();
        this.metricsData.end_time = null;
        
        return true;
    }
    
    // Record a bond formation event
    recordBondFormed(time, agent1, agent2) {
        if (!this.isRecording) return false;
        
        this.metricsData.metrics.bonds_formed++;
        this.metricsData.metrics.total_bonds++;
        
        this.metricsData.metrics.bond_events.push({
            time: time,
            event_type: 'formed',
            agent1: agent1,
            agent2: agent2
        });
        
        return true;
    }
    
    // Record a bond breaking event
    recordBondBroken(time, agent1, agent2) {
        if (!this.isRecording) return false;
        
        this.metricsData.metrics.bonds_broken++;
        this.metricsData.metrics.total_bonds--;
        
        this.metricsData.metrics.bond_events.push({
            time: time,
            event_type: 'broken',
            agent1: agent1,
            agent2: agent2
        });
        
        return true;
    }
    
    // Record cluster size at a specific time
    recordClusterSize(time, maxSize, clusterCount) {
        if (!this.isRecording) return false;
        
        this.metricsData.metrics.cluster_sizes.push({
            time: time,
            max_size: maxSize,
            cluster_count: clusterCount
        });
        
        // Update max cluster size if this is larger
        if (maxSize > this.metricsData.metrics.max_cluster_size) {
            this.metricsData.metrics.max_cluster_size = maxSize;
        }
        
        return true;
    }
    
    // Update final metrics
    finalizeMetrics(duration, finalClusterCount) {
        if (!this.isRecording) return false;
        
        this.metricsData.metrics.simulation_duration = duration;
        this.metricsData.metrics.final_cluster_count = finalClusterCount;
        this.metricsData.end_time = new Date().toISOString();
        
        return true;
    }
    
    // Stop recording and trigger download
    stopAndDownload() {
        if (!this.isRecording) {
            console.warn("Not currently recording metrics");
            return false;
        }
        
        this.isRecording = false;
        
        // If end_time is not set, set it now
        if (!this.metricsData.end_time) {
            this.metricsData.end_time = new Date().toISOString();
        }
        
        console.log("Metrics collection stopped, preparing download");
        
        // Add some final calculations
        this.calculateDerivedMetrics();
        
        // Trigger the download
        this.downloadMetrics();
        
        return true;
    }
    
    // Calculate additional metrics before download
    calculateDerivedMetrics() {
        // Sort bond events by time
        this.metricsData.metrics.bond_events.sort((a, b) => a.time - b.time);
        
        // Sort cluster sizes by time
        this.metricsData.metrics.cluster_sizes.sort((a, b) => a.time - b.time);
        
        // Calculate net bonds
        this.metricsData.metrics.net_bonds = this.metricsData.metrics.bonds_formed - this.metricsData.metrics.bonds_broken;
        
        // Calculate bond rate (bonds per second)
        if (this.metricsData.metrics.simulation_duration > 0) {
            this.metricsData.metrics.bond_formation_rate = this.metricsData.metrics.bonds_formed / this.metricsData.metrics.simulation_duration;
        }
    }
    
    // Handle the actual download - method 1: Use browser download
    downloadMetrics() {
        try {
            // Create file content
            const fileContent = JSON.stringify(this.metricsData, null, 2);
            const blob = new Blob([fileContent], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            // Generate filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `vibration_simulation_metrics_${timestamp}.json`;
            
            // Create download link and trigger download
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            
            // Clean up
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 100);
            
            console.log(`Metrics downloaded as ${filename}`);
            return true;
        } catch (error) {
            console.error("Error downloading metrics:", error);
            // Try server method as fallback
            this.downloadMetricsViaServer();
            return false;
        }
    }
    
    // Handle download - method 2: Use server endpoint (fallback)
    downloadMetricsViaServer() {
        console.log("Trying server download method");
        
        // Send data to server for download
        fetch('/download-metrics', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(this.metricsData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}`);
            }
            return response.blob();
        })
        .then(blob => {
            // Generate filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `vibration_simulation_metrics_${timestamp}.json`;
            
            // Create download link
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            
            // Clean up
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 100);
            
            console.log(`Metrics downloaded via server as ${filename}`);
        })
        .catch(error => {
            console.error("Error in server download:", error);
            alert("Failed to download metrics. Please try again or contact support.");
        });
    }
    
    // Get the current metrics data
    getMetricsData() {
        return this.metricsData;
    }
}

// Create global instance
window.metricsDownloader = new MetricsDownloader();