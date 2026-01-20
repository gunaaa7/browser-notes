// Dashboard JavaScript for PageNote extension
// Renders all notes and handles export

(function() {
  'use strict';
  
  const notesList = document.getElementById('notesList');
  const emptyState = document.getElementById('emptyState');
  const noteCount = document.getElementById('noteCount');
  const exportBtn = document.getElementById('exportBtn');
  const searchInput = document.getElementById('searchInput');
  const editModal = document.getElementById('editModal');
  const editTitle = document.getElementById('editTitle');
  const editContent = document.getElementById('editContent');
  const editUrl = document.getElementById('editUrl');
  const cancelEdit = document.getElementById('cancelEdit');
  const saveEdit = document.getElementById('saveEdit');
  const viewModal = document.getElementById('viewModal');
  const viewTitle = document.getElementById('viewTitle');
  const viewContent = document.getElementById('viewContent');
  const viewUrl = document.getElementById('viewUrl');
  const closeView = document.getElementById('closeView');

  let notesById = new Map();
  let activeEditId = null;
  let allNotes = [];
  
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
      
      allNotes = notes;
      applyFilter();
    } catch (error) {
      console.error('Error loading notes:', error);
      emptyState.textContent = 'Failed to load notes. Please try again.';
      emptyState.classList.remove('hidden');
    }
  }
  
  function renderNotes(notes, totalCount, query) {
    notesList.innerHTML = '';
    notesById = new Map(notes.map((note) => [note.id, note]));
    const countLabel = `${notes.length} note${notes.length === 1 ? '' : 's'}`;
    noteCount.textContent = totalCount !== null && totalCount !== undefined && totalCount !== notes.length
      ? `${countLabel} (of ${totalCount})`
      : countLabel;
    
    if (notes.length === 0) {
      const hasQuery = Boolean(query && query.trim());
      emptyState.textContent = hasQuery
        ? `No results for "${query.trim()}".`
        : 'No notes yet. Add a note from the side panel to see it here.';
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

      const contentLabel = document.createElement('div');
      contentLabel.className = 'note-content-label';
      contentLabel.textContent = 'Note';

      const actions = document.createElement('div');
      actions.className = 'note-actions';

      const viewButton = document.createElement('button');
      viewButton.className = 'btn small view-note';
      viewButton.dataset.noteId = note.id;
      viewButton.textContent = 'View';

      const editButton = document.createElement('button');
      editButton.className = 'btn small edit-note';
      editButton.dataset.noteId = note.id;
      editButton.textContent = 'Edit';

      const deleteButton = document.createElement('button');
      deleteButton.className = 'btn small danger delete-note';
      deleteButton.dataset.noteId = note.id;
      deleteButton.textContent = 'Delete';

      actions.appendChild(viewButton);
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
        linkEl.title = link;
        card.appendChild(linkEl);
      }
      
      card.appendChild(contentLabel);
      card.appendChild(content);
      card.appendChild(actions);
      notesList.appendChild(card);
    });
  }

  function applyFilter() {
    const query = searchInput ? searchInput.value.trim() : '';
    if (!query) {
      renderNotes(allNotes, allNotes.length, '');
      return;
    }

    const needle = query.toLowerCase();
    const filtered = allNotes.filter((note) => {
      const title = (note.title || '').toLowerCase();
      const content = (note.content || '').toLowerCase();
      const id = (note.id || '').toLowerCase();
      const aliases = Array.isArray(note.aliases)
        ? note.aliases.join(' ').toLowerCase()
        : '';
      return (
        title.includes(needle) ||
        content.includes(needle) ||
        id.includes(needle) ||
        aliases.includes(needle)
      );
    });

    renderNotes(filtered, allNotes.length, query);
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

  function openViewModal(noteId) {
    const note = notesById.get(noteId);
    if (!note) return;

    viewTitle.textContent = note.title || 'Untitled';
    viewContent.textContent = note.content || '';

    const link = getNoteLink(note);
    viewUrl.textContent = link ? `URL: ${link}` : `ID: ${note.id}`;

    viewModal.classList.remove('hidden');
  }

  function closeViewModal() {
    viewModal.classList.add('hidden');
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

    if (target.classList.contains('view-note')) {
      const noteId = target.dataset.noteId;
      if (noteId) openViewModal(noteId);
    }

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

  viewModal.addEventListener('click', (event) => {
    if (event.target === viewModal) {
      closeViewModal();
    }
  });

  exportBtn.addEventListener('click', exportNotes);
  cancelEdit.addEventListener('click', closeEditModal);
  saveEdit.addEventListener('click', saveEditNote);
  closeView.addEventListener('click', closeViewModal);
  if (searchInput) {
    searchInput.addEventListener('input', applyFilter);
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNotes);
  } else {
    loadNotes();
  }
})();
