// Dashboard JavaScript for PageNote extension
// Renders all notes and handles export

(function() {
  'use strict';
  
  const notesList = document.getElementById('notesList');
  const emptyState = document.getElementById('emptyState');
  const noteCount = document.getElementById('noteCount');
  const exportBtn = document.getElementById('exportBtn');
  const editModal = document.getElementById('editModal');
  const editTitle = document.getElementById('editTitle');
  const editContent = document.getElementById('editContent');
  const editUrl = document.getElementById('editUrl');
  const cancelEdit = document.getElementById('cancelEdit');
  const saveEdit = document.getElementById('saveEdit');

  let notesById = new Map();
  let activeEditId = null;
  
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
    notesById = new Map(notes.map((note) => [note.id, note]));
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

      const actions = document.createElement('div');
      actions.className = 'note-actions';

      const editButton = document.createElement('button');
      editButton.className = 'btn small edit-note';
      editButton.dataset.noteId = note.id;
      editButton.textContent = 'Edit';

      const deleteButton = document.createElement('button');
      deleteButton.className = 'btn small danger delete-note';
      deleteButton.dataset.noteId = note.id;
      deleteButton.textContent = 'Delete';

      actions.appendChild(editButton);
      actions.appendChild(deleteButton);

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
      card.appendChild(actions);
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
        a.download = `PageNote-export-${new Date().toISOString().split('T')[0]}.json`;
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

  function openEditModal(noteId) {
    const note = notesById.get(noteId);
    if (!note) return;

    activeEditId = noteId;
    editTitle.value = note.title || '';
    editContent.value = note.content || '';

    const link = getNoteLink(note);
    editUrl.textContent = link ? `URL: ${link}` : `ID: ${note.id}`;

    editModal.classList.remove('hidden');
    editTitle.focus();
  }

  function closeEditModal() {
    activeEditId = null;
    editModal.classList.add('hidden');
  }

  async function saveEditNote() {
    if (!activeEditId) return;

    try {
      const existing = await chrome.storage.local.get([activeEditId]);
      const note = existing[activeEditId];
      if (!note) {
        closeEditModal();
        await loadNotes();
        return;
      }

      const now = new Date().toISOString();
      const nextNote = {
        ...note,
        title: editTitle.value.trim() || note.title || note.id,
        content: editContent.value,
        updated: now
      };

      await chrome.storage.local.set({ [activeEditId]: nextNote });
      closeEditModal();
      await loadNotes();
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note. Please try again.');
    }
  }

  async function deleteNote(noteId) {
    const note = notesById.get(noteId);
    if (!noteId || !note) return;

    const confirmed = confirm('Delete this note? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await chrome.storage.local.remove([noteId]);
      if (activeEditId === noteId) {
        closeEditModal();
      }
      await loadNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note. Please try again.');
    }
  }

  notesList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.classList.contains('edit-note')) {
      const noteId = target.dataset.noteId;
      if (noteId) openEditModal(noteId);
    }

    if (target.classList.contains('delete-note')) {
      const noteId = target.dataset.noteId;
      if (noteId) deleteNote(noteId);
    }
  });

  editModal.addEventListener('click', (event) => {
    if (event.target === editModal) {
      closeEditModal();
    }
  });

  exportBtn.addEventListener('click', exportNotes);
  cancelEdit.addEventListener('click', closeEditModal);
  saveEdit.addEventListener('click', saveEditNote);
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNotes);
  } else {
    loadNotes();
  }
})();
