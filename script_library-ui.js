// ─────────────────────────────────────────────────────────────
// SHARED MEDIA LIBRARY
// ─────────────────────────────────────────────────────────────

const activeLibraryAudios = {};
const batchSelectedAssetIds = new Set();
const batchDownloadSelectedAssetIds = new Set();
let activeOpenDropdownMenu = null;

function setupDropdownMenu(buttonId, menuId) {
  const btn = document.getElementById(buttonId);
  const menu = document.getElementById(menuId);
  if (!btn || !menu) return;

  function openMenu() {
    if (activeOpenDropdownMenu && activeOpenDropdownMenu !== menu) {
      activeOpenDropdownMenu.hidden = true;
      const otherBtn = document.querySelector(`[aria-controls="${activeOpenDropdownMenu.id}"]`);
      if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
    }

    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    activeOpenDropdownMenu = menu;

    const items = getMenuItems(menu);
    if (items.length > 0) {
      items[0].focus();
    }
  }

  function closeMenu(focusBtn = true) {
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (activeOpenDropdownMenu === menu) activeOpenDropdownMenu = null;
    if (focusBtn) btn.focus();
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.hidden) openMenu();
    else closeMenu(false);
  });

  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openMenu();
      const items = getMenuItems(menu);
      if (e.key === 'ArrowUp' && items.length > 0) {
        items[items.length - 1].focus();
      }
    }
  });

  menu.addEventListener('keydown', (e) => {
    const items = getMenuItems(menu);
    const currentIndex = items.indexOf(document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length > 0) {
        const nextIndex = (currentIndex + 1) % items.length;
        items[nextIndex].focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length > 0) {
        const prevIndex = (currentIndex - 1 + items.length) % items.length;
        items[prevIndex].focus();
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      if (items.length > 0) items[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      if (items.length > 0) items[items.length - 1].focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu(true);
    } else if (e.key === 'Tab') {
      closeMenu(false);
    }
  });
}

function getMenuItems(menu) {
  return Array.from(menu.querySelectorAll('[role="menuitem"]:not([disabled]):not([aria-disabled="true"])')).filter(el => {
    return window.getComputedStyle(el).display !== 'none';
  });
}

// Global click outside to close dropdowns
document.addEventListener('click', (e) => {
  if (activeOpenDropdownMenu && !activeOpenDropdownMenu.contains(e.target)) {
    const btn = document.querySelector(`[aria-controls="${activeOpenDropdownMenu.id}"]`);
    if (btn && !btn.contains(e.target)) {
      activeOpenDropdownMenu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      activeOpenDropdownMenu = null;
    }
  }
});

window.updateLibraryMenuItemsVisibility = function() {
  const btn = document.getElementById('btn-lib-more-options');
  const itemReset = document.getElementById('menu-item-reset');
  const itemBatch = document.getElementById('menu-item-batch-delete');
  const itemBatchDownload = document.getElementById('menu-item-batch-download');
  const itemRestore = document.getElementById('menu-item-restore-defaults');

  const isEmpty = assetLibrary.length === 0;
  const hasMissing = typeof window.hasMissingDefaultSounds === 'function' ? window.hasMissingDefaultSounds() : false;

  // The more options button itself is ALWAYS enabled and clickable
  if (btn) {
    btn.disabled = false;
    btn.removeAttribute('aria-disabled');
  }

  if (isEmpty) {
    // When library is empty, hide reset, batch delete & batch download, show restore defaults
    if (itemReset) itemReset.style.display = 'none';
    if (itemBatch) itemBatch.style.display = 'none';
    if (itemBatchDownload) itemBatchDownload.style.display = 'none';
    if (itemRestore) itemRestore.style.display = 'block';
  } else {
    // When files exist, show reset, batch delete & batch download
    if (itemReset) itemReset.style.display = 'block';
    if (itemBatch) itemBatch.style.display = 'block';
    if (itemBatchDownload) itemBatchDownload.style.display = 'block';
    // Restore defaults is only visible if any default sounds are missing
    if (itemRestore) itemRestore.style.display = hasMissing ? 'block' : 'none';
  }
};

function openResetModal() {
  const modal = document.getElementById('modal-lib-reset');
  const chkDefaults = document.getElementById('chk-reset-include-defaults');
  const confirmBtn = document.getElementById('btn-confirm-reset');
  const closeBtn = document.getElementById('btn-close-reset-modal');
  if (!modal) return;

  if (chkDefaults) chkDefaults.checked = false;
  modal.hidden = false;
  modal.style.display = 'flex';
  setAppBackgroundInert(true, modal);

  if (confirmBtn) confirmBtn.focus();
  else if (closeBtn) closeBtn.focus();
}

function closeResetModal() {
  const modal = document.getElementById('modal-lib-reset');
  if (modal) {
    modal.hidden = true;
    modal.style.display = 'none';
  }
  setAppBackgroundInert(false);
  const btn = document.getElementById('btn-lib-more-options');
  if (btn) btn.focus();
}

async function handleConfirmReset() {
  const chkDefaults = document.getElementById('chk-reset-include-defaults');
  const includeDefaults = chkDefaults ? chkDefaults.checked : false;

  stopAllLibraryPreviews();

  if (includeDefaults) {
    const allIds = assetLibrary.map(a => a.id);
    allIds.forEach(id => {
      cleanupSingleAsset(id, true);
    });
    closeResetModal();
    renderLibrary();
    populateAllSelects();
    window.updateLibraryMenuItemsVisibility();
    announce('Library has been completely reset. All files including default sounds have been deleted.');
  } else {
    const userAssets = assetLibrary.filter(a => !a.id.startsWith('asset-pre-'));
    userAssets.forEach(a => {
      cleanupSingleAsset(a.id, true);
    });
    closeResetModal();
    renderLibrary();
    populateAllSelects();
    window.updateLibraryMenuItemsVisibility();
    announce('Library reset. All user uploaded files were deleted and default sounds preserved.');
  }
}

function openBatchDeleteModal() {
  const modal = document.getElementById('modal-lib-batch-delete');
  if (!modal) return;

  batchSelectedAssetIds.clear();
  renderBatchFileList();
  updateBatchDeleteButtonAndBadge();

  modal.hidden = false;
  modal.style.display = 'flex';
  setAppBackgroundInert(true, modal);

  const firstChk = modal.querySelector('.batch-file-checkbox');
  const closeBtn = document.getElementById('btn-close-batch-modal');
  if (firstChk) firstChk.focus();
  else if (closeBtn) closeBtn.focus();
}

function closeBatchDeleteModal() {
  const modal = document.getElementById('modal-lib-batch-delete');
  if (modal) {
    modal.hidden = true;
    modal.style.display = 'none';
  }
  setAppBackgroundInert(false);
  batchSelectedAssetIds.clear();
  const btn = document.getElementById('btn-lib-more-options');
  if (btn) btn.focus();
}

function renderBatchFileList() {
  const listContainer = document.getElementById('batch-file-list');
  if (!listContainer) return;
  listContainer.innerHTML = '';

  if (assetLibrary.length === 0) {
    listContainer.innerHTML = '<p class="empty-hint" style="text-align: center; padding: 20px;">No files available in the library.</p>';
    return;
  }

  assetLibrary.forEach(asset => {
    const isDefault = asset.id.startsWith('asset-pre-');
    const isChecked = batchSelectedAssetIds.has(asset.id);

    const item = document.createElement('div');
    item.className = 'batch-file-item';
    item.setAttribute('role', 'listitem');

    item.innerHTML = `
      <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; width: 100%;">
        <input type="checkbox" class="batch-file-checkbox" data-asset-id="${asset.id}" ${isChecked ? 'checked' : ''} aria-label="Select ${escapeHTML(asset.name)} for deletion">
        <span style="font-weight: 600; color: var(--text);">${escapeHTML(asset.name)}</span>
        <span style="font-size: 0.8rem; color: var(--text-dim); text-transform: uppercase;">(${asset.type})</span>
        ${isDefault ? '<span style="color: var(--accent); font-size: 0.8rem; font-weight: 600; margin-left: 6px;">(Default Sound)</span>' : ''}
      </label>
    `;

    listContainer.appendChild(item);
  });

  const checkboxes = Array.from(listContainer.querySelectorAll('.batch-file-checkbox'));
  checkboxes.forEach((chk, idx) => {
    chk.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = checkboxes[(idx + 1) % checkboxes.length];
        if (next) next.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = checkboxes[(idx - 1 + checkboxes.length) % checkboxes.length];
        if (prev) prev.focus();
      }
    });
  });
}

function updateBatchDeleteButtonAndBadge() {
  const badge = document.getElementById('batch-sel-count-badge');
  const confirmBtn = document.getElementById('btn-batch-delete-confirm');
  const count = batchSelectedAssetIds.size;

  if (badge) {
    badge.textContent = `${count} ${count === 1 ? 'file' : 'files'} selected`;
  }
  if (confirmBtn) {
    confirmBtn.textContent = `Delete Selected (${count})`;
    confirmBtn.disabled = count === 0;
  }
}

function handleBatchDeleteConfirm() {
  const count = batchSelectedAssetIds.size;
  if (count === 0) {
    alert('No files selected. Please select at least one file to delete.');
    return;
  }

  if (!confirm(`Are you sure you want to delete ${count} selected file(s) from the library? This action cannot be undone.`)) {
    return;
  }

  stopAllLibraryPreviews();
  const idsToDelete = Array.from(batchSelectedAssetIds);
  idsToDelete.forEach(id => {
    cleanupSingleAsset(id, true);
  });

  batchSelectedAssetIds.clear();
  closeBatchDeleteModal();
  renderLibrary();
  populateAllSelects();
  window.updateLibraryMenuItemsVisibility();
  announce(`${count} file(s) deleted from library.`);
}

function executeBatchSelectionOption(action) {
  const checkboxes = document.querySelectorAll('.batch-file-checkbox');

  if (action === 'select_all') {
    assetLibrary.forEach(a => batchSelectedAssetIds.add(a.id));
    checkboxes.forEach(chk => { chk.checked = true; });
    updateBatchDeleteButtonAndBadge();
    announce(`All ${batchSelectedAssetIds.size} files selected.`);
  } else if (action === 'deselect_all') {
    batchSelectedAssetIds.clear();
    checkboxes.forEach(chk => { chk.checked = false; });
    updateBatchDeleteButtonAndBadge();
    announce('All files deselected.');
  } else if (action === 'invert') {
    assetLibrary.forEach(a => {
      if (batchSelectedAssetIds.has(a.id)) {
        batchSelectedAssetIds.delete(a.id);
      } else {
        batchSelectedAssetIds.add(a.id);
      }
    });
    checkboxes.forEach(chk => {
      const id = chk.getAttribute('data-asset-id');
      chk.checked = batchSelectedAssetIds.has(id);
    });
    updateBatchDeleteButtonAndBadge();
    announce(`Selection inverted: ${batchSelectedAssetIds.size} files selected.`);
  } else if (action === 'user_only') {
    batchSelectedAssetIds.clear();
    assetLibrary.forEach(a => {
      if (!a.id.startsWith('asset-pre-')) {
        batchSelectedAssetIds.add(a.id);
      }
    });
    checkboxes.forEach(chk => {
      const id = chk.getAttribute('data-asset-id');
      chk.checked = batchSelectedAssetIds.has(id);
    });
    updateBatchDeleteButtonAndBadge();
    announce(`${batchSelectedAssetIds.size} user file(s) selected.`);
  }

  const menu = document.getElementById('batch-sel-menu');
  if (menu) menu.hidden = true;
  const btn = document.getElementById('btn-batch-sel-menu');
  if (btn) {
    btn.setAttribute('aria-expanded', 'false');
    btn.focus();
  }
}

// ── BATCH DOWNLOAD FUNCTIONS ──
function openBatchDownloadModal() {
  const modal = document.getElementById('modal-lib-batch-download');
  if (!modal) return;

  batchDownloadSelectedAssetIds.clear();
  renderBatchDownloadFileList();
  updateBatchDownloadButtonAndBadge();

  modal.hidden = false;
  modal.style.display = 'flex';
  setAppBackgroundInert(true, modal);

  const firstChk = modal.querySelector('.batch-download-file-checkbox');
  const closeBtn = document.getElementById('btn-close-batch-download-modal');
  if (firstChk) firstChk.focus();
  else if (closeBtn) closeBtn.focus();
}

function closeBatchDownloadModal() {
  const modal = document.getElementById('modal-lib-batch-download');
  if (modal) {
    modal.hidden = true;
    modal.style.display = 'none';
  }
  setAppBackgroundInert(false);
  batchDownloadSelectedAssetIds.clear();
  const btn = document.getElementById('btn-lib-more-options');
  if (btn) btn.focus();
}

function renderBatchDownloadFileList() {
  const listContainer = document.getElementById('batch-download-file-list');
  if (!listContainer) return;
  listContainer.innerHTML = '';

  if (assetLibrary.length === 0) {
    listContainer.innerHTML = '<p class="empty-hint" style="text-align: center; padding: 20px;">No files available in the library.</p>';
    return;
  }

  assetLibrary.forEach(asset => {
    const isDefault = asset.id.startsWith('asset-pre-');
    const isChecked = batchDownloadSelectedAssetIds.has(asset.id);

    const item = document.createElement('div');
    item.className = 'batch-file-item';
    item.setAttribute('role', 'listitem');

    item.innerHTML = `
      <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; width: 100%;">
        <input type="checkbox" class="batch-download-file-checkbox" data-asset-id="${asset.id}" ${isChecked ? 'checked' : ''} aria-label="Select ${escapeHTML(asset.name)} for download">
        <span style="font-weight: 600; color: var(--text);">${escapeHTML(asset.name)}</span>
        <span style="font-size: 0.8rem; color: var(--text-dim); text-transform: uppercase;">(${asset.type})</span>
        ${isDefault ? '<span style="color: var(--accent); font-size: 0.8rem; font-weight: 600; margin-left: 6px;">(Default Sound)</span>' : ''}
      </label>
    `;

    listContainer.appendChild(item);
  });

  const checkboxes = Array.from(listContainer.querySelectorAll('.batch-download-file-checkbox'));
  checkboxes.forEach((chk, idx) => {
    chk.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = checkboxes[(idx + 1) % checkboxes.length];
        if (next) next.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = checkboxes[(idx - 1 + checkboxes.length) % checkboxes.length];
        if (prev) prev.focus();
      }
    });
  });
}

function updateBatchDownloadButtonAndBadge() {
  const badge = document.getElementById('batch-download-sel-count-badge');
  const confirmBtn = document.getElementById('btn-batch-download-confirm');
  const count = batchDownloadSelectedAssetIds.size;

  if (badge) {
    badge.textContent = `${count} ${count === 1 ? 'file' : 'files'} selected`;
  }
  if (confirmBtn) {
    confirmBtn.textContent = `Download Selected (${count})`;
    confirmBtn.disabled = count === 0;
  }
}

function executeBatchDownloadSelectionOption(action) {
  const checkboxes = document.querySelectorAll('.batch-download-file-checkbox');

  if (action === 'select_all') {
    assetLibrary.forEach(a => batchDownloadSelectedAssetIds.add(a.id));
    checkboxes.forEach(chk => { chk.checked = true; });
    updateBatchDownloadButtonAndBadge();
    announce(`All ${batchDownloadSelectedAssetIds.size} files selected for download.`);
  } else if (action === 'deselect_all') {
    batchDownloadSelectedAssetIds.clear();
    checkboxes.forEach(chk => { chk.checked = false; });
    updateBatchDownloadButtonAndBadge();
    announce('All files deselected.');
  } else if (action === 'invert') {
    assetLibrary.forEach(a => {
      if (batchDownloadSelectedAssetIds.has(a.id)) {
        batchDownloadSelectedAssetIds.delete(a.id);
      } else {
        batchDownloadSelectedAssetIds.add(a.id);
      }
    });
    checkboxes.forEach(chk => {
      const id = chk.getAttribute('data-asset-id');
      chk.checked = batchDownloadSelectedAssetIds.has(id);
    });
    updateBatchDownloadButtonAndBadge();
    announce(`Selection inverted: ${batchDownloadSelectedAssetIds.size} files selected.`);
  } else if (action === 'user_only') {
    batchDownloadSelectedAssetIds.clear();
    assetLibrary.forEach(a => {
      if (!a.id.startsWith('asset-pre-')) {
        batchDownloadSelectedAssetIds.add(a.id);
      }
    });
    checkboxes.forEach(chk => {
      const id = chk.getAttribute('data-asset-id');
      chk.checked = batchDownloadSelectedAssetIds.has(id);
    });
    updateBatchDownloadButtonAndBadge();
    announce(`${batchDownloadSelectedAssetIds.size} user file(s) selected for download.`);
  }

  const menu = document.getElementById('batch-download-sel-menu');
  if (menu) menu.hidden = true;
  const btn = document.getElementById('btn-batch-download-sel-menu');
  if (btn) {
    btn.setAttribute('aria-expanded', 'false');
    btn.focus();
  }
}

function handleBatchDownloadConfirm() {
  const count = batchDownloadSelectedAssetIds.size;
  if (count === 0) {
    alert('No files selected. Please select at least one file to download.');
    return;
  }

  const idsToDownload = Array.from(batchDownloadSelectedAssetIds);
  closeBatchDownloadModal();
  announce(`Downloading ${count} selected file(s)...`);

  // Stagger downloads by 250ms so browser manages multiple downloads cleanly
  idsToDownload.forEach((id, index) => {
    setTimeout(() => {
      if (typeof window.downloadAsset === 'function') {
        window.downloadAsset(id);
      }
    }, index * 250);
  });
}

function getUniqueAssetName(requestedName) {
  let name = (requestedName || '').trim();
  if (!name) name = "Untitled";

  const exists = (n) => assetLibrary.some(a => a.name.toLowerCase() === n.toLowerCase());

  if (!exists(name)) {
    return name;
  }

  let counter = 1;
  let candidate = `${name} ${counter}`;
  while (exists(candidate)) {
    counter++;
    candidate = `${name} ${counter}`;
  }

  return candidate;
}

function initLibrary() {
 const fileInput = document.getElementById('lib-file-input');
 const nameInput = document.getElementById('lib-file-name');
 const btnAdd = document.getElementById('btn-add-to-library');

 // Auto-fill name from filename
 fileInput.addEventListener('change', () =>{
 if (fileInput.files[0] && !nameInput.value.trim()) {
 const rawName = fileInput.files[0].name.replace(/\.[^.]+$/, '');
 nameInput.value = getUniqueAssetName(rawName);
 }
 });

 btnAdd.addEventListener('click', () =>{
 const file = fileInput.files[0];
 const rawName = nameInput.value.trim();

 if (!file) { alert('Please choose a file.'); return; }
 if (!rawName) { alert('Please give the file a name.'); return; }

 const name = getUniqueAssetName(rawName);

 let type = null;
 if (file.type) {
 if (file.type.startsWith('audio/')) type = 'audio';
 else if (file.type.startsWith('video/')) type = 'video';
 else if (file.type.startsWith('image/')) type = 'image';
 }
 if (!type && file.name) {
 const ext = file.name.split('.').pop().toLowerCase();
 const audioExts = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac', 'wma', 'opus', 'mp4a'];
 const videoExts = ['mp4', 'webm', 'ogg', 'avi', 'mov', 'mkv', 'flv', 'm4v'];
 const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'tiff'];
 if (audioExts.includes(ext)) type = 'audio';
 else if (videoExts.includes(ext)) type = 'video';
 else if (imageExts.includes(ext)) type = 'image';
 }

 if (!type) { alert('Unsupported file type. Please upload audio, video, or image files.'); return; }

  if (file.size >100 * 1024 * 1024) {
  if (!confirm(`The file "${file.name}" is over 100MB. Processing very large files might cause the browser to slow down or crash. Are you sure you want to continue?`)) {
  nameInput.value = '';
  fileInput.value = '';
  return;
  }
  }

  const id = `asset-${++assetIdCounter}`;
  const objectURL = URL.createObjectURL(file);
  assetLibrary.push({ id, name, type, objectURL, file });

 // Persist to IndexedDB so the file survives page refresh
 dbSaveAsset(id, name, type, file);

 renderLibrary();
 populateAllSelects();

 nameInput.value = '';
 fileInput.value = '';
 announce(`"${name}" added to the library.`);
 });

 // ── MORE LIBRARY OPTIONS & BATCH SELECTION MENUS ──
 setupDropdownMenu('btn-lib-more-options', 'lib-more-menu');
 setupDropdownMenu('btn-batch-sel-menu', 'batch-sel-menu');
 setupDropdownMenu('btn-batch-download-sel-menu', 'batch-download-sel-menu');
 setupFocusTrap(document.getElementById('modal-lib-reset'));
 setupFocusTrap(document.getElementById('modal-lib-batch-delete'));
 setupFocusTrap(document.getElementById('modal-lib-batch-download'));

 const itemReset = document.getElementById('menu-item-reset');
 if (itemReset) {
 itemReset.addEventListener('click', () => {
 const menu = document.getElementById('lib-more-menu');
 if (menu) menu.hidden = true;
 const btn = document.getElementById('btn-lib-more-options');
 if (btn) btn.setAttribute('aria-expanded', 'false');
 openResetModal();
 });
 }

 const itemBatch = document.getElementById('menu-item-batch-delete');
 if (itemBatch) {
 itemBatch.addEventListener('click', () => {
 const menu = document.getElementById('lib-more-menu');
 if (menu) menu.hidden = true;
 const btn = document.getElementById('btn-lib-more-options');
 if (btn) btn.setAttribute('aria-expanded', 'false');
 openBatchDeleteModal();
 });
 }

 const itemBatchDownload = document.getElementById('menu-item-batch-download');
 if (itemBatchDownload) {
 itemBatchDownload.addEventListener('click', () => {
 const menu = document.getElementById('lib-more-menu');
 if (menu) menu.hidden = true;
 const btn = document.getElementById('btn-lib-more-options');
 if (btn) btn.setAttribute('aria-expanded', 'false');
 openBatchDownloadModal();
 });
 }

 const itemRestore = document.getElementById('menu-item-restore-defaults');
 if (itemRestore) {
 itemRestore.addEventListener('click', async () => {
 const menu = document.getElementById('lib-more-menu');
 if (menu) menu.hidden = true;
 const btn = document.getElementById('btn-lib-more-options');
 if (btn) {
 btn.setAttribute('aria-expanded', 'false');
 btn.focus();
 }
 if (typeof window.restoreMissingDefaultSounds === 'function') {
 const restored = await window.restoreMissingDefaultSounds();
 announce(`${restored} default sound(s) restored.`);
 }
 });
 }

 // ── RESET MODAL BUTTONS ──
 const btnCloseReset = document.getElementById('btn-close-reset-modal');
 const btnCancelReset = document.getElementById('btn-cancel-reset');
 const btnConfirmReset = document.getElementById('btn-confirm-reset');

 if (btnCloseReset) btnCloseReset.addEventListener('click', closeResetModal);
 if (btnCancelReset) btnCancelReset.addEventListener('click', closeResetModal);
 if (btnConfirmReset) btnConfirmReset.addEventListener('click', handleConfirmReset);

 // ── BATCH DELETE MODAL BUTTONS ──
 const btnCloseBatch = document.getElementById('btn-close-batch-modal');
 const btnCancelBatch = document.getElementById('btn-batch-delete-cancel');
 const btnConfirmBatch = document.getElementById('btn-batch-delete-confirm');

 if (btnCloseBatch) btnCloseBatch.addEventListener('click', closeBatchDeleteModal);
 if (btnCancelBatch) btnCancelBatch.addEventListener('click', closeBatchDeleteModal);
 if (btnConfirmBatch) btnConfirmBatch.addEventListener('click', handleBatchDeleteConfirm);

 // Batch selection menu options
 const itemSelAll = document.getElementById('menu-item-sel-all');
 const itemDeselAll = document.getElementById('menu-item-desel-all');
 const itemInvertSel = document.getElementById('menu-item-invert-sel');
 const itemSelUserOnly = document.getElementById('menu-item-sel-user-only');

 if (itemSelAll) itemSelAll.addEventListener('click', () => executeBatchSelectionOption('select_all'));
 if (itemDeselAll) itemDeselAll.addEventListener('click', () => executeBatchSelectionOption('deselect_all'));
 if (itemInvertSel) itemInvertSel.addEventListener('click', () => executeBatchSelectionOption('invert'));
 if (itemSelUserOnly) itemSelUserOnly.addEventListener('click', () => executeBatchSelectionOption('user_only'));

 // Batch file list checkboxes change
 const batchList = document.getElementById('batch-file-list');
 if (batchList) {
 batchList.addEventListener('change', (e) => {
 if (e.target && e.target.classList.contains('batch-file-checkbox')) {
 const id = e.target.getAttribute('data-asset-id');
 if (e.target.checked) batchSelectedAssetIds.add(id);
 else batchSelectedAssetIds.delete(id);
 updateBatchDeleteButtonAndBadge();
 }
 });
 }

 // ── BATCH DOWNLOAD MODAL BUTTONS ──
 const btnCloseBatchDownload = document.getElementById('btn-close-batch-download-modal');
 const btnCancelBatchDownload = document.getElementById('btn-batch-download-cancel');
 const btnConfirmBatchDownload = document.getElementById('btn-batch-download-confirm');

 if (btnCloseBatchDownload) btnCloseBatchDownload.addEventListener('click', closeBatchDownloadModal);
 if (btnCancelBatchDownload) btnCancelBatchDownload.addEventListener('click', closeBatchDownloadModal);
 if (btnConfirmBatchDownload) btnConfirmBatchDownload.addEventListener('click', handleBatchDownloadConfirm);

 // Batch download selection menu options
 const itemDownloadSelAll = document.getElementById('menu-item-download-sel-all');
 const itemDownloadDeselAll = document.getElementById('menu-item-download-desel-all');
 const itemDownloadInvertSel = document.getElementById('menu-item-download-invert-sel');
 const itemDownloadSelUserOnly = document.getElementById('menu-item-download-sel-user-only');

 if (itemDownloadSelAll) itemDownloadSelAll.addEventListener('click', () => executeBatchDownloadSelectionOption('select_all'));
 if (itemDownloadDeselAll) itemDownloadDeselAll.addEventListener('click', () => executeBatchDownloadSelectionOption('deselect_all'));
 if (itemDownloadInvertSel) itemDownloadInvertSel.addEventListener('click', () => executeBatchDownloadSelectionOption('invert'));
 if (itemDownloadSelUserOnly) itemDownloadSelUserOnly.addEventListener('click', () => executeBatchDownloadSelectionOption('user_only'));

 // Batch download file list checkboxes change
 const batchDownloadList = document.getElementById('batch-download-file-list');
 if (batchDownloadList) {
 batchDownloadList.addEventListener('change', (e) => {
 if (e.target && e.target.classList.contains('batch-download-file-checkbox')) {
 const id = e.target.getAttribute('data-asset-id');
 if (e.target.checked) batchDownloadSelectedAssetIds.add(id);
 else batchDownloadSelectedAssetIds.delete(id);
 updateBatchDownloadButtonAndBadge();
 }
 });
 }

 // Global Escape key closes any active modal
 document.addEventListener('keydown', (e) => {
 if (e.key === 'Escape') {
 const resetModal = document.getElementById('modal-lib-reset');
 if (resetModal && !resetModal.hidden) {
 closeResetModal();
 return;
 }
 const batchModal = document.getElementById('modal-lib-batch-delete');
 if (batchModal && !batchModal.hidden) {
 closeBatchDeleteModal();
 return;
 }
 const batchDownloadModal = document.getElementById('modal-lib-batch-download');
 if (batchDownloadModal && !batchDownloadModal.hidden) {
 closeBatchDownloadModal();
 return;
 }
 }
 });

 window.updateLibraryMenuItemsVisibility();
}

function renderLibrary() {
 const container = document.getElementById('library-items');
 container.innerHTML = '';

 if (assetLibrary.length === 0) {
 container.innerHTML = '<p class="empty-hint">No files uploaded yet. Upload a file above to get started.</p>';
 if (typeof window.updateLibraryMenuItemsVisibility === 'function') window.updateLibraryMenuItemsVisibility();
 return;
 }

 assetLibrary.forEach(asset =>{
 const item = document.createElement('div');
 item.className = 'library-item';
 item.setAttribute('role', 'listitem');
 
 let btnText = '';
 let btnAria = '';
 if (asset.type === 'image') {
 btnText = 'Show Image';
 btnAria = `Show image preview for ${escapeHTML(asset.name)}`;
 } else if (asset.type === 'audio') {
 btnText = 'Play';
 btnAria = `Play preview for ${escapeHTML(asset.name)}`;
 } else if (asset.type === 'video') {
 btnText = 'Play Video';
 btnAria = `Play video preview for ${escapeHTML(asset.name)}`;
 }
 
 item.innerHTML = `
<div class="library-item-main">
<span class="asset-icon">${asset.type === 'audio'? '': asset.type === 'video'? '': ''}</span>
<span class="asset-name">${escapeHTML(asset.name)}</span>
<span class="asset-type">${asset.type}</span>
<div class="library-item-actions">
<button class="btn btn-sm btn-secondary" onclick="downloadAsset('${asset.id}')" aria-label="Download ${escapeHTML(asset.name)}">Download</button>
<button id="btn-prev-${asset.id}" class="btn btn-sm btn-preview" onclick="toggleLibraryPreview('${asset.id}')" aria-label="${btnAria}">${btnText}</button>
<button id="btn-replay-${asset.id}" class="btn btn-sm btn-secondary" onclick="replayLibraryPreview('${asset.id}')" aria-label="Replay preview for ${escapeHTML(asset.name)}" style="display: none;">Replay</button>
<button id="btn-stop-${asset.id}" class="btn btn-sm btn-danger" onclick="stopLibraryPreview('${asset.id}')" aria-label="Stop preview for ${escapeHTML(asset.name)}" style="display: none;">Stop</button>
<button class="btn btn-sm btn-danger"
 onclick="removeAsset('${asset.id}')"
 aria-label="Remove ${escapeHTML(asset.name)} from library">Remove</button>
</div>
</div>
<div id="preview-container-${asset.id}"class="library-item-preview"hidden></div>
 `;
 container.appendChild(item);
 });

 if (typeof window.updateLibraryMenuItemsVisibility === 'function') window.updateLibraryMenuItemsVisibility();
}

window.downloadAsset = function(id) {
  const asset = getAsset(id);
  if (!asset) return;

  let ext = '';
  const mime = asset.file.type ? asset.file.type.toLowerCase() : '';
  
  if (mime.includes('audio/mpeg') || mime.includes('audio/mp3')) ext = '.mp3';
  else if (mime.includes('audio/wav') || mime.includes('audio/x-wav')) ext = '.wav';
  else if (mime.includes('audio/ogg')) ext = '.ogg';
  else if (mime.includes('video/webm')) ext = '.webm';
  else if (mime.includes('video/mp4')) ext = '.mp4';
  else if (mime.includes('image/png')) ext = '.png';
  else if (mime.includes('image/jpeg')) ext = '.jpg';
  else if (mime.includes('image/webp')) ext = '.webp';
  else if (mime.includes('image/gif')) ext = '.gif';
  else {
    // Fallback if MIME type is missing or unknown
    if (asset.type === 'audio') ext = '.wav';
    else if (asset.type === 'video') ext = '.webm';
    else if (asset.type === 'image') ext = '.png';
  }

  // Check if asset.name already ends with an extension (e.g. .mp3, .wav, .mp4)
  const hasExt = /\.[a-z0-9]{3,4}$/i.test(asset.name);
  const filename = hasExt ? asset.name : `${asset.name}${ext}`;
  
  downloadBlob(asset.file, filename);
  announce(`Downloading ${asset.name}.`);
};

function stopAllLibraryPreviews() {
 window.lastEndedPreview = null;
 if (window.lastLibraryPreview) window.lastLibraryPreview.hasEnded = false;
 // Stop all background audio elements
 Object.keys(activeLibraryAudios).forEach(key =>{
 activeLibraryAudios[key].pause();
 const otherBtn = document.getElementById(`btn-prev-${key}`);
 const replayBtn = document.getElementById(`btn-replay-${key}`);
 const stopBtn = document.getElementById(`btn-stop-${key}`);
 const otherAsset = getAsset(key);
 if (otherBtn && otherAsset) {
 otherBtn.textContent = otherAsset.type === 'audio'? 'Play': 'Play Video';
 otherBtn.setAttribute('aria-label', `Play preview for ${otherAsset.name}`);
 }
 if (replayBtn) {
  if (document.activeElement === replayBtn) {
    if (typeof btn !== 'undefined'&& btn) btn.focus();
    else if (typeof otherBtn !== 'undefined'&& otherBtn) otherBtn.focus();
  }
  replayBtn.style.display = 'none';
 }
 if (stopBtn) {
  if (document.activeElement === stopBtn) {
    if (typeof btn !== 'undefined'&& btn) btn.focus();
    else if (typeof otherBtn !== 'undefined'&& otherBtn) otherBtn.focus();
  }
  stopBtn.style.display = 'none';
 }
 const otherContainer = document.getElementById(`preview-container-${key}`);
 if (otherContainer) {
 otherContainer.innerHTML = '';
 otherContainer.hidden = true;
 }
 delete activeLibraryAudios[key];
 });

 // Stop any active video previews
 assetLibrary.forEach(asset =>{
 if (asset.type === 'video') {
 const otherContainer = document.getElementById(`preview-container-${asset.id}`);
 if (otherContainer && !otherContainer.hidden) {
 const vid = otherContainer.querySelector('video');
 if (vid) { try { vid.pause(); } catch (_) {} }
 otherContainer.innerHTML = '';
 otherContainer.hidden = true;
 const otherBtn = document.getElementById(`btn-prev-${asset.id}`);
 const replayBtn = document.getElementById(`btn-replay-${asset.id}`);
 const stopBtn = document.getElementById(`btn-stop-${asset.id}`);
 if (otherBtn) {
 otherBtn.textContent = 'Play Video';
 otherBtn.setAttribute('aria-label', `Play video preview for ${asset.name}`);
 }
 if (replayBtn) {
  if (document.activeElement === replayBtn) {
    if (typeof btn !== 'undefined'&& btn) btn.focus();
    else if (typeof otherBtn !== 'undefined'&& otherBtn) otherBtn.focus();
  }
  replayBtn.style.display = 'none';
 }
 if (stopBtn) {
  if (document.activeElement === stopBtn) {
    if (typeof btn !== 'undefined'&& btn) btn.focus();
    else if (typeof otherBtn !== 'undefined'&& otherBtn) otherBtn.focus();
  }
  stopBtn.style.display = 'none';
 }
 }
 }
 });
}

window.toggleLibraryPreview = function(id) {
 const asset = getAsset(id);
 if (!asset) return;

 const btn = document.getElementById(`btn-prev-${id}`);
 const replayBtn = document.getElementById(`btn-replay-${id}`);
 const stopBtn = document.getElementById(`btn-stop-${id}`);
 const container = document.getElementById(`preview-container-${id}`);
 if (!btn || !container) return;

 if (asset.type === 'audio') {
 const isPlaying = activeLibraryAudios[id];

 if (isPlaying) {
   if (!isPlaying.paused) {
     isPlaying.pause();
     btn.textContent = 'Resume';
     btn.setAttribute('aria-label', `Resume preview for ${asset.name}`);
   } else {
     isPlaying.play();
     btn.textContent = 'Pause';
     btn.setAttribute('aria-label', `Pause preview for ${asset.name}`);
   }
 } else {
 if (typeof window.stopAllStudioPreviews === 'function') window.stopAllStudioPreviews('library');
 stopAllLibraryPreviews();

 const aud = new Audio(asset.objectURL);
 aud.play().catch(err =>console.error("Preview play failed:", err));
 activeLibraryAudios[id] = aud;
 window.lastLibraryPreview = { id, type: 'audio', aud, asset, hasEnded: false };
 btn.textContent = 'Pause';
 btn.setAttribute('aria-label', `Pause preview for ${asset.name}`);
 if (replayBtn) replayBtn.style.display = 'inline-block';
 if (stopBtn) stopBtn.style.display = 'inline-block';

 aud.onended = () =>{
 window.lastEndedPreview = 'library';
 window.lastLibraryPreview = { id, type: 'audio', aud, asset, hasEnded: true };
 delete activeLibraryAudios[id];
 btn.textContent = 'Play';
 btn.setAttribute('aria-label', `Play preview for ${asset.name}`);
 if (replayBtn) {
  if (document.activeElement === replayBtn) btn.focus();
  replayBtn.style.display = 'none';
 }
 if (stopBtn) {
  if (document.activeElement === stopBtn) btn.focus();
  stopBtn.style.display = 'none';
 }
 container.innerHTML = '';
 container.hidden = true;
 };
 }
 } else if (asset.type === 'video') {
 const isVisible = !container.hidden;
 const vid = container.querySelector('video');

 if (isVisible && vid) {
   if (!vid.paused) {
     vid.pause();
     btn.textContent = 'Resume Video';
     btn.setAttribute('aria-label', `Resume video preview for ${asset.name}`);
   } else {
     vid.play();
     btn.textContent = 'Pause Video';
     btn.setAttribute('aria-label', `Pause video preview for ${asset.name}`);
   }
 } else {
 if (typeof window.stopAllStudioPreviews === 'function') window.stopAllStudioPreviews('library');
 stopAllLibraryPreviews();

 container.hidden = false;
 container.innerHTML = `
<video id="vid-prev-${id}"src="${asset.objectURL}"autoplay controls playsinline></video>
 `;
 btn.textContent = 'Pause Video';
 btn.setAttribute('aria-label', `Pause video preview for ${asset.name}`);
 if (replayBtn) replayBtn.style.display = 'inline-block';
 if (stopBtn) stopBtn.style.display = 'inline-block';
 
 const newVid = document.getElementById(`vid-prev-${id}`);
 if (newVid) {
 window.lastLibraryPreview = { id, type: 'video', vid: newVid, asset, hasEnded: false };
 newVid.onended = () =>{
 window.lastEndedPreview = 'library';
 window.lastLibraryPreview = { id, type: 'video', vid: newVid, asset, hasEnded: true };
 btn.textContent = 'Play Video';
 btn.setAttribute('aria-label', `Play video preview for ${asset.name}`);
 if (replayBtn) {
  if (document.activeElement === replayBtn) btn.focus();
  replayBtn.style.display = 'none';
 }
 if (stopBtn) {
  if (document.activeElement === stopBtn) btn.focus();
  stopBtn.style.display = 'none';
 }
 container.innerHTML = '';
 container.hidden = true;
 };
 }
 }
 } else if (asset.type === 'image') {
 const isVisible = !container.hidden;
 if (isVisible) {
 container.innerHTML = '';
 container.hidden = true;
 btn.textContent = 'Show Image';
 btn.setAttribute('aria-label', `Show image preview for ${asset.name}`);
 } else {
 container.hidden = false;
 container.innerHTML = `
<img src="${asset.objectURL}"alt="Preview of ${escapeHTML(asset.name)}">
 `;
 btn.textContent = 'Hide Image';
 btn.setAttribute('aria-label', `Hide image preview for ${asset.name}`);
 }
 }
};

window.replayLibraryPreview = function(id) {
  const asset = getAsset(id);
  if (!asset) return;

  const btn = document.getElementById(`btn-prev-${id}`);
  
  if (asset.type === 'audio') {
    const isPlaying = activeLibraryAudios[id];
    if (isPlaying) {
      isPlaying.currentTime = 0;
      isPlaying.play();
      if (btn) btn.textContent = 'Pause';
      if (btn) btn.setAttribute('aria-label', `Pause preview for ${asset.name}`);
    }
  } else if (asset.type === 'video') {
    const vid = document.getElementById(`vid-prev-${id}`);
    if (vid) {
      vid.currentTime = 0;
      vid.play();
      if (btn) btn.textContent = 'Pause Video';
      if (btn) btn.setAttribute('aria-label', `Pause video preview for ${asset.name}`);
    }
  }
};

window.stopLibraryPreview = function(id) {
  window.lastEndedPreview = null;
  if (window.lastLibraryPreview) window.lastLibraryPreview.hasEnded = false;
  const btn = document.getElementById(`btn-prev-${id}`);
  const replayBtn = document.getElementById(`btn-replay-${id}`);
  const stopBtn = document.getElementById(`btn-stop-${id}`);
  
  // Stop everything
  if (activeLibraryAudios[id]) {
    activeLibraryAudios[id].pause();
    delete activeLibraryAudios[id];
  }
  
  const videoContainer = document.getElementById(`preview-container-${id}`);
  if (videoContainer && !videoContainer.hidden) {
    const vid = videoContainer.querySelector('video');
    if (vid) { try { vid.pause(); } catch (_) {} }
    videoContainer.innerHTML = '';
    videoContainer.hidden = true;
  }
  
  if (btn) {
    const asset = getAsset(id);
    if (asset) {
      btn.textContent = asset.type === 'audio'? 'Play': (asset.type === 'video'? 'Play Video': 'Show Image');
      btn.setAttribute('aria-label', `Play preview for ${asset.name}`);
    }
    btn.focus(); // Force focus explicitly
  }
  
  if (replayBtn) replayBtn.style.display = 'none';
  if (stopBtn) stopBtn.style.display = 'none';
};

function cleanupSingleAsset(id, deleteFromDB = true) {
  const asset = getAsset(id);
  const assetName = asset ? asset.name : '';

  // Stop preview if this specific asset is currently playing in library
  if (activeLibraryAudios[id]) {
    try { activeLibraryAudios[id].pause(); } catch (_) {}
    delete activeLibraryAudios[id];
  }
  const videoContainer = document.getElementById(`preview-container-${id}`);
  if (videoContainer && !videoContainer.hidden) {
    const vid = videoContainer.querySelector('video');
    if (vid) { try { vid.pause(); } catch (_) {} }
    videoContainer.innerHTML = '';
    videoContainer.hidden = true;
  }

  const idx = assetLibrary.findIndex(a => a.id === id);
  if (idx !== -1) { 
    try { URL.revokeObjectURL(assetLibrary[idx].objectURL); } catch (_) {}
    assetLibrary.splice(idx, 1); 
  }

  // 1. Super Merger: Base Audio
  if (typeof smBaseAsset !== 'undefined' && smBaseAsset && smBaseAsset.id === id) {
    window.smDeletedBaseAssetName = assetName;
    smBaseAsset = null;
    const baseSel = document.getElementById('sm-base-select');
    if (baseSel) baseSel.value = '';
    if (typeof smBaseAudio !== 'undefined' && smBaseAudio) {
      try { smBaseAudio.stop(); } catch (_) {}
      smBaseAudio = null;
    }
    const baseVolVal = document.getElementById('sm-base-vol-val');
    if (baseVolVal) baseVolVal.textContent = '100';
    const baseVol = document.getElementById('sm-base-volume');
    if (baseVol) baseVol.value = '100';
    if (typeof updateSmBaseModeUI === 'function') updateSmBaseModeUI(false);
    if (typeof updateSmGoButton === 'function') updateSmGoButton();
  }

  // 2. Super Merger: Overlays & Recorded Clips
  if (typeof smOverlays !== 'undefined') {
    const removedOverlays = smOverlays.filter(o => o.assetId === id);
    if (removedOverlays.length > 0) {
      if (!window.smDeletedOverlayNames) window.smDeletedOverlayNames = [];
      removedOverlays.forEach(o => {
        if (!window.smDeletedOverlayNames.includes(o.name)) {
          window.smDeletedOverlayNames.push(o.name);
        }
      });
      const remainingSmO = smOverlays.filter(o => o.assetId !== id);
      smOverlays.length = 0;
      smOverlays.push(...remainingSmO);
      if (typeof renderSmShortcutsTable === 'function') renderSmShortcutsTable();
      if (typeof renderManageOverlaysList === 'function') renderManageOverlaysList();
      if (typeof updateSmGoButton === 'function') updateSmGoButton();
    }
  }
  if (typeof smRecordedClips !== 'undefined') {
    const remainingSm = smRecordedClips.filter(c => c.assetId !== id);
    smRecordedClips.length = 0;
    smRecordedClips.push(...remainingSm);
  }

  // 3. Merge Audio
  if (typeof maClips !== 'undefined') {
    const removedMa = maClips.filter(c => c.assetId === id);
    if (removedMa.length > 0) {
      if (!window.maDeletedClipNames) window.maDeletedClipNames = [];
      removedMa.forEach(c => {
        if (!window.maDeletedClipNames.includes(c.name)) window.maDeletedClipNames.push(c.name);
      });
      const remainingMa = maClips.filter(c => c.assetId !== id);
      maClips.length = 0;
      maClips.push(...remainingMa);
      if (typeof renderMaTable === 'function') renderMaTable();
    }
    const maSelect = document.getElementById('ma-sound-select');
    if (maSelect && maSelect.value === id) maSelect.value = '';
  }

  // 4. Merge Video
  if (typeof mvClips !== 'undefined') {
    const removedMv = mvClips.filter(c => c.assetId === id);
    if (removedMv.length > 0) {
      if (!window.mvDeletedClipNames) window.mvDeletedClipNames = [];
      removedMv.forEach(c => {
        if (!window.mvDeletedClipNames.includes(c.name)) window.mvDeletedClipNames.push(c.name);
      });
      const remainingMv = mvClips.filter(c => c.assetId !== id);
      mvClips.length = 0;
      mvClips.push(...remainingMv);
      if (typeof renderMvTable === 'function') renderMvTable();
    }
    const mvSelect = document.getElementById('mv-video-select');
    if (mvSelect && mvSelect.value === id) mvSelect.value = '';
  }

  // 5. Audio to Video
  if (typeof avSlides !== 'undefined') {
    const removedAv = avSlides.filter(c => c.assetId === id);
    if (removedAv.length > 0) {
      if (!window.avDeletedSlideNames) window.avDeletedSlideNames = [];
      removedAv.forEach(c => {
        if (!window.avDeletedSlideNames.includes(c.name)) window.avDeletedSlideNames.push(c.name);
      });
      const remainingAv = avSlides.filter(c => c.assetId !== id);
      avSlides.length = 0;
      avSlides.push(...remainingAv);
      if (typeof renderAvTable === 'function') renderAvTable();
    }
    const avAudioSel = document.getElementById('av-audio-select');
    if (avAudioSel && avAudioSel.value === id) avAudioSel.value = '';
    const avImgSel = document.getElementById('av-image-select');
    if (avImgSel && avImgSel.value === id) avImgSel.value = '';
  }

  // 6. Video to Audio
  const vaSel = document.getElementById('va-video-select');
  if (vaSel && vaSel.value === id) {
    window.vaDeletedAssetName = assetName;
    vaSel.value = '';
  }

  // 7. Trim Video
  const tvSel = document.getElementById('tv-video-select');
  if (tvSel && tvSel.value === id) {
    window.tvDeletedAssetName = assetName;
    tvSel.value = '';
  }

  // 8. Trim Audio
  const taSelect = document.getElementById('ta-audio-select');
  if (taSelect && taSelect.value === id) {
    window.taDeletedAssetName = assetName;
    taSelect.value = '';
  }
  if (typeof trimAudioCacheId !== 'undefined' && trimAudioCacheId === id) {
    window.taDeletedAssetName = assetName;
    trimAudioCacheId = null;
    trimAudioCacheBuffer = null;
    if (typeof trimPreviewSource !== 'undefined' && trimPreviewSource) {
      try { trimPreviewSource.stop(); } catch (_) {}
      trimPreviewSource = null;
    }
  }

  // 9. Super Trim
  const staSelect = document.getElementById('sta-audio-select');
  if (staSelect && staSelect.value === id) {
    window.staDeletedAssetName = assetName;
    staSelect.value = '';
  }
  if (typeof currentStaAssetId !== 'undefined' && currentStaAssetId === id) {
    window.staDeletedAssetName = assetName;
    currentStaAssetId = null;
    if (typeof trimBuffer !== 'undefined') trimBuffer = null;
    if (typeof trimPlaySource !== 'undefined' && trimPlaySource) {
      try { trimPlaySource.stop(); } catch (_) {}
      trimPlaySource = null;
    }
    const timeDisplay = document.getElementById('sta-time-display');
    if (timeDisplay) timeDisplay.textContent = '00:00.0';
    const startDisplay = document.getElementById('sta-start-display');
    if (startDisplay) startDisplay.textContent = 'Not set';
    const endDisplay = document.getElementById('sta-end-display');
    if (endDisplay) endDisplay.textContent = 'Not set';
  }

  // 10. Super Cut
  const sctSelect = document.getElementById('sct-audio-select');
  if (sctSelect && sctSelect.value === id) {
    window.sctDeletedAssetName = assetName;
    sctSelect.value = '';
  }
  if (typeof currentsctAssetId !== 'undefined' && currentsctAssetId === id) {
    window.sctDeletedAssetName = assetName;
    currentsctAssetId = null;
    if (typeof sctBuffer !== 'undefined') sctBuffer = null;
    if (typeof sctCutRegions !== 'undefined') sctCutRegions = [];
    if (typeof sctActiveCut !== 'undefined') sctActiveCut = { start: null, end: null, id: null };
    if (typeof sctPlaySource !== 'undefined' && sctPlaySource) {
      try { sctPlaySource.stop(); } catch (_) {}
      sctPlaySource = null;
    }
    const timeDisplay = document.getElementById('sct-time-display');
    if (timeDisplay) timeDisplay.textContent = '00:00.0';
    const startDisplay = document.getElementById('sct-start-display');
    if (startDisplay) startDisplay.textContent = 'Not set';
    const endDisplay = document.getElementById('sct-end-display');
    if (endDisplay) endDisplay.textContent = 'Not set';
    const countEl = document.getElementById('sct-cuts-count');
    if (countEl) countEl.textContent = '0';
  }

  // Remove decoded buffer from memory to prevent RAM leaks
  if (decodedAudioBuffers[id]) {
    delete decodedAudioBuffers[id];
  }

  // Remove from IndexedDB as well
  if (deleteFromDB && typeof dbDeleteAsset === 'function') {
    dbDeleteAsset(id);
  }
}

window.removeAsset = function(id) {
  setTimeout(() => {
    const asset = getAsset(id);
    if (!asset) return;
    
    if (!confirm(`Are you sure you want to remove "${asset.name}" from the library?`)) {
      return; // User cancelled
    }

    cleanupSingleAsset(id, true);
    if (batchSelectedAssetIds.has(id)) {
      batchSelectedAssetIds.delete(id);
    }
    renderLibrary();
    populateAllSelects();
    if (typeof window.updateLibraryMenuItemsVisibility === 'function') {
      window.updateLibraryMenuItemsVisibility();
    }
    announce('Asset removed from library.');
  }, 50);
};

function populateAllSelects() {
 const configs = [
 { id: 'ma-sound-select', types: ['audio', 'video'] },
 { id: 'mv-video-select', types: ['video'] },
 { id: 'av-audio-select', types: ['audio', 'video'] },
 { id: 'av-image-select', types: ['image'] },
 { id: 'va-video-select', types: ['video'] },
 { id: 'ta-audio-select', types: ['audio', 'video'] },
 { id: 'tv-video-select', types: ['video'] },
 { id: 'sm-base-select', types: ['audio', 'video'] },
 { id: 'sm-overlay-select', types: ['audio', 'video'] },
 { id: 'sta-audio-select', types: ['audio', 'video'] },
 { id: 'sct-audio-select', types: ['audio', 'video'] },
 ];

 configs.forEach(({ id, types }) =>{
 const sel = document.getElementById(id);
 if (!sel) return;
 const prev = sel.value;
 sel.innerHTML = '<option value=""disabled>Select from library...</option>';
 const matching = assetLibrary.filter(a =>types.includes(a.type));
 matching.forEach(a =>{
 const opt = document.createElement('option');
 opt.value = a.id;
 opt.textContent = `${a.name} (${a.type})`;
 sel.appendChild(opt);
 });
 if (id === 'sm-base-select') {
   const noBaseOpt = document.createElement('option');
   noBaseOpt.value = 'no_base';
   noBaseOpt.textContent = 'no base, record overlays only';
   sel.appendChild(noBaseOpt);
 }
 // Restore previous selection if still available
 if (id === 'sm-base-select' && prev === 'no_base') sel.value = 'no_base';
 else if (assetLibrary.find(a =>a.id === prev)) sel.value = prev;
 else sel.value = '';
 });
 if (typeof updateSmBaseModeUI === 'function') {
   const bs = document.getElementById('sm-base-select');
   if (bs) updateSmBaseModeUI(bs.value === 'no_base');
 }
}

window.saveBlobToLibrary = function(blob, name, type) {
  const finalName = getUniqueAssetName(name);
  const file = new File([blob], finalName, { type: blob.type });
  const id = `asset-${++assetIdCounter}`;
  const objectURL = URL.createObjectURL(file);
  assetLibrary.push({ id, name: finalName, type, objectURL, file });
  
  // Persist to IndexedDB so the file survives page refresh
  if (typeof dbSaveAsset === 'function') {
    dbSaveAsset(id, finalName, type, file);
  }
  
  renderLibrary();
  populateAllSelects();
  announce(`"${finalName}" saved directly to the library.`);
};

window.seekLibrary = function(seconds) {
  // 1. Check if audio preview is active
  const activeIds = Object.keys(activeLibraryAudios);
  if (activeIds.length > 0) {
    const id = activeIds[0];
    const aud = activeLibraryAudios[id];
    if (aud && aud.duration) {
      aud.currentTime = Math.max(0, Math.min(aud.duration, aud.currentTime + seconds));
      return true;
    }
  }

  // 2. Check if video preview is active
  const activeVid = document.querySelector('[id^="vid-prev-"]');
  if (activeVid && activeVid.duration && !activeVid.ended) {
    activeVid.currentTime = Math.max(0, Math.min(activeVid.duration, activeVid.currentTime + seconds));
    return true;
  }

  // 3. If file ended and user pressed ArrowLeft (seconds < 0), rewind to last 5 seconds and play!
  if (seconds < 0 && window.lastLibraryPreview && window.lastLibraryPreview.hasEnded) {
    const { id, type, asset } = window.lastLibraryPreview;
    const btn = document.getElementById(`btn-prev-${id}`);
    const replayBtn = document.getElementById(`btn-replay-${id}`);
    const stopBtn = document.getElementById(`btn-stop-${id}`);
    const container = document.getElementById(`preview-container-${id}`);

    if (type === 'audio') {
      stopAllLibraryPreviews();
      const aud = new Audio(asset.objectURL);
      activeLibraryAudios[id] = aud;
      window.lastLibraryPreview.hasEnded = false;
      window.lastLibraryPreview.aud = aud;

      const startPlaybackAtLast5 = () => {
        const startAt = Math.max(0, (aud.duration || 0) - 5);
        aud.currentTime = startAt;
        aud.play().catch(e => console.error(e));
      };

      if (aud.duration && !isNaN(aud.duration)) {
        startPlaybackAtLast5();
      } else {
        aud.onloadedmetadata = startPlaybackAtLast5;
        aud.play().catch(e => console.error(e));
      }

      aud.onended = () => {
        window.lastEndedPreview = 'library';
        window.lastLibraryPreview = { id, type: 'audio', aud, asset, hasEnded: true };
        delete activeLibraryAudios[id];
        if (btn) {
          btn.textContent = 'Play';
          btn.setAttribute('aria-label', `Play preview for ${asset.name}`);
        }
        if (replayBtn) replayBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'none';
      };

      if (btn) {
        btn.textContent = 'Pause';
        btn.setAttribute('aria-label', `Pause preview for ${asset.name}`);
      }
      if (replayBtn) replayBtn.style.display = 'inline-block';
      if (stopBtn) stopBtn.style.display = 'inline-block';
      return true;
    } else if (type === 'video') {
      stopAllLibraryPreviews();
      if (container) {
        container.hidden = false;
        container.innerHTML = `<video id="vid-prev-${id}" src="${asset.objectURL}" autoplay controls playsinline></video>`;
        const newVid = document.getElementById(`vid-prev-${id}`);
        if (newVid) {
          const startVidAtLast5 = () => {
            newVid.currentTime = Math.max(0, (newVid.duration || 0) - 5);
            newVid.play().catch(e => console.error(e));
          };
          if (newVid.duration && !isNaN(newVid.duration)) {
            startVidAtLast5();
          } else {
            newVid.onloadedmetadata = startVidAtLast5;
          }
          window.lastLibraryPreview.hasEnded = false;
          window.lastLibraryPreview.vid = newVid;

          newVid.onended = () => {
            window.lastEndedPreview = 'library';
            window.lastLibraryPreview = { id, type: 'video', asset, hasEnded: true };
            if (btn) {
              btn.textContent = 'Play Video';
              btn.setAttribute('aria-label', `Play video preview for ${asset.name}`);
            }
            if (replayBtn) replayBtn.style.display = 'none';
            if (stopBtn) stopBtn.style.display = 'none';
            container.innerHTML = '';
            container.hidden = true;
          };
        }
      }
      if (btn) {
        btn.textContent = 'Pause Video';
        btn.setAttribute('aria-label', `Pause video preview for ${asset.name}`);
      }
      if (replayBtn) replayBtn.style.display = 'inline-block';
      if (stopBtn) stopBtn.style.display = 'inline-block';
      return true;
    }
  }

  return false;
};

window.isLibraryPreviewing = function() {
  if (Object.keys(activeLibraryAudios).length > 0) return true;
  const activeVid = document.querySelector('[id^="vid-prev-"]');
  if (activeVid && !activeVid.paused && !activeVid.ended) return true;
  return false;
};

window.stopLibraryPreviews = function() {
  stopAllLibraryPreviews();
};
