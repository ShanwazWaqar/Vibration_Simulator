/**
 * JavaScript for the Self-Organization page
 */

// Function to open video URLs in a new tab
function openVideoUrl(url) {
    window.open(url, '_blank');
  }
  
  // Add animation classes when elements come into view
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
    const animatedElements = document.querySelectorAll('.application-box, .video-card, .image-container');
    
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
  });