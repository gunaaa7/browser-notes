// Dashboard JavaScript for sideNote extension
// Renders all notes and handles export

(function() {
  'use strict';
  
  const notesList = document.getElementById('notesList');
  const emptyState = document.getElementById('emptyState');
  const noteCount = document.getElementById('noteCount');
  const exportBtn = document.getElementById('exportBtn');
  
  async function loadNotes() {
    try {
      const data = await chrome.storage.local.get(null);
      const notes = Object.values(data).filter((item) => {
        return item && typeof item === 'object' && item.id;
      });
      
      notes.sort((a, b) => {
        const aTime = new Date(a.updated || a.created || 0).getTime();
        const bTime = new Date(b.updated || b.created || 0).getTime();
        return bTime - aTime;
      });
      
      renderNotes(notes);
    } catch (error) {
      console.error('Error loading notes:', error);
      emptyState.textContent = 'Failed to load notes. Please try again.';
      emptyState.classList.remove('hidden');
    }
  }
  
  function renderNotes(notes) {
    notesList.innerHTML = '';
    noteCount.textContent = `${notes.length} note${notes.length === 1 ? '' : 's'}`;
    
    if (notes.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }
    
    emptyState.classList.add('hidden');
    
    notes.forEach((note) => {
      const card = document.createElement('div');
      card.className = 'note-card';
      
      const header = document.createElement('div');
      header.className = 'note-header';
      
      const title = document.createElement('div');
      title.className = 'note-title';
      title.textContent = note.title || note.id || 'Untitled';
      
      const meta = document.createElement('div');
      meta.className = 'note-meta';
      meta.textContent = buildMetaText(note);
      
      header.appendChild(title);
      header.appendChild(meta);
      
      const content = document.createElement('div');
      content.className = 'note-content';
      content.textContent = note.content || '';
      
      card.appendChild(header);
      
      const link = getNoteLink(note);
      if (link) {
        const linkEl = document.createElement('a');
        linkEl.className = 'note-link';
        linkEl.href = link;
        linkEl.target = '_blank';
        linkEl.rel = 'noreferrer';
        linkEl.textContent = link;
        card.appendChild(linkEl);
      }
      
      card.appendChild(content);
      notesList.appendChild(card);
    });
  }
  
  function buildMetaText(note) {
    const created = note.created ? new Date(note.created) : null;
    const updated = note.updated ? new Date(note.updated) : null;
    
    if (created && updated && note.created !== note.updated) {
      return `Updated ${formatRelative(updated)} • Created ${formatRelative(created)}`;
    }
    
    if (created) {
      return `Created ${formatRelative(created)}`;
    }
    
    return 'Saved recently';
  }
  
  function formatRelative(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  }
  
  function getNoteLink(note) {
    if (note.id && (note.id.startsWith('http://') || note.id.startsWith('https://'))) {
      return note.id;
    }
    
    if (Array.isArray(note.aliases)) {
      const alias = note.aliases.find((entry) => {
        return entry && (entry.startsWith('http://') || entry.startsWith('https://'));
      });
      if (alias) return alias;
    }
    
    return null;
  }
  
  async function exportNotes() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'exportNotes'
      });
      
      if (response.success && response.data) {
        const blob = new Blob([response.data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sideNote-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        throw new Error(response.error || 'Failed to export notes');
      }
    } catch (error) {
      console.error('Error exporting notes:', error);
      alert('Failed to export notes. Please try again.');
    }
  }
  
  exportBtn.addEventListener('click', exportNotes);
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNotes);
  } else {
    loadNotes();
  }
})();
