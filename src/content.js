// Content Script for PageNote Chrome Extension
// Handles SPA route change detection and communicates with service worker

(function() {
  'use strict';
  
  let currentUrl = window.location.href;
  let debounceTimer = null;
  const DEBOUNCE_DELAY = 300; // 300ms debounce for route changes
  let lastToastUrl = '';
  let lastToastAt = 0;

  function showNoteToast(message, url) {
    const now = Date.now();
    if (url && url === lastToastUrl && now - lastToastAt < 30000) {
      return;
    }

    const existing = document.getElementById('pagenote-toast');
    if (existing) {
      existing.remove();
    }

    lastToastUrl = url || window.location.href;
    lastToastAt = now;

    const toast = document.createElement('div');
    toast.id = 'pagenote-toast';
    toast.innerHTML = `
      <div class="pagenote-toast-body">
        <div class="pagenote-toast-text">${message}</div>
        <div class="pagenote-toast-actions">
          <button type="button" class="pagenote-toast-dismiss" aria-label="Dismiss">×</button>
        </div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #pagenote-toast {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483647;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
        color: #111827;
      }
      #pagenote-toast .pagenote-toast-body {
        background: #fff7ed;
        border: 1px solid #fdba74;
        box-shadow: 0 10px 24px rgba(0,0,0,0.15);
        border-radius: 12px;
        padding: 12px 12px 10px 12px;
        width: 280px;
      }
      #pagenote-toast .pagenote-toast-text {
        font-size: 13px;
        line-height: 1.35;
        margin-bottom: 10px;
      }
      #pagenote-toast .pagenote-toast-actions {
        display: flex;
        justify-content: flex-end;
      }
      #pagenote-toast .pagenote-toast-dismiss {
        background: transparent;
        border: none;
        font-size: 16px;
        line-height: 1;
        color: #9a3412;
        cursor: pointer;
      }
      #pagenote-toast .pagenote-toast-dismiss:hover {
        color: #7c2d12;
      }
    `;

    toast.querySelector('.pagenote-toast-dismiss').addEventListener('click', () => {
      toast.remove();
      style.remove();
    });

    document.documentElement.appendChild(style);
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
      if (style.parentNode) {
        style.remove();
      }
    }, 2800);
  }
  
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
      console.log('PageNote: Extension context is invalid, please reload the page');
    }
  }, 100);
  
  console.log('PageNote content script loaded');

  chrome.runtime.onMessage.addListener((request) => {
    if (request && request.action === 'showNoteToast') {
      showNoteToast(request.text || 'You have a saved note for this page. Check it in the side panel.', request.url);
    }
  });
})(); 
