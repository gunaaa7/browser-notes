// Content Script for sideNote Chrome Extension
// Handles SPA route change detection and communicates with service worker

(function() {
  'use strict';
  
  let currentUrl = window.location.href;
  let debounceTimer = null;
  const DEBOUNCE_DELAY = 300; // 300ms debounce for route changes
  
  // Debounced function to notify service worker of URL change
  function notifyUrlChange() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    debounceTimer = setTimeout(() => {
      const newUrl = window.location.href;
      if (newUrl !== currentUrl) {
        currentUrl = newUrl;
        
        // Notify service worker about URL change
        chrome.runtime.sendMessage({
          action: 'urlChanged',
          url: currentUrl
        }).catch(error => {
          console.error('Error notifying service worker of URL change:', error);
        });
      }
    }, DEBOUNCE_DELAY);
  }
  
  // Listen for popstate events (back/forward button)
  window.addEventListener('popstate', notifyUrlChange);
  
  // Listen for pushstate/replacestate (programmatic navigation)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    notifyUrlChange();
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    notifyUrlChange();
  };
  
  // Observer for DOM changes that might indicate route changes
  const observer = new MutationObserver((mutations) => {
    let urlChanged = false;
    
    mutations.forEach((mutation) => {
      // Check if the title changed (common in SPAs)
      if (mutation.type === 'childList' && mutation.target.tagName === 'TITLE') {
        urlChanged = true;
      }
      
      // Check if significant DOM changes occurred
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check for route-related attributes or classes
            const routeIndicators = ['route', 'page', 'view', 'component'];
            const element = node;
            
            if (element.className && typeof element.className === 'string') {
              const hasRouteIndicator = routeIndicators.some(indicator => 
                element.className.toLowerCase().includes(indicator)
              );
              
              if (hasRouteIndicator) {
                urlChanged = true;
              }
            }
          }
        });
      }
    });
    
    if (urlChanged) {
      notifyUrlChange();
    }
  });
  
  // Start observing DOM changes
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  
  // Listen for hashchange events
  window.addEventListener('hashchange', notifyUrlChange);
  
  // Check for URL changes periodically as a fallback
  setInterval(() => {
    if (window.location.href !== currentUrl) {
      notifyUrlChange();
    }
  }, 1000); // Check every second
  
  // Check if extension context is valid
  function isExtensionContextValid() {
    try {
      return chrome.runtime && chrome.runtime.id;
    } catch (error) {
      return false;
    }
  }
  
  // Initialize with a small delay to ensure everything is ready
  setTimeout(() => {
    if (isExtensionContextValid()) {
      // Initial URL notification
      notifyUrlChange();
    } else {
      console.log('sideNote: Extension context is invalid, please reload the page');
    }
  }, 100);
  
  console.log('sideNote content script loaded');
})(); 
