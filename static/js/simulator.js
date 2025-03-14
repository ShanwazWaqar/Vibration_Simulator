/**
 * JavaScript for the Simulator page
 */

// Update display value when sliders change
function updateValue(id, isFloat = false) {
    const input = document.getElementById(id);
    const display = document.getElementById(id + '-value');
    if (isFloat) {
      display.textContent = parseFloat(input.value).toFixed(1);
    } else {
      display.textContent = input.value;
    }
  }
  
  // Reset form to default values
  function resetForm() {
    document.getElementById('SC').value = 800;
    document.getElementById('BF').value = 300;
    document.getElementById('AmpX').value = 0.2;
    document.getElementById('AmpY').value = 1.0;
    document.getElementById('AmpZ').value = 0.2;
    document.getElementById('freqX').value = 1.0;
    document.getElementById('freqY').value = 2.0;
    document.getElementById('freqZ').value = 1.0;
    document.getElementById('sphereCount').value = 0;
    document.getElementById('rectangleCount').value = 0;
    document.getElementById('quartersphereCount').value = 0;
    
    // Update all displays
    updateValue('SC');
    updateValue('BF');
    updateValue('AmpX', true);
    updateValue('AmpY', true);
    updateValue('AmpZ', true);
    updateValue('freqX', true);
    updateValue('freqY', true);
    updateValue('freqZ', true);
  }
  
  // Animation for examples when they come into viewport
  document.addEventListener('DOMContentLoaded', function() {
    // Function to check if an element is in viewport
    function isInViewport(element) {
      const rect = element.getBoundingClientRect();
      return (
        rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.bottom >= 0
      );
    }
  
    // Elements to animate
    const animatedElements = document.querySelectorAll('.example-box, .parameter-box');
    
    // Initial check for elements already in viewport on load
    animatedElements.forEach(function(element, index) {
      if (isInViewport(element)) {
        // Add delayed animations with staggered timing
        setTimeout(() => {
          element.classList.add('fade-in');
        }, index * 100);
      }
    });
    
    // Check for elements when scrolling
    window.addEventListener('scroll', function() {
      animatedElements.forEach(function(element, index) {
        if (isInViewport(element) && !element.classList.contains('fade-in')) {
          setTimeout(() => {
            element.classList.add('fade-in');
          }, index * 50);
        }
      });
    });
  
    // Initialize all slider displays on page load
    updateValue('SC');
    updateValue('BF');
    updateValue('AmpX', true);
    updateValue('AmpY', true);
    updateValue('AmpZ', true);
    updateValue('freqX', true);
    updateValue('freqY', true);
    updateValue('freqZ', true);
    
    // Handle form submission
    document.getElementById('paramForm').addEventListener('submit', function(event) {
      event.preventDefault();
      
      let formData = {
        SC: document.getElementById('SC').value,
        BF: document.getElementById('BF').value,
        AmpX: document.getElementById('AmpX').value,
        AmpY: document.getElementById('AmpY').value,
        AmpZ: document.getElementById('AmpZ').value,
        freqX: document.getElementById('freqX').value,
        freqY: document.getElementById('freqY').value,
        freqZ: document.getElementById('freqZ').value,
        sphereCount: document.getElementById('sphereCount').value,
        rectangleCount: document.getElementById('rectangleCount').value,
        quartersphereCount: document.getElementById('quartersphereCount').value,
        airfoilCount: document.getElementById('airfoilCount') ? document.getElementById('airfoilCount').value : "0",
        halfsphereCount: document.getElementById('halfsphereCount') ? document.getElementById('halfsphereCount').value : "0",
        pyramidCount: document.getElementById('pyramidCount') ? document.getElementById('pyramidCount').value : "0"
      };
      
      let backendURL;
      if (window.location.protocol === "https:") {
        backendURL = "https://" + window.location.hostname.replace("www.", "") + "/";
      } else {
        backendURL = "http://" + window.location.hostname.replace("www.", "") + "/";
      }
      
      if (window.location.hostname.includes("localhost")) {
        backendURL = "http://localhost:5000";
      }
      
      console.log("Using Backend URL:", backendURL);
      
      fetch(`${backendURL}/set-data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify(formData)
      })
      .then(response => response.json())
      .then(data => {
        window.location.href = data.redirect_url;
      })
      .catch(error => console.error("Error:", error));
    });
  });