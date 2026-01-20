// Side Panel JavaScript for sideNote Chrome Extension
// Handles note loading, auto-save, storage management, and UI interactions

(function() {
  'use strict';
  
  // DOM elements
  const urlInfo = document.getElementById('urlInfo');
  const loadingState = document.getElementById('loadingState');
  const noteContainer = document.getElementById('noteContainer');
  const noteTextarea = document.getElementById('noteTextarea');
  const noteTitle = document.getElementById('noteTitle');
  const noteMeta = document.getElementById('noteMeta');
  const saveStatus = document.getElementById('saveStatus');
  const saveStatusText = document.getElementById('saveStatusText');
  const storageInfo = document.getElementById('storageInfo');
  const viewAllBtn = document.getElementById('viewAllBtn');
  const clearBtn = document.getElementById('clearBtn');
  const closeBtn = document.getElementById('closeBtn');
  const shortcutsLink = document.getElementById('shortcutsLink');
  
  // State
  let currentUrl = '';
  let canonicalUrl = '';
  let currentNote = null;
  let currentPageTitle = '';
  let saveTimer = null;
  let isDirty = false;
  
  const SAVE_DELAY = 400; // 400ms debounce as per requirements
  
  // Initialize the side panel
  async function init() {
    try {
      // Get current tab URL
      await refreshForCurrentTab();
      
      // Set up event listeners
      setupEventListeners();
      
      // Check storage quota
      await updateStorageInfo();
      
    } catch (error) {
      console.error('Error initializing side panel:', error);
      showError('Failed to initialize');
    }
  }
  
  // Refresh panel for current active tab
  async function refreshForCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab.url !== currentUrl) {
        // URL has changed, need to reload
        currentUrl = tab.url;
        currentPageTitle = tab.title || '';
        currentNote = null;
        isDirty = false;
        
        // Clear any pending save
        if (saveTimer) {
          clearTimeout(saveTimer);
          saveTimer = null;
        }
        
        // Update URL info display
        updateUrlInfo(currentUrl);
        
        // Show brief "switching" indicator
        setSaveStatus('loading', 'Switching tabs...');
        
        // Show loading state
        noteContainer.classList.add('hidden');
        loadingState.classList.remove('hidden');
        
        // Load existing note
        await loadNote();
      }
    } catch (error) {
      console.error('Error refreshing for current tab:', error);
    }
  }
  
  // Update URL info display
  function updateUrlInfo(url) {
    try {
      const urlObj = new URL(url);
      const displayUrl = urlObj.hostname + urlObj.pathname;
      urlInfo.textContent = displayUrl;
    } catch (error) {
      urlInfo.textContent = 'Invalid URL';
    }
  }
  
  // Load note for current URL
  async function loadNote() {
    try {
      setSaveStatus('loading', 'Loading...');
      
      const response = await chrome.runtime.sendMessage({
        action: 'getNote',
        url: currentUrl
      });
      
      if (response.success) {
        currentNote = response.note;
        canonicalUrl = response.canonicalUrl;
        
        // Show note container
        loadingState.classList.add('hidden');
        noteContainer.classList.remove('hidden');
        
        // Populate textarea
        if (currentNote) {
          noteTitle.value = currentNote.title || currentPageTitle || extractTitle(currentUrl);
          noteTextarea.value = currentNote.content || '';
          updateNoteMeta(currentNote);
        } else {
          noteTitle.value = currentPageTitle || extractTitle(currentUrl);
          noteTextarea.value = '';
          noteMeta.textContent = '';
        }
        
        setSaveStatus('ready', 'Ready');
        
        // Focus textarea
        noteTextarea.focus();
        
      } else {
        throw new Error(response.error || 'Failed to load note');
      }
      
    } catch (error) {
      console.error('Error loading note:', error);
      setSaveStatus('error', 'Failed to load');
    }
  }
  
  // Update note metadata display
  function updateNoteMeta(note) {
    if (!note) {
      noteMeta.textContent = '';
      return;
    }
    
    const created = new Date(note.created);
    const updated = new Date(note.updated);
    
    if (note.created === note.updated) {
      noteMeta.textContent = `Created: ${formatDate(created)}`;
    } else {
      noteMeta.textContent = `Updated: ${formatDate(updated)} • Created: ${formatDate(created)}`;
    }
  }
  
  // Format date for display
  function formatDate(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  }
  
  // Set save status
  function setSaveStatus(status, text) {
    saveStatus.className = `save-status ${status}`;
    saveStatusText.textContent = text;
  }
  
  // Auto-save note with debouncing
  function autoSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    
    setSaveStatus('saving', 'Saving...');
    
    saveTimer = setTimeout(async () => {
      try {
        const content = noteTextarea.value.trim();
        
        // Skip saving if content is empty and no existing note
        if (!content && !currentNote) {
          setSaveStatus('ready', 'Ready');
          return;
        }
        
        const response = await chrome.runtime.sendMessage({
          action: 'saveNote',
          url: currentUrl,
          noteData: {
            content: content,
            title: (noteTitle.value || '').trim() || currentPageTitle || extractTitle(currentUrl)
          }
        });
        
        if (response.success) {
          currentNote = response.note;
          updateNoteMeta(currentNote);
          setSaveStatus('saved', 'Saved');
          isDirty = false;
          
          // Clear saved status after 2 seconds
          setTimeout(() => {
            if (saveStatusText.textContent === 'Saved') {
              setSaveStatus('ready', 'Ready');
            }
          }, 2000);
          
        } else {
          throw new Error(response.error || 'Failed to save note');
        }
        
      } catch (error) {
        console.error('Error saving note:', error);
        setSaveStatus('error', 'Save failed');
      }
    }, SAVE_DELAY);
  }
  
  // Extract title from URL
  function extractTitle(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + urlObj.pathname;
    } catch (error) {
      return url;
    }
  }
  
  // Clear note
  async function clearNote() {
    if (!currentNote) return;
    
    const confirmed = confirm('Are you sure you want to delete this note? This action cannot be undone.');
    if (!confirmed) return;
    
    try {
      setSaveStatus('saving', 'Deleting...');
      
      const response = await chrome.runtime.sendMessage({
        action: 'deleteNote',
        url: currentUrl
      });
      
      if (response.success) {
        currentNote = null;
        noteTextarea.value = '';
        noteMeta.textContent = '';
        setSaveStatus('ready', 'Ready');
        isDirty = false;
      } else {
        throw new Error(response.error || 'Failed to delete note');
      }
      
    } catch (error) {
      console.error('Error deleting note:', error);
      setSaveStatus('error', 'Delete failed');
    }
  }
  
  // Open dashboard with all notes
  async function openDashboard() {
    try {
      await chrome.tabs.create({
        url: chrome.runtime.getURL('dashboard.html')
      });
    } catch (error) {
      console.error('Error opening dashboard:', error);
      alert('Failed to open dashboard. Please try again.');
    }
  }

  function getShortcutsUrl() {
    const ua = navigator.userAgent;
    if (ua.includes('Edg/')) return 'edge://extensions/shortcuts';
    if (ua.includes('Brave')) return 'brave://extensions/shortcuts';
    if (ua.includes('OPR/')) return 'opera://extensions/shortcuts';
    return 'chrome://extensions/shortcuts';
  }

  async function openShortcutsPage(event) {
    if (event) event.preventDefault();
    const url = getShortcutsUrl();
    try {
      await chrome.tabs.create({ url });
    } catch (error) {
      console.error('Error opening shortcuts page:', error);
      alert('Could not open the shortcuts page in this browser.');
    }
  }
  
  // Close side panel
  async function closeSidePanel() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        chrome.runtime.sendMessage({ action: 'closePanel', tabId: tab.id }).catch(() => {});
      }
      
      // Save any pending changes first
      if (isDirty && saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
        // Force immediate save
        const content = noteTextarea.value.trim();
        if (content || currentNote) {
          setSaveStatus('saving', 'Saving...');
          await chrome.runtime.sendMessage({
            action: 'saveNote',
            url: currentUrl,
            noteData: {
              content: content,
              title: (noteTitle.value || '').trim() || currentPageTitle || extractTitle(currentUrl)
            }
          });
        }
      }
      
      // Try to close the window
      try {
        window.close();
      } catch (error) {
        console.log('window.close() failed:', error);
        
        // Show instruction to user
        const notification = document.createElement('div');
        notification.innerHTML = `
          <div style="
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #f59e0b;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          ">
            📌 Use the side panel close button in the Chrome toolbar
          </div>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 4000);
      }
      
    } catch (error) {
      console.error('Error closing side panel:', error);
    }
  }
  
  // Update storage info
  async function updateStorageInfo() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'checkQuota'
      });
      
      if (response.success) {
        const { usage, quota, percentage, nearLimit } = response.quota;
        const usageKB = Math.round(usage / 1024);
        const quotaKB = Math.round(quota / 1024);
        
        let statusText = `Storage: ${usageKB}KB / ${quotaKB}KB`;
        let statusClass = '';
        
        if (percentage > 90) {
          statusClass = 'storage-critical';
          statusText += ' (Critical)';
        } else if (percentage > 70) {
          statusClass = 'storage-warning';
          statusText += ' (Warning)';
        }
        
        storageInfo.textContent = statusText;
        storageInfo.className = statusClass;
        
        // Show warning if near limit
        if (nearLimit && percentage > 95) {
          alert('Storage is almost full! Please export and delete some notes to free up space.');
        }
        
      }
    } catch (error) {
      console.error('Error checking storage quota:', error);
      storageInfo.textContent = 'Storage: Unknown';
    }
  }
  
  // Set up event listeners
  function setupEventListeners() {
    // Textarea input
    noteTextarea.addEventListener('input', () => {
      isDirty = true;
      autoSave();
    });

    noteTitle.addEventListener('input', () => {
      isDirty = true;
      autoSave();
    });
    
    // Textarea focus
    noteTextarea.addEventListener('focus', () => {
      noteTextarea.select();
    });
    
    // Clear button
    clearBtn.addEventListener('click', clearNote);
    
    // View all notes button
    viewAllBtn.addEventListener('click', openDashboard);
    
    // Close button
    closeBtn.addEventListener('click', closeSidePanel);

    // Shortcuts link
    shortcutsLink.addEventListener('click', openShortcutsPage);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Alt+S to close side panel
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        closeSidePanel();
        return;
      }

      // Ctrl/Cmd + S to save immediately
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (saveTimer) {
          clearTimeout(saveTimer);
          saveTimer = null;
        }
        autoSave();
      }
    });

    // Handle window unload
    window.addEventListener('beforeunload', () => {
      if (isDirty && saveTimer) {
        clearTimeout(saveTimer);
        // Force immediate save on close
        chrome.runtime.sendMessage({
          action: 'saveNote',
          url: currentUrl,
          noteData: {
            content: noteTextarea.value.trim(),
            title: (noteTitle.value || '').trim() || currentPageTitle || extractTitle(currentUrl)
          }
        });
      }

      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (tab && tab.id) {
          chrome.runtime.sendMessage({ action: 'panelClosed', tabId: tab.id });
        }
      }).catch(() => {});
    });
    
    // Listen for tab activation changes
    chrome.tabs.onActivated.addListener(async () => {
      await refreshForCurrentTab();
    });
    
    // Listen for tab updates (URL changes)
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab.id === tabId) {
          await refreshForCurrentTab();
        }
      }
    });
    
    // Listen for window focus events
    window.addEventListener('focus', async () => {
      await refreshForCurrentTab();
    });
    
    // Check for tab changes periodically (fallback)
    setInterval(refreshForCurrentTab, 2000); // Every 2 seconds
    
    // Update storage info periodically
    setInterval(updateStorageInfo, 30000); // Every 30 seconds
  }
  
  // Show error message
  function showError(message) {
    loadingState.innerHTML = `<div style="color: #dc2626;">Error: ${message}</div>`;
  }
  

  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  console.log('sideNote panel script loaded');
})(); 
