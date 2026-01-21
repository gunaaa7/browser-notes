// Service Worker for PageNote Chrome Extension
// Handles storage, badge updates, URL canonicalization, and side panel management

const sidePanelState = new Map();

function disableSidePanelForTab(tabId, context) {
  if (!tabId) return;
  chrome.sidePanel.setOptions({ tabId, enabled: false }, () => {
    if (chrome.runtime.lastError) {
      console.error(`Error disabling side panel ${context}:`, chrome.runtime.lastError.message);
    }
  });
}

const DEFAULT_ICON_PATHS = {
  16: 'icons/icon16.png',
  32: 'icons/icon32.png',
  48: 'icons/icon48.png',
  64: 'icons/icon64.png',
  128: 'icons/icon128.png'
};

const NOTE_ICON_PATHS = {
  16: 'icons/icon16-dot.png',
  32: 'icons/icon32-dot.png',
  48: 'icons/icon48-dot.png',
  64: 'icons/icon64-dot.png',
  128: 'icons/icon128-dot.png'
};

// URL Canonicalization Logic
function canonicalizeUrl(url) {
  try {
    if (!url || typeof url !== 'string') {
      return null;
    }
    let canonicalUrl = new URL(url);
    
    // YouTube special handling
    if (canonicalUrl.hostname === 'www.youtube.com' || canonicalUrl.hostname === 'youtube.com') {
      const videoId = canonicalUrl.searchParams.get('v');
      if (videoId) {
        return `youtube:${videoId}`;
      }
    }
    
    // Force HTTPS
    canonicalUrl.protocol = 'https:';
    
    // Lowercase hostname
    canonicalUrl.hostname = canonicalUrl.hostname.toLowerCase();
    
    // Strip tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
    trackingParams.forEach(param => canonicalUrl.searchParams.delete(param));
    
    // Remove trailing slash and /index.html
    let pathname = canonicalUrl.pathname;
    if (pathname.endsWith('/index.html')) {
      pathname = pathname.slice(0, -11);
    }
    if (pathname.endsWith('/') && pathname !== '/') {
      pathname = pathname.slice(0, -1);
    }
    canonicalUrl.pathname = pathname;
    
    // Clear fragment (hash)
    canonicalUrl.hash = '';
    
    return canonicalUrl.toString();
  } catch (error) {
    console.error('Error canonicalizing URL:', error);
    return null;
  }
}

// Storage Management
async function getNote(canonicalUrl) {
  try {
    if (!canonicalUrl || typeof canonicalUrl !== 'string') {
      return null;
    }
    const result = await chrome.storage.local.get([canonicalUrl]);
    return result[canonicalUrl] || null;
  } catch (error) {
    console.error('Error getting note:', error);
    return null;
  }
}

async function saveNote(canonicalUrl, originalUrl, noteData) {
  try {
    if (!canonicalUrl || typeof canonicalUrl !== 'string') {
      return null;
    }
    const existingNote = await getNote(canonicalUrl);
    const now = new Date().toISOString();
    
    const note = {
      id: canonicalUrl,
      title: noteData.title || extractTitle(originalUrl),
      created: existingNote ? existingNote.created : now,
      updated: now,
      content: noteData.content || '',
      aliases: existingNote ? existingNote.aliases : []
    };
    
    // Add original URL to aliases if different from canonical
    if (originalUrl !== canonicalUrl && !note.aliases.includes(originalUrl)) {
      note.aliases.push(originalUrl);
    }
    
    await chrome.storage.local.set({ [canonicalUrl]: note });
    return note;
  } catch (error) {
    console.error('Error saving note:', error);
    return null;
  }
}

async function deleteNote(canonicalUrl) {
  try {
    if (!canonicalUrl || typeof canonicalUrl !== 'string') {
      return;
    }
    await chrome.storage.local.remove([canonicalUrl]);
  } catch (error) {
    console.error('Error deleting note:', error);
  }
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

// Badge Management
async function updateBadge(tabId, url) {
  if (!url) return;
  
  const canonicalUrl = canonicalizeUrl(url);
  if (!canonicalUrl) return;
  const note = await getNote(canonicalUrl);
  
  if (note && note.content.trim()) {
    await chrome.action.setBadgeText({ tabId, text: '' });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: 'rgba(0, 0, 0, 0)' });
    await chrome.action.setIcon({ tabId, path: NOTE_ICON_PATHS });
  } else {
    await chrome.action.setBadgeText({ tabId, text: '' });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: 'rgba(0, 0, 0, 0)' });
    await chrome.action.setIcon({ tabId, path: DEFAULT_ICON_PATHS });
  }
}

async function syncSidePanelForTab(tabId, url, isActive) {
  if (!tabId) return;
  if (!url) {
    disableSidePanelForTab(tabId, 'missing url');
    sidePanelState.set(tabId, false);
    return;
  }

  const canonicalUrl = canonicalizeUrl(url);
  if (!canonicalUrl) {
    disableSidePanelForTab(tabId, 'invalid url');
    sidePanelState.set(tabId, false);
    return;
  }
  const note = await getNote(canonicalUrl);
  const hasNote = note && note.content && note.content.trim();

  const isOpen = sidePanelState.get(tabId) === true;

  if (isOpen) {
    chrome.sidePanel.setOptions(
      { tabId, enabled: true, path: 'sidepanel.html' },
      () => {
        if (chrome.runtime.lastError) {
          console.error('Error enabling side panel:', chrome.runtime.lastError.message);
        }
      }
    );
  } else {
    disableSidePanelForTab(tabId, 'panel closed for tab');
    sidePanelState.set(tabId, false);
  }

  if (hasNote && isActive && !isOpen) {
    chrome.tabs.sendMessage(
      tabId,
      {
        action: 'showNoteToast',
        url,
        text: 'You have a saved note for this page. Check it in the side panel.'
      },
      () => {
        if (chrome.runtime.lastError) {
          console.warn('Toast message failed:', chrome.runtime.lastError.message);
        }
      }
    );
  }
}

// Storage Quota Check
async function checkStorageQuota() {
  try {
    const data = await chrome.storage.local.get(null);
    const usage = JSON.stringify(data).length;
    const quota = 5 * 1024 * 1024; // 5MB
    
    return {
      usage,
      quota,
      percentage: (usage / quota) * 100,
      nearLimit: (usage / quota) > 0.9
    };
  } catch (error) {
    console.error('Error checking storage quota:', error);
    return { usage: 0, quota: 0, percentage: 0, nearLimit: false };
  }
}

// Export notes as JSON
async function exportNotes() {
  try {
    const data = await chrome.storage.local.get(null);
    const notes = {};
    
    // Filter out non-note data
    Object.keys(data).forEach(key => {
      if (data[key] && typeof data[key] === 'object' && data[key].id) {
        notes[key] = data[key];
      }
    });
    
    return JSON.stringify(notes, null, 2);
  } catch (error) {
    console.error('Error exporting notes:', error);
    return null;
  }
}

// Event Listeners
chrome.runtime.onInstalled.addListener(() => {
  console.log('PageNote extension installed');
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error setting side panel behavior:', chrome.runtime.lastError.message);
    }
  });
  chrome.sidePanel.setOptions({ enabled: false }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error disabling global side panel:', chrome.runtime.lastError.message);
    }
  });
  chrome.tabs.query({}, (tabs) => {
    if (!tabs || !tabs.length) return;
    tabs.forEach((tab) => {
      if (!tab.id) return;
      disableSidePanelForTab(tab.id, 'on install');
      sidePanelState.set(tab.id, false);
    });
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error setting side panel behavior:', chrome.runtime.lastError.message);
    }
  });
  chrome.sidePanel.setOptions({ enabled: false }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error disabling global side panel:', chrome.runtime.lastError.message);
    }
  });
  chrome.tabs.query({}, (tabs) => {
    if (!tabs || !tabs.length) return;
    tabs.forEach((tab) => {
      if (!tab.id) return;
      disableSidePanelForTab(tab.id, 'on startup');
      sidePanelState.set(tab.id, false);
    });
  });
});

// Handle tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError) {
      console.warn('Error getting active tab:', chrome.runtime.lastError.message);
    }
    if (tab && tab.url) {
      updateBadge(activeInfo.tabId, tab.url).catch((error) => {
        console.error('Error updating badge on activation:', error);
      });
    }
    syncSidePanelForTab(activeInfo.tabId, tab && tab.url, true).catch((error) => {
      console.error('Error syncing side panel on activation:', error);
    });
  });
});

// Ensure new tabs start with the side panel closed
chrome.tabs.onCreated.addListener((tab) => {
  if (!tab || !tab.id) return;
  disableSidePanelForTab(tab.id, 'on tab create');
  sidePanelState.set(tab.id, false);
});

// Clean up state when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  sidePanelState.delete(tabId);
});

// Handle tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    if (tab.url) {
      await updateBadge(tabId, tab.url);
    }
    await syncSidePanelForTab(tabId, tab.url, tab.active);
  }
});

// Handle keyboard command to toggle side panel
chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-sidepanel') return;
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (tab && tab.id) {
      toggleSidePanel(tab.id);
    }
  });
});

// Handle toolbar button click
chrome.action.onClicked.addListener((tab) => {
  try {
    if (!tab || !tab.id) {
      return;
    }
    
    const isOpen = sidePanelState.get(tab.id) === true;
    
    if (isOpen) {
      disableSidePanelForTab(tab.id, 'from action click');
      sidePanelState.set(tab.id, false);
      return;
    }
    
    chrome.sidePanel.setOptions(
      { tabId: tab.id, enabled: true, path: 'sidepanel.html' },
      () => {
        if (chrome.runtime.lastError) {
          console.error('Error enabling side panel:', chrome.runtime.lastError.message);
          return;
        }
        chrome.sidePanel.open({ tabId: tab.id }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error opening side panel:', chrome.runtime.lastError.message);
            return;
          }
          sidePanelState.set(tab.id, true);
        });
      }
    );
  } catch (error) {
    console.error('Error opening side panel:', error);
  }
});

// Handle side panel toggle requests
async function toggleSidePanel(tabId) {
  if (!tabId) return;
  
  try {
    chrome.tabs.get(tabId, (tab) => {
      if (!tab) {
        return;
      }
      
      const isOpen = sidePanelState.get(tabId) === true;
      
      if (isOpen) {
        disableSidePanelForTab(tabId, 'from command');
        sidePanelState.set(tabId, false);
        return;
      }
      
      chrome.sidePanel.setOptions(
        { tabId, enabled: true, path: 'sidepanel.html' },
        () => {
          if (chrome.runtime.lastError) {
            console.error('Error enabling side panel:', chrome.runtime.lastError.message);
            return;
          }
          chrome.sidePanel.open({ tabId }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error opening side panel:', chrome.runtime.lastError.message);
              return;
            }
            sidePanelState.set(tabId, true);
          });
        }
      );
    });
  } catch (error) {
    console.error('Error toggling side panel:', error);
  }
}



// Handle messages from content script and side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'getNote':
          const canonicalUrl = canonicalizeUrl(request.url);
          const note = await getNote(canonicalUrl);
          sendResponse({ success: true, note, canonicalUrl });
          break;
          
        case 'saveNote':
          const savedNote = await saveNote(
            canonicalizeUrl(request.url),
            request.url,
            request.noteData
          );
          sendResponse({ success: true, note: savedNote });
          
          // Update badge
          if (sender.tab) {
            await updateBadge(sender.tab.id, request.url);
          }
          break;
          
        case 'deleteNote':
          await deleteNote(canonicalizeUrl(request.url));
          sendResponse({ success: true });
          
          // Update badge
          if (sender.tab) {
            await updateBadge(sender.tab.id, request.url);
          }
          break;
          
        case 'checkQuota':
          const quotaInfo = await checkStorageQuota();
          sendResponse({ success: true, quota: quotaInfo });
          break;
          
        case 'exportNotes':
          const exportData = await exportNotes();
          sendResponse({ success: true, data: exportData });
          break;
          
        case 'urlChanged':
          // Handle SPA navigation
          await updateBadge(sender.tab.id, request.url);
          await syncSidePanelForTab(sender.tab.id, request.url, sender.tab?.active);
          sendResponse({ success: true });
          break;

        case 'tabActivated':
          if (!sender.tab || !sender.tab.id) {
            sendResponse({ success: false, error: 'Missing tab info' });
            break;
          }
          if (request.url) {
            await updateBadge(sender.tab.id, request.url);
          }
          await syncSidePanelForTab(sender.tab.id, request.url, true);
          sendResponse({ success: true });
          break;
          
        case 'togglePanel':
          // Handle keyboard shortcut from content script
          await toggleSidePanel(request.tabId || sender.tab?.id);
          sendResponse({ success: true });
          break;
          
        case 'panelClosed':
          if (request.tabId) {
            sidePanelState.set(request.tabId, false);
          }
          sendResponse({ success: true });
          break;
          
        case 'closePanel':
          if (request.tabId) {
            disableSidePanelForTab(request.tabId, 'from closePanel');
            sidePanelState.set(request.tabId, false);
            sendResponse({ success: true });
            return;
          }
          sendResponse({ success: false, error: 'Missing tabId' });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  
  return true; // Keep message channel open for async response
}); 
