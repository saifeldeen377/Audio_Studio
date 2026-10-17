// ─────────────────────────────────────────────────────────────
// TOOL 9 - Super Cut Audio (Live Cut)
// ─────────────────────────────────────────────────────────────

let sctTimer = null;
let sctPlaySource = null;
let sctPlayStartTime = 0;
let sctPlayOffset = 0;
let sctIsPlaying = false;
let sctBuffer = null;

let sctCutRegions = [];
let sctActiveCut = { start: null, end: null, id: null };
let sctLastAction = null;
let sctCutCounter = 0;

let sctPreviewNodes = [];
let issctPreviewing = false;
let sctPreviewStartTime = 0;
let sctPreviewPlayOffset = 0;
let sctLastPlayedWasPreview = false;
currentsctAssetId = null;
let sctIsLoading = false;
let sctScheduledCueNodes = [];

function initSuperCut() {
  const select = document.getElementById('sct-audio-select');
  const btnPlay = document.getElementById('btn-sct-play');
  const btnStop = document.getElementById('btn-sct-stop');
  const timeDisplay = document.getElementById('sct-time-display');
  const displayStart = document.getElementById('sct-start-display');
  const displayEnd = document.getElementById('sct-end-display');
  const manageList = document.getElementById('sct-manage-cuts-list');
  const cutsCountDisplay = document.getElementById('sct-cuts-count');
  
  const btnManageCuts = document.getElementById('btn-sct-manage-cuts');
  const btnManageClose = document.getElementById('btn-sct-manage-close');
  const btnManageDeleteAll = document.getElementById('btn-sct-delete-all');
  const manageDialog = document.getElementById('sct-manage-dialog');
  setupFocusTrap(manageDialog);
  
  const btnPreview = document.getElementById('btn-sct-preview');
  const btnExport = document.getElementById('btn-sct-export');
  const statusEl = document.getElementById('sct-status');
  const announcer = document.getElementById('sct-sr-announcer');

  const selectDeleteSeekMode = document.getElementById('sct-delete-seek-mode');
  const customSeekControls = document.getElementById('sct-custom-seek-controls');
  const selectSeekFullCut = document.getElementById('sct-seek-full-cut');
  const selectSeekCutEnd = document.getElementById('sct-seek-cut-end');
  const selectSeekCutStart = document.getElementById('sct-seek-cut-start');

  const STORAGE_KEY_SEEK_SETTINGS = 'audiostudio_sct_seek_settings';

  let sctSeekSettings = {
    mode: 'jump',
    fullCut: 'start',
    cutEnd: 'end',
    cutStart: 'start'
  };
  window.sctSeekSettings = sctSeekSettings;

  function syncSeekSettingsUI() {
    if (!selectDeleteSeekMode) return;
    selectDeleteSeekMode.value = sctSeekSettings.mode;
    if (selectSeekFullCut) selectSeekFullCut.value = sctSeekSettings.fullCut;
    if (selectSeekCutEnd) selectSeekCutEnd.value = sctSeekSettings.cutEnd;
    if (selectSeekCutStart) selectSeekCutStart.value = sctSeekSettings.cutStart;

    if (customSeekControls) {
      customSeekControls.style.display = (sctSeekSettings.mode === 'custom') ? 'block' : 'none';
    }
  }

  function loadSeekSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SEEK_SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          sctSeekSettings = { ...sctSeekSettings, ...parsed };
        }
      }
    } catch(e) {}
    syncSeekSettingsUI();
  }

  function saveSeekSettings() {
    try {
      localStorage.setItem(STORAGE_KEY_SEEK_SETTINGS, JSON.stringify(sctSeekSettings));
    } catch(e) {}
  }

  if (selectDeleteSeekMode) {
    selectDeleteSeekMode.addEventListener('change', () => {
      const mode = selectDeleteSeekMode.value;
      sctSeekSettings.mode = mode;
      if (mode === 'none') {
        sctSeekSettings.fullCut = 'none';
        sctSeekSettings.cutEnd = 'none';
        sctSeekSettings.cutStart = 'none';
      } else if (mode === 'jump') {
        sctSeekSettings.fullCut = 'start';
        sctSeekSettings.cutEnd = 'end';
        sctSeekSettings.cutStart = 'start';
      }
      syncSeekSettingsUI();
      saveSeekSettings();
    });
  }

  function onCustomSettingChange() {
    sctSeekSettings.mode = 'custom';
    sctSeekSettings.fullCut = selectSeekFullCut ? selectSeekFullCut.value : 'start';
    sctSeekSettings.cutEnd = selectSeekCutEnd ? selectSeekCutEnd.value : 'end';
    sctSeekSettings.cutStart = selectSeekCutStart ? selectSeekCutStart.value : 'start';
    syncSeekSettingsUI();
    saveSeekSettings();
  }

  if (selectSeekFullCut) selectSeekFullCut.addEventListener('change', onCustomSettingChange);
  if (selectSeekCutEnd) selectSeekCutEnd.addEventListener('change', onCustomSettingChange);
  if (selectSeekCutStart) selectSeekCutStart.addEventListener('change', onCustomSettingChange);

  loadSeekSettings();

  const btnEnter = document.getElementById('btn-enter-super-cut');
  const btnClose = document.getElementById('btn-close-super-cut');
  const overlay = document.getElementById('super-cut-overlay');
  const mainApp = document.querySelector('main');
  const footerApp = document.querySelector('footer');
  const container = overlay.querySelector('.sm-container');

  const btnCalibrate = document.getElementById('btn-sct-calibrate-headphones');
  if (btnCalibrate) {
    btnCalibrate.addEventListener('click', () => {
      if (typeof window.openHeadphoneCalibration === 'function') {
        window.openHeadphoneCalibration(btnCalibrate);
      }
    });
  }

  setupFocusTrap(overlay);

  btnEnter.addEventListener('click', () =>{
    overlay.hidden = false;
    overlay.style.display = 'flex';
    setAppBackgroundInert(true);
    updateAllLatencyDisplays();
    container.focus();
  });

  btnManageCuts.addEventListener('click', () =>{
    manageDialog.showModal();
    if (sctCutRegions.length === 0 && (sctActiveCut.start === null || sctActiveCut.end === null)) {
      announce('There are no cuts registered to manage or delete.', true);
    }
    
    // Focus the first remove button, or fallback to close button
    const firstRemoveBtn = document.querySelector('#sct-manage-cuts-list button.btn-danger');
    if (firstRemoveBtn) {
      firstRemoveBtn.focus();
    } else {
      btnManageClose.focus();
    }
  });

  btnManageClose.addEventListener('click', () =>{
    manageDialog.close();
    btnManageCuts.focus();
  });

  btnManageDeleteAll.addEventListener('click', () =>{
    if (!confirm('Are you sure you want to delete all cuts?')) return;
    clearScheduledCues();
    sctCutRegions = [];
    sctActiveCut = { start: null, end: null, id: null };
    sctLastAction = null;
    displayStart.textContent = 'Not set';
    displayEnd.textContent = 'Not set';
    renderCutsTable();
    announce('All cuts have been deleted.');
    btnManageClose.focus();
  });

  // Global key listener for c
  window.addEventListener('keydown', (e) =>{
    const tag = (e.target && e.target.tagName ? e.target.tagName : '').toLowerCase();
    if (tag === 'input'|| tag === 'textarea'|| tag === 'select') return;

    if (e.key.toLowerCase() === 'c'&& (overlay.hidden || overlay.style.display === 'none')) {
      const smOverlay = document.getElementById('super-mode-overlay');
      const stOverlay = document.getElementById('super-trim-overlay');
      if ((smOverlay && !smOverlay.hidden) || (stOverlay && !stOverlay.hidden)) return;
      e.preventDefault();
      btnEnter.click();
    }
  });

  btnClose.addEventListener('click', () =>{
    clearScheduledCues();
    stopAudio();
    stopPreview();
    overlay.hidden = true;
    overlay.style.display = 'none';
    setAppBackgroundInert(false);
    btnEnter.focus();
  });

  select.addEventListener('change', () =>{
    clearScheduledCues();
    stopAudio();
    stopPreview();
    sctBuffer = null;
    sctCutRegions = [];
    sctActiveCut = { start: null, end: null, id: null };
    sctLastAction = null;
    displayStart.textContent = 'Not set';
    displayEnd.textContent = 'Not set';
    renderCutsTable();
  });


  function formatTime(secs) {
    return Number(secs).toFixed(3) + "s";
  }

  function getAbsoluteTimeFromPreview(relativeTime) {
    const keepRegions = getKeepRegions(sctBuffer ? sctBuffer.duration : 0);
    let accumulated = 0;
    for (let region of keepRegions) {
      const dur = region.end - region.start;
      if (relativeTime <= accumulated + dur) {
        return region.start + (relativeTime - accumulated);
      }
      accumulated += dur;
    }
    return sctBuffer ? sctBuffer.duration : 0;
  }

  function getCurrentTime() {
    if (sctIsPlaying) {
      return sctPlayOffset + (getAudioCtx().currentTime - sctPlayStartTime);
    }
    if (issctPreviewing) {
      let relativeTime = sctPreviewPlayOffset + (getAudioCtx().currentTime - sctPreviewStartTime);
      return getAbsoluteTimeFromPreview(relativeTime);
    }
    return sctPlayOffset;
  }

  function updateTimeDisplay() {
    timeDisplay.textContent = formatTime(getCurrentTime());
  }

  function stopAudio() {
    clearScheduledCues();
    if (sctPlaySource) {
      sctPlaySource.onended = null;
      try { sctPlaySource.stop(); } catch(e) {}
      sctPlaySource = null;
    }
    sctIsPlaying = false;
    sctPlayOffset = 0;
    clearInterval(sctTimer);
    updateTimeDisplay();
    btnPlay.textContent = "Play (Space)";
    if (document.activeElement === btnStop) { btnPlay.focus(); }
    btnStop.disabled = true;
    sctLastPlayedWasPreview = false;
  }

  function seekTo(targetTime, forcePlay = null) {
    if (!sctBuffer) return;

    let newOffset = Math.max(0, Math.min(targetTime, sctBuffer.duration - 0.05));

    clearScheduledCues();
    if (sctPlaySource) {
      sctPlaySource.onended = null;
      try { sctPlaySource.stop(); } catch(e) {}
      sctPlaySource = null;
    }

    const shouldPlay = (forcePlay !== null) ? forcePlay : sctIsPlaying;
    sctPlayOffset = newOffset;

    if (shouldPlay) {
      const ctx = getAudioCtx();
      sctPlaySource = ctx.createBufferSource();
      sctPlaySource.buffer = sctBuffer;
      sctPlaySource.connect(masterCompressor);

      sctPlaySource.start(0, sctPlayOffset);
      sctPlayStartTime = ctx.currentTime;
      sctIsPlaying = true;
      sctLastPlayedWasPreview = false;
      scheduleCutCues();

      btnPlay.textContent = "Pause (Space)";
      btnStop.disabled = false;
      clearInterval(sctTimer);
      sctTimer = setInterval(updateTimeDisplay, 100);

      sctPlaySource.onended = () =>{
        clearScheduledCues();
        if (!sctIsPlaying) return; 
        sctIsPlaying = false;
        sctPlayOffset = sctBuffer.duration;
        btnPlay.textContent = "Play (Space)";
        if (document.activeElement === btnStop) { btnPlay.focus(); }
        btnStop.disabled = true;
        clearInterval(sctTimer);
        updateTimeDisplay();
      };
    } else {
      sctIsPlaying = false;
      btnPlay.textContent = "Play (Space)";
      clearInterval(sctTimer);
    }

    updateTimeDisplay();
  }

  function seekAudio(seconds) {
    if (!sctBuffer) return;
    let current = sctIsPlaying ? getCurrentTime() : sctPlayOffset;
    seekTo(current + seconds, true);
  }

  async function togglePlay() {
    if (window.sctDeletedAssetName) {
      const proceed = confirm(`The file "${window.sctDeletedAssetName}" was deleted from the library. Do you want to continue without it?`);
      if (!proceed) return;
      window.sctDeletedAssetName = null;
    }
    if (!select.value) {
      alert("Please select an audio file first.");
      return;
    }
    if (sctIsLoading) {
      announce("Please wait, the audio file is currently loading...", true);
      return;
    }
    if (issctPreviewing) {
      stopPreview();
      return;
    }
    
    if (sctIsPlaying) {
      clearScheduledCues();
      sctPlayOffset += getAudioCtx().currentTime - sctPlayStartTime;
      if (sctPlaySource) {
        sctPlaySource.onended = null;
        try { sctPlaySource.stop(); } catch(e) {}
        sctPlaySource = null;
      }
      sctIsPlaying = false;
      btnPlay.textContent = "Resume (Space)";
      clearInterval(sctTimer);
    } else {
      const targetAsset = getAsset(select.value);
      const targetSize = (targetAsset && (targetAsset.file?.size || targetAsset.size)) || 1000000;

      sctIsLoading = true;
      let loadingAnnounceTimer = null;

      if (targetSize > 30 * 1024 * 1024) {
        btnPlay.textContent = "Loading... Please wait";
        announce("Loading audio file... Please wait.");
        loadingAnnounceTimer = setInterval(() => {
          announce("Loading... Please wait.");
        }, 5000);
      }

      try {
        if (currentsctAssetId !== select.value || !sctBuffer) {
          sctBuffer = await decodeAudio(targetAsset.objectURL);
          currentsctAssetId = select.value;
          sctPlayOffset = 0;
        }
      } catch (err) {
        if (loadingAnnounceTimer) clearInterval(loadingAnnounceTimer);
        statusEl.textContent = "Error loading audio file.";
        btnPlay.textContent = "Play (Space)";
        sctIsLoading = false;
        return;
      }

      if (loadingAnnounceTimer) clearInterval(loadingAnnounceTimer);
      sctIsLoading = false;
      statusEl.textContent = "";

      if (sctPlayOffset >= sctBuffer.duration) sctPlayOffset = 0;

      const ctx = getAudioCtx();
      if (ctx.state === 'suspended') { await ctx.resume(); }
      sctPlaySource = ctx.createBufferSource();
      sctPlaySource.buffer = sctBuffer;
      sctPlaySource.connect(masterCompressor); 
      
      sctPlaySource.start(0, sctPlayOffset);
      sctPlayStartTime = ctx.currentTime;
      sctIsPlaying = true;
      sctLastPlayedWasPreview = false;
      scheduleCutCues();
      
      btnPlay.textContent = "Pause (Space)";
      btnStop.disabled = false;
      sctTimer = setInterval(updateTimeDisplay, 100);

      sctPlaySource.onended = () =>{
        clearScheduledCues();
        if (!sctIsPlaying) return; 
        sctIsPlaying = false;
        sctPlayOffset = sctBuffer.duration;
        btnPlay.textContent = "Play (Space)";
        if (document.activeElement === btnStop) { btnPlay.focus(); }
        btnStop.disabled = true;
        clearInterval(sctTimer);
        updateTimeDisplay();
      };
    }
  }

  btnPlay.addEventListener('click', togglePlay);
  btnStop.addEventListener('click', () =>{ stopAudio(); stopPreview(); });

  function clearScheduledCues() {
    for (let i = 0; i < sctScheduledCueNodes.length; i++) {
      try {
        sctScheduledCueNodes[i].stop();
        sctScheduledCueNodes[i].disconnect();
      } catch (e) {}
    }
    sctScheduledCueNodes = [];
  }

  function scheduleSingleCue(when, isStart) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isStart ? 1200 : 800, when);
      osc.frequency.exponentialRampToValueAtTime(100, when + 0.03);
      gain.gain.setValueAtTime(0.5, when);
      gain.gain.exponentialRampToValueAtTime(0.01, when + 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(when);
      osc.stop(when + 0.03);
      sctScheduledCueNodes.push(osc);
    } catch (e) {}
  }

  function scheduleCutCues() {
    clearScheduledCues();
    if (!sctIsPlaying || !sctBuffer) return;

    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const currentOffset = sctPlayOffset + (now - sctPlayStartTime);

    const cuts = [...sctCutRegions];
    if (sctActiveCut.start !== null && sctActiveCut.end !== null && sctActiveCut.end < sctBuffer.duration) {
      if (!cuts.some(c => c.id === sctActiveCut.id)) {
        cuts.push(sctActiveCut);
      }
    }

    for (const cut of cuts) {
      if (cut.start !== null && cut.start > currentOffset + 0.02) {
        const triggerTime = now + (cut.start - currentOffset);
        scheduleSingleCue(triggerTime, true);
      }
      if (cut.end !== null && cut.end > currentOffset + 0.02 && cut.end <= sctBuffer.duration) {
        const triggerTime = now + (cut.end - currentOffset);
        scheduleSingleCue(triggerTime, false);
      }
    }
  }

  window.sctScheduleCutCues = scheduleCutCues;
  window.sctClearScheduledCues = clearScheduledCues;

  function playClickSound(isStart) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isStart ? 1200 : 800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.03);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.03);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.03);
  }

  function playDeleteBeep() {
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.02);
    } catch (e) {}
  }

  function markStart() {
    if (!sctBuffer) return;
    let curr = getCurrentTime();
    const useComp = document.getElementById('sct-headphone-compensation')?.checked ?? true;
    if (sctIsPlaying && useComp && amsHeadphoneLatencySec > 0) {
      curr = Math.max(0, curr - amsHeadphoneLatencySec);
    }
    
    if (sctLastAction === 'awaiting_start' && sctActiveCut.end !== null) {
      if (curr >= sctActiveCut.end) {
        announce(`Start time cannot be after cut end (${sctActiveCut.end.toFixed(2)}s).`, true);
        return;
      }
      sctActiveCut.start = curr;
      const idx = sctCutRegions.findIndex(c => c.id === sctActiveCut.id);
      if (idx === -1) {
        sctCutRegions.push({ ...sctActiveCut });
      } else {
        sctCutRegions[idx] = { ...sctActiveCut };
      }
      displayStart.textContent = sctActiveCut.start.toFixed(2) + "s";
      displayEnd.textContent = sctActiveCut.end.toFixed(2) + "s";
      sctLastAction = 'end';
      renderCutsTable();
      scheduleCutCues();
      playClickSound(true);
      announce(`Updated cut from ${sctActiveCut.start.toFixed(2)}s to ${sctActiveCut.end.toFixed(2)}s.`, true);
      displayStart.style.backgroundColor = "rgba(40, 167, 69, 0.4)";
      setTimeout(() => displayStart.style.backgroundColor = "", 300);
      return;
    }

    if (sctLastAction === 'end') {
      sctActiveCut = { start: null, end: null, id: null };
    }

    sctActiveCut.start = curr;
    if (sctActiveCut.end === null) sctActiveCut.end = sctBuffer.duration;

    if (!sctActiveCut.id) sctActiveCut.id = 'cut-'+ (++sctCutCounter);

    displayStart.textContent = sctActiveCut.start.toFixed(2) + "s";
    displayEnd.textContent = sctActiveCut.end.toFixed(2) + "s";
    sctLastAction = 'start';

    renderCutsTable();
    scheduleCutCues();

    playClickSound(true);
    displayStart.style.backgroundColor = "rgba(40, 167, 69, 0.4)";
    setTimeout(() =>displayStart.style.backgroundColor = "", 300);
  }

  function markEnd() {
    if (!sctBuffer) return;
    let curr = getCurrentTime();
    const useComp = document.getElementById('sct-headphone-compensation')?.checked ?? true;
    if (sctIsPlaying && useComp && amsHeadphoneLatencySec > 0) {
      curr = Math.max(0, curr - amsHeadphoneLatencySec);
    }
    
    if (sctLastAction === null) {
      sctActiveCut.start = 0;
    }

    if (curr <= sctActiveCut.start) {
      announce("End time cannot be before start time.");
      return;
    }

    sctActiveCut.end = curr;
    if (sctActiveCut.start === null) sctActiveCut.start = 0;

    if (!sctActiveCut.id) sctActiveCut.id = 'cut-'+ (++sctCutCounter);

    const idx = sctCutRegions.findIndex(c =>c.id === sctActiveCut.id);
    if (idx === -1) {
      sctCutRegions.push({ ...sctActiveCut });
    } else {
      sctCutRegions[idx] = { ...sctActiveCut };
    }
    
    displayStart.textContent = sctActiveCut.start.toFixed(2) + "s";
    displayEnd.textContent = sctActiveCut.end.toFixed(2) + "s";
    sctLastAction = 'end';
    sctActiveCut = { start: null, end: null, id: null };

    renderCutsTable();
    scheduleCutCues();

    playClickSound(false);
    displayEnd.style.backgroundColor = "rgba(220, 53, 69, 0.4)";
    setTimeout(() =>displayEnd.style.backgroundColor = "", 300);
  }

  function renderCutsTable() {
    sctCutRegions.sort((a, b) =>a.start - b.start);
    
    cutsCountDisplay.textContent = sctCutRegions.length;

    if (sctCutRegions.length === 0) {
      btnManageDeleteAll.style.display = 'none';
    } else {
      btnManageDeleteAll.style.display = 'inline-block';
    }

    if (sctCutRegions.length === 0 && sctActiveCut.start === null && sctActiveCut.end === null) {
      manageList.innerHTML = '<p id="sct-cuts-empty" class="empty-cell" style="text-align: center; color: var(--text-muted);">No cuts defined yet.</p>';
      return;
    }

    manageList.innerHTML = '';
    
    let count = 1;
    sctCutRegions.forEach((cut) =>{
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.padding = '10px';
      item.style.borderBottom = '1px solid var(--border)';
      
      const isCurrentActive = (cut.id === sctActiveCut.id);
      if (isCurrentActive) {
        item.style.backgroundColor = "rgba(124, 111, 255, 0.1)"; 
      }
      
      const infoSpan = document.createElement('span');
      infoSpan.textContent = `Cut ${count++}: ${cut.start.toFixed(2)}s to ${cut.end.toFixed(2)}s`;
      
      const actionsDiv = document.createElement('div');
      actionsDiv.style.display = 'flex';
      actionsDiv.style.gap = '10px';
      
      const btnPreviewCut = document.createElement('button');
      btnPreviewCut.className = 'btn btn-success btn-sm';
      btnPreviewCut.textContent = 'Preview';
      btnPreviewCut.setAttribute('aria-label', `Preview cut from ${cut.start.toFixed(2)}s to ${cut.end.toFixed(2)}s`);
      
      let localCutPreviewSrc = null;
      let localCutIsPreviewing = false;
      
      btnPreviewCut.addEventListener('click', async () =>{
        if (localCutIsPreviewing) {
            if (localCutPreviewSrc) {
                localCutPreviewSrc.onended = null;
                try { localCutPreviewSrc.stop(); } catch(e) {}
                localCutPreviewSrc = null;
            }
            localCutIsPreviewing = false;
            btnPreviewCut.textContent = 'Preview';
            btnPreviewCut.setAttribute('aria-label', `Preview cut from ${cut.start.toFixed(2)}s to ${cut.end.toFixed(2)}s`);
            return;
        }
        
        if (sctIsPlaying) stopAudio();
        if (issctPreviewing) stopPreview();

        const ctx = getAudioCtx();
        if (ctx.state === 'suspended') { await ctx.resume(); }

        localCutPreviewSrc = ctx.createBufferSource();
        localCutPreviewSrc.buffer = sctBuffer;
        localCutPreviewSrc.connect(masterCompressor);
        
        let playDur = cut.end - cut.start;
        localCutPreviewSrc.start(0, cut.start, playDur);
        localCutIsPreviewing = true;
        
        btnPreviewCut.textContent = 'Stop';
        btnPreviewCut.setAttribute('aria-label', `Stop preview of cut from ${cut.start.toFixed(2)}s to ${cut.end.toFixed(2)}s`);
        
        localCutPreviewSrc.onended = () =>{
            localCutIsPreviewing = false;
            localCutPreviewSrc = null;
            btnPreviewCut.textContent = 'Preview';
            btnPreviewCut.setAttribute('aria-label', `Preview cut from ${cut.start.toFixed(2)}s to ${cut.end.toFixed(2)}s`);
        };
      });
      
      const btnRemove = document.createElement('button');
      btnRemove.className = 'btn btn-danger btn-sm';
      btnRemove.textContent = 'Remove';
      btnRemove.setAttribute('aria-label', `Remove cut from ${cut.start.toFixed(2)} to ${cut.end.toFixed(2)}`);
      
      btnRemove.addEventListener('click', () =>{
        sctCutRegions = sctCutRegions.filter(c =>c.id !== cut.id);
        announce(`Removed cut from ${cut.start.toFixed(2)} to ${cut.end.toFixed(2)}`);
        if (localCutPreviewSrc) {
            try { localCutPreviewSrc.stop(); } catch(e) {}
        }
        
        let nextFocus = item.nextElementSibling?.querySelector('.btn-danger');
        if (!nextFocus) nextFocus = item.previousElementSibling?.querySelector('.btn-danger');
        if (!nextFocus) nextFocus = btnManageClose;

        item.remove();
        cutsCountDisplay.textContent = sctCutRegions.length;

        if (cut.id === sctActiveCut.id) {
          sctActiveCut = { start: null, end: null, id: null };
          sctLastAction = null;
          displayStart.textContent = 'Not set';
          displayEnd.textContent = 'Not set';
        }
        scheduleCutCues();
        
        if (sctCutRegions.length === 0 && sctActiveCut.start === null && sctActiveCut.end === null) {
            renderCutsTable();
            btnManageClose.focus();
        } else {
            let counter = 1;
            manageList.querySelectorAll('div >span').forEach(span =>{
                if (!span.textContent.includes('Active') && !span.textContent.includes('Awaiting')) {
                    const textParts = span.textContent.split(':');
                    textParts[0] = `Cut ${counter++}`;
                    span.textContent = textParts.join(':');
                }
            });
            nextFocus?.focus();
        }
      });
      
      actionsDiv.appendChild(btnPreviewCut);
      actionsDiv.appendChild(btnRemove);
      
      item.appendChild(infoSpan);
      item.appendChild(actionsDiv);
      manageList.appendChild(item);
    });

    if (sctActiveCut.start !== null && !sctCutRegions.find(c =>c.id === sctActiveCut.id)) {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.padding = '10px';
      item.style.borderBottom = '1px solid var(--border)';
      item.style.backgroundColor = "rgba(124, 111, 255, 0.1)"; 
      
      const infoSpan = document.createElement('span');
      infoSpan.textContent = `Cut ${count} (Active): ${sctActiveCut.start.toFixed(2)}s to end of file`;
      
      const actionsDiv = document.createElement('div');
      actionsDiv.style.display = 'flex';
      actionsDiv.style.gap = '10px';
      
      const btnCancel = document.createElement('button');
      btnCancel.className = 'btn btn-danger btn-sm';
      btnCancel.textContent = 'Cancel';
      btnCancel.setAttribute('aria-label', `Cancel active cut from ${sctActiveCut.start.toFixed(2)} to the end of the file`);
      
      btnCancel.addEventListener('click', () =>{
        announce(`Cancelled active cut starting at ${sctActiveCut.start.toFixed(2)}`);
        sctActiveCut = { start: null, end: null, id: null };
        sctLastAction = null;
        displayStart.textContent = 'Not set';
        displayEnd.textContent = 'Not set';
        scheduleCutCues();
        
        let nextFocus = item.previousElementSibling?.querySelector('.btn-danger');
        if (!nextFocus) nextFocus = btnManageClose;
        
        item.remove();
        
        if (sctCutRegions.length === 0) {
            renderCutsTable();
            btnManageClose.focus();
        } else {
            nextFocus?.focus();
        }
      });
      
      actionsDiv.appendChild(btnCancel);
      item.appendChild(infoSpan);
      item.appendChild(actionsDiv);
      manageList.appendChild(item);
    } else if (sctActiveCut.end !== null && sctLastAction === 'awaiting_start' && !sctCutRegions.find(c => c.id === sctActiveCut.id)) {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.padding = '10px';
      item.style.borderBottom = '1px solid var(--border)';
      item.style.backgroundColor = "rgba(124, 111, 255, 0.1)"; 
      
      const infoSpan = document.createElement('span');
      infoSpan.textContent = `Cut ${count} (Awaiting start): Not set to ${sctActiveCut.end.toFixed(2)}s`;
      
      const actionsDiv = document.createElement('div');
      actionsDiv.style.display = 'flex';
      actionsDiv.style.gap = '10px';
      
      const btnCancel = document.createElement('button');
      btnCancel.className = 'btn btn-danger btn-sm';
      btnCancel.textContent = 'Cancel';
      btnCancel.setAttribute('aria-label', `Cancel cut awaiting start up to ${sctActiveCut.end.toFixed(2)}s`);
      
      btnCancel.addEventListener('click', () =>{
        announce(`Cancelled cut with end at ${sctActiveCut.end.toFixed(2)}s`);
        sctActiveCut = { start: null, end: null, id: null };
        sctLastAction = null;
        displayStart.textContent = 'Not set';
        displayEnd.textContent = 'Not set';
        scheduleCutCues();
        
        let nextFocus = item.previousElementSibling?.querySelector('.btn-danger');
        if (!nextFocus) nextFocus = btnManageClose;
        
        item.remove();
        
        if (sctCutRegions.length === 0) {
            renderCutsTable();
            btnManageClose.focus();
        } else {
            nextFocus?.focus();
        }
      });
      
      actionsDiv.appendChild(btnCancel);
      item.appendChild(infoSpan);
      item.appendChild(actionsDiv);
      manageList.appendChild(item);
    }
  }

  function getAllSortedCuts() {
    const list = sctCutRegions.map(c => ({ ...c, source: 'region' }));
    if (sctActiveCut.start !== null && !list.some(c => c.id === sctActiveCut.id)) {
      list.push({
        id: sctActiveCut.id || 'active',
        start: sctActiveCut.start,
        end: sctActiveCut.end !== null ? sctActiveCut.end : (sctBuffer ? sctBuffer.duration : 0),
        source: 'active'
      });
    } else if (sctActiveCut.end !== null && sctLastAction === 'awaiting_start' && !list.some(c => c.id === sctActiveCut.id)) {
      list.push({
        id: sctActiveCut.id || 'active',
        start: 0,
        end: sctActiveCut.end,
        source: 'active'
      });
    }
    return list.sort((a, b) => a.start - b.start);
  }

  function deletePreviousCut() {
    const curr = getCurrentTime();
    const cuts = getAllSortedCuts();
    if (cuts.length === 0) {
      announce("No cuts defined to delete.", true);
      return;
    }

    let target = cuts.find(c => c.start <= curr + 0.05 && curr <= c.end + 0.05);
    if (!target) {
      const pastCuts = cuts.filter(c => c.start < curr - 0.05);
      if (pastCuts.length > 0) {
        target = pastCuts[pastCuts.length - 1];
      }
    }

    if (!target) {
      announce("No previous cut found.", true);
      return;
    }

    const jumpMode = sctSeekSettings.fullCut;

    if (target.source === 'active') {
      const s = sctActiveCut.start;
      sctActiveCut = { start: null, end: null, id: null };
      sctLastAction = null;
      displayStart.textContent = 'Not set';
      displayEnd.textContent = 'Not set';
      renderCutsTable();
      scheduleCutCues();
      playDeleteBeep();
      if (jumpMode === 'start' && s !== null) {
        seekTo(s);
      }
    } else {
      const cutStart = target.start;
      sctCutRegions = sctCutRegions.filter(c => c.id !== target.id);
      if (sctActiveCut.id === target.id) {
        sctActiveCut = { start: null, end: null, id: null };
        sctLastAction = null;
        displayStart.textContent = 'Not set';
        displayEnd.textContent = 'Not set';
      }
      renderCutsTable();
      scheduleCutCues();
      playDeleteBeep();
      if (jumpMode === 'start') {
        seekTo(cutStart);
      }
    }
  }

  function deleteNextCut() {
    const curr = getCurrentTime();
    const cuts = getAllSortedCuts();
    if (cuts.length === 0) {
      announce("No cuts defined to delete.", true);
      return;
    }

    const futureCuts = cuts.filter(c => c.start > curr + 0.05);
    if (futureCuts.length === 0) {
      announce("No next cut found.", true);
      return;
    }

    const target = futureCuts[0];
    const jumpMode = sctSeekSettings.fullCut;

    if (target.source === 'active') {
      const s = sctActiveCut.start;
      sctActiveCut = { start: null, end: null, id: null };
      sctLastAction = null;
      displayStart.textContent = 'Not set';
      displayEnd.textContent = 'Not set';
      renderCutsTable();
      scheduleCutCues();
      playDeleteBeep();
      if (jumpMode === 'start' && s !== null) {
        seekTo(s);
      }
    } else {
      const cutStart = target.start;
      sctCutRegions = sctCutRegions.filter(c => c.id !== target.id);
      if (sctActiveCut.id === target.id) {
        sctActiveCut = { start: null, end: null, id: null };
        sctLastAction = null;
        displayStart.textContent = 'Not set';
        displayEnd.textContent = 'Not set';
      }
      renderCutsTable();
      scheduleCutCues();
      playDeleteBeep();
      if (jumpMode === 'start') {
        seekTo(cutStart);
      }
    }
  }

  function deletePreviousEnd() {
    const curr = getCurrentTime();
    const ends = sctCutRegions.map(c => ({ id: c.id, start: c.start, end: c.end, source: 'region' }));
    if (sctActiveCut.end !== null && sctLastAction === 'awaiting_start') {
      ends.push({ id: sctActiveCut.id, start: sctActiveCut.start, end: sctActiveCut.end, source: 'active' });
    }
    ends.sort((a, b) => a.end - b.end);

    if (ends.length === 0) {
      announce("No cut ends defined to delete.", true);
      return;
    }

    const pastEnds = ends.filter(c => c.end <= curr + 0.05);
    if (pastEnds.length === 0) {
      announce("No previous cut end found.", true);
      return;
    }

    const target = pastEnds[pastEnds.length - 1];
    const jumpMode = sctSeekSettings.cutEnd;

    if (target.source === 'active') {
      const oldEnd = target.end;
      sctActiveCut = { start: null, end: null, id: null };
      sctLastAction = null;
      displayStart.textContent = 'Not set';
      displayEnd.textContent = 'Not set';
      renderCutsTable();
      scheduleCutCues();
      playDeleteBeep();
      if (jumpMode === 'end' || jumpMode === 'start') {
        seekTo(oldEnd);
      }
    } else {
      const oldEnd = target.end;
      const oldStart = target.start;
      sctCutRegions = sctCutRegions.filter(c => c.id !== target.id);
      sctActiveCut = { start: oldStart, end: sctBuffer ? sctBuffer.duration : null, id: target.id };
      sctLastAction = 'start';
      displayStart.textContent = oldStart.toFixed(2) + "s";
      displayEnd.textContent = "Not set";
      renderCutsTable();
      scheduleCutCues();
      playDeleteBeep();

      let jumpTarget = null;
      if (jumpMode === 'end') jumpTarget = oldEnd;
      else if (jumpMode === 'start') jumpTarget = oldStart;

      if (jumpTarget !== null) {
        seekTo(jumpTarget);
      }
    }
  }

  function deleteNextEnd() {
    const curr = getCurrentTime();
    const ends = sctCutRegions.map(c => ({ id: c.id, start: c.start, end: c.end, source: 'region' }));
    if (sctActiveCut.end !== null && sctLastAction === 'awaiting_start') {
      ends.push({ id: sctActiveCut.id, start: sctActiveCut.start, end: sctActiveCut.end, source: 'active' });
    }
    ends.sort((a, b) => a.end - b.end);

    if (ends.length === 0) {
      announce("No cut ends defined to delete.", true);
      return;
    }

    const futureEnds = ends.filter(c => c.end > curr + 0.05);
    if (futureEnds.length === 0) {
      announce("No next cut end found.", true);
      return;
    }

    const target = futureEnds[0];
    const jumpMode = sctSeekSettings.cutEnd;

    if (target.source === 'active') {
      const oldEnd = target.end;
      sctActiveCut = { start: null, end: null, id: null };
      sctLastAction = null;
      displayStart.textContent = 'Not set';
      displayEnd.textContent = 'Not set';
      renderCutsTable();
      scheduleCutCues();
      playDeleteBeep();
      if (jumpMode === 'end' || jumpMode === 'start') {
        seekTo(oldEnd);
      }
    } else {
      const oldEnd = target.end;
      const oldStart = target.start;
      sctCutRegions = sctCutRegions.filter(c => c.id !== target.id);
      sctActiveCut = { start: oldStart, end: sctBuffer ? sctBuffer.duration : null, id: target.id };
      sctLastAction = 'start';
      displayStart.textContent = oldStart.toFixed(2) + "s";
      displayEnd.textContent = "Not set";
      renderCutsTable();
      scheduleCutCues();
      playDeleteBeep();

      let jumpTarget = null;
      if (jumpMode === 'end') jumpTarget = oldEnd;
      else if (jumpMode === 'start') jumpTarget = oldStart;

      if (jumpTarget !== null) {
        seekTo(jumpTarget);
      }
    }
  }

  function deletePreviousStart() {
    const curr = getCurrentTime();
    const starts = sctCutRegions.map(c => ({ id: c.id, start: c.start, end: c.end, source: 'region' }));
    if (sctActiveCut.start !== null && !starts.some(c => c.id === sctActiveCut.id)) {
      starts.push({ id: sctActiveCut.id || 'active', start: sctActiveCut.start, end: sctActiveCut.end, source: 'active' });
    }
    starts.sort((a, b) => a.start - b.start);

    if (starts.length === 0) {
      announce("No cut starts defined to delete.", true);
      return;
    }

    const pastStarts = starts.filter(c => c.start <= curr + 0.05);
    if (pastStarts.length === 0) {
      announce("No previous cut start found.", true);
      return;
    }

    const target = pastStarts[pastStarts.length - 1];
    const jumpMode = sctSeekSettings.cutStart;

    if (target.source === 'active') {
      const oldStart = target.start;
      sctActiveCut = { start: null, end: null, id: null };
      sctLastAction = null;
      displayStart.textContent = 'Not set';
      displayEnd.textContent = 'Not set';
      renderCutsTable();
      scheduleCutCues();
      playDeleteBeep();
      if (jumpMode === 'start') {
        seekTo(oldStart);
      }
    } else {
      const oldStart = target.start;
      const preservedEnd = target.end;
      sctCutRegions = sctCutRegions.filter(c => c.id !== target.id);
      sctActiveCut = { start: null, end: preservedEnd, id: target.id };
      sctLastAction = 'awaiting_start';
      displayStart.textContent = "Not set";
      displayEnd.textContent = preservedEnd.toFixed(2) + "s";
      renderCutsTable();
      scheduleCutCues();
      playDeleteBeep();

      let jumpTarget = null;
      if (jumpMode === 'start') jumpTarget = oldStart;
      else if (jumpMode === 'end') jumpTarget = preservedEnd;

      if (jumpTarget !== null) {
        seekTo(jumpTarget);
      }
    }
  }

  function deleteNextStart() {
    const curr = getCurrentTime();
    const starts = sctCutRegions.map(c => ({ id: c.id, start: c.start, end: c.end, source: 'region' }));
    if (sctActiveCut.start !== null && !starts.some(c => c.id === sctActiveCut.id)) {
      starts.push({ id: sctActiveCut.id || 'active', start: sctActiveCut.start, end: sctActiveCut.end, source: 'active' });
    }
    starts.sort((a, b) => a.start - b.start);

    if (starts.length === 0) {
      announce("No cut starts defined to delete.", true);
      return;
    }

    const futureStarts = starts.filter(c => c.start > curr + 0.05);
    if (futureStarts.length === 0) {
      announce("No next cut start found.", true);
      return;
    }

    const target = futureStarts[0];
    const jumpMode = sctSeekSettings.cutStart;

    if (target.source === 'active') {
      const oldStart = target.start;
      sctActiveCut = { start: null, end: null, id: null };
      sctLastAction = null;
      displayStart.textContent = 'Not set';
      displayEnd.textContent = 'Not set';
      renderCutsTable();
      scheduleCutCues();
      playDeleteBeep();
      if (jumpMode === 'start') {
        seekTo(oldStart);
      }
    } else {
      const oldStart = target.start;
      const preservedEnd = target.end;
      sctCutRegions = sctCutRegions.filter(c => c.id !== target.id);
      sctActiveCut = { start: null, end: preservedEnd, id: target.id };
      sctLastAction = 'awaiting_start';
      displayStart.textContent = "Not set";
      displayEnd.textContent = preservedEnd.toFixed(2) + "s";
      renderCutsTable();
      scheduleCutCues();
      playDeleteBeep();

      let jumpTarget = null;
      if (jumpMode === 'start') jumpTarget = oldStart;
      else if (jumpMode === 'end') jumpTarget = preservedEnd;

      if (jumpTarget !== null) {
        seekTo(jumpTarget);
      }
    }
  }

  // Global Keyboard listener ONLY when overlay is active
  document.addEventListener('keydown', (e) =>{
    if (overlay.hidden) return;

    const code = e.code;
    const key = e.key.toLowerCase();
    
    if (manageDialog.open) {
      if (code === 'Escape') {
        e.preventDefault();
        manageDialog.close();
        btnManageCuts.focus();
      }
      return;
    }

    if (code === 'Escape') {
      e.preventDefault();
      btnClose.click();
      return;
    }

    // Space key: directly toggle playback unless interacting with a checkbox/radio or typing in a text field
    if (code === 'Space') {
      if (e.target.tagName === 'INPUT' && (e.target.type === 'checkbox' || e.target.type === 'radio')) {
        return;
      }
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      e.preventDefault();
      togglePlay();
      return;
    }

    const isCtrl = e.ctrlKey;
    const isShift = e.shiftKey;
    const isAlt = e.altKey;

    // For SELECT dropdowns: allow native Up/Down/Enter to select options, but don't block shortcut keys
    if (e.target.tagName === 'SELECT') {
      if ((code === 'ArrowUp' || code === 'ArrowDown') && !isCtrl && !isShift && !isAlt) {
        return;
      }
      if (code === 'Enter') {
        return;
      }
    }

    // Ignore other shortcuts when user is in a text input or textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    if (code === 'KeyS' || key === '[') {
      e.preventDefault();
      markStart();
    } else if (code === 'KeyE' || key === ']') {
      e.preventDefault();
      markEnd();
    } else if (code === 'ArrowRight') {
      e.preventDefault();
      if (isCtrl) {
        deleteNextCut();
      } else if (isShift) {
        deleteNextEnd();
      } else if (isAlt) {
        deleteNextStart();
      } else {
        if (sctLastPlayedWasPreview) seekPreview(5);
        else seekAudio(5); 
      }
    } else if (code === 'ArrowLeft') {
      e.preventDefault();
      if (isCtrl) {
        deletePreviousCut();
      } else if (isShift) {
        deletePreviousEnd();
      } else if (isAlt) {
        deletePreviousStart();
      } else {
        if (sctLastPlayedWasPreview) seekPreview(-5);
        else seekAudio(-5);
      }
    }
  });

  function getKeepRegions(bufferDuration) {
    let cutsToProcess = [...sctCutRegions];
    if (sctActiveCut.start !== null) {
      cutsToProcess.push(sctActiveCut);
    }
    let sortedCuts = cutsToProcess.sort((a, b) =>a.start - b.start);
    let keepRegions = [];
    let currentPos = 0;

    for (let cut of sortedCuts) {
      if (cut.start >currentPos) {
        keepRegions.push({ start: currentPos, end: cut.start });
      }
      if (cut.end >currentPos) {
        currentPos = cut.end;
      }
    }
    if (currentPos < bufferDuration) {
      keepRegions.push({ start: currentPos, end: bufferDuration });
    }
    return keepRegions;
  }

  const btnReplayPreview = document.getElementById('btn-sct-replay-preview');
  const btnStopPreview = document.getElementById('btn-sct-stop-preview');

  function stopPreview() {
    if (!issctPreviewing) return;
    sctPreviewNodes.forEach(node =>{
      node.onended = null;
      try { node.stop(); } catch(e) {}
    });
    sctPreviewNodes = [];
    issctPreviewing = false;
    btnPreview.textContent = "Preview Remaining Audio";
    btnPreview.setAttribute('aria-label', `Preview remaining audio`);
    if (btnReplayPreview) {
      if (document.activeElement === btnReplayPreview) btnPreview.focus();
      btnReplayPreview.style.display = 'none';
    }
    if (btnStopPreview) {
      if (document.activeElement === btnStopPreview) btnPreview.focus();
      btnStopPreview.style.display = 'none';
    }
    statusEl.textContent = "";
  }

  btnPreview.addEventListener('click', async () =>{
    if (window.sctDeletedAssetName) {
      const proceed = confirm(`The file "${window.sctDeletedAssetName}" was deleted from the library. Do you want to continue without it?`);
      if (!proceed) return;
      window.sctDeletedAssetName = null;
    }
    if (!select.value) return alert("Select a file");
    if (sctIsLoading) {
      alert("Please wait, the track is still loading...");
      return;
    }
    
    if (sctIsPlaying) stopAudio();

    if (issctPreviewing) {
      sctPreviewNodes.forEach(node =>{
        node.onended = null;
        try { node.stop(); } catch(e) {}
      });
      sctPreviewNodes = [];
      sctPreviewPlayOffset += (getAudioCtx().currentTime - sctPreviewStartTime);
      issctPreviewing = false;
      btnPreview.textContent = 'Resume Preview';
      btnPreview.setAttribute('aria-label', `Resume preview`);
      statusEl.textContent = "";

      return;
    }

    if (!sctBuffer) {
      sctIsLoading = true;
      try {
        sctBuffer = await decodeAudio(getAsset(select.value).objectURL);
        currentsctAssetId = select.value;
      } catch (err) {
        statusEl.textContent = "Error loading audio file.";
        sctIsLoading = false;
        return;
      }
      sctIsLoading = false;
      statusEl.textContent = "";
    }
    
    const keepRegions = getKeepRegions(sctBuffer.duration);
    if (keepRegions.length === 0) {
      alert("Everything is cut! Nothing to preview.");
      return;
    }

    const totalDur = keepRegions.reduce((sum, r) =>sum + (r.end - r.start), 0);
    if (sctPreviewPlayOffset >= totalDur) sctPreviewPlayOffset = 0;

    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') { await ctx.resume(); }
    
    issctPreviewing = true;
    sctPreviewNodes = [];
    sctPreviewStartTime = ctx.currentTime;
    
    let scheduleTime = ctx.currentTime;
    let accumulated = 0;
    
    for (let region of keepRegions) {
      let dur = region.end - region.start;
      if (dur <= 0) continue;
      
      let regionStart = accumulated;
      let regionEnd = accumulated + dur;

      if (sctPreviewPlayOffset >= regionEnd) {
        accumulated += dur;
        continue;
      }

      let playStartOffset = region.start;
      let playDuration = dur;

      if (sctPreviewPlayOffset >regionStart) {
        let skipInsideRegion = sctPreviewPlayOffset - regionStart;
        playStartOffset = region.start + skipInsideRegion;
        playDuration = dur - skipInsideRegion;
      }

      const source = ctx.createBufferSource();
      source.buffer = sctBuffer;
      source.connect(masterCompressor);
      source.start(scheduleTime, playStartOffset, playDuration);
      source.addEventListener('ended', function() {
        sctPreviewNodes = sctPreviewNodes.filter(n =>n !== this);
      });
      sctPreviewNodes.push(source);
      
      scheduleTime += playDuration;
      accumulated += dur;
    }

    if (sctPreviewNodes.length >0) {
      const lastNode = sctPreviewNodes[sctPreviewNodes.length - 1];
      lastNode.onended = () =>{
        if (!issctPreviewing) return;
        issctPreviewing = false;
        sctPreviewPlayOffset = 0;
        btnPreview.textContent = "Preview Remaining Audio";
        btnPreview.setAttribute('aria-label', `Preview remaining audio`);
        if (btnReplayPreview) {
          if (document.activeElement === btnReplayPreview) btnPreview.focus();
          btnReplayPreview.style.display = 'none';
        }
        if (btnStopPreview) {
          if (document.activeElement === btnStopPreview) btnPreview.focus();
          btnStopPreview.style.display = 'none';
        }
        statusEl.textContent = "";
      };
    }

    sctLastPlayedWasPreview = true;
    btnPreview.textContent = " Pause Preview";
    btnPreview.setAttribute('aria-label', `Pause preview`);
    if (btnReplayPreview) btnReplayPreview.style.display = 'inline-block';
    if (btnStopPreview) btnStopPreview.style.display = 'inline-block';
    statusEl.textContent = "";
  });

  if (btnReplayPreview) {
    btnReplayPreview.addEventListener('click', () =>{
      sctPreviewPlayOffset = 0;
      if (issctPreviewing) {
        sctPreviewNodes.forEach(node =>{
          node.onended = null;
          try { node.stop(); } catch(e) {}
        });
        sctPreviewNodes = [];
        issctPreviewing = false;
      }
      btnPreview.click();
    });
  }

  if (btnStopPreview) {
    btnStopPreview.addEventListener('click', () =>{
      sctPreviewPlayOffset = 0;
      stopPreview();
      btnPreview.focus();
    });
  }

  async function seekPreview(seconds) {
    if (!issctPreviewing && sctPreviewStartTime === 0) return;
    
    const actx = getAudioCtx();
    if (actx.state === 'suspended') { await actx.resume(); }
    let currentRelativeTime = sctPreviewPlayOffset;
    if (issctPreviewing) {
      currentRelativeTime += (actx.currentTime - sctPreviewStartTime);
    }
    let newRelativeOffset = currentRelativeTime + seconds;
    
    const keepRegions = getKeepRegions(sctBuffer.duration);
    const totalDur = keepRegions.reduce((sum, r) =>sum + (r.end - r.start), 0);
    
    if (newRelativeOffset >= totalDur) newRelativeOffset = totalDur - 0.1;
    if (newRelativeOffset < 0) newRelativeOffset = 0;

    stopPreview();
    
    issctPreviewing = true;
    sctPreviewNodes = [];
    sctPreviewStartTime = actx.currentTime;
    sctPreviewPlayOffset = newRelativeOffset;

    let scheduleTime = actx.currentTime;
    let accumulated = 0;
    
    for (let region of keepRegions) {
      let dur = region.end - region.start;
      if (dur <= 0) continue;
      
      let regionStart = accumulated;
      let regionEnd = accumulated + dur;

      if (newRelativeOffset >= regionEnd) {
        accumulated += dur;
        continue;
      }

      let playStartOffset = region.start;
      let playDuration = dur;

      if (newRelativeOffset >regionStart) {
        let skipInsideRegion = newRelativeOffset - regionStart;
        playStartOffset = region.start + skipInsideRegion;
        playDuration = dur - skipInsideRegion;
      }

      const source = actx.createBufferSource();
      source.buffer = sctBuffer;
      source.connect(masterCompressor);
      source.start(scheduleTime, playStartOffset, playDuration);
      source.addEventListener('ended', function() {
        sctPreviewNodes = sctPreviewNodes.filter(n =>n !== this);
      });
      sctPreviewNodes.push(source);
      
      scheduleTime += playDuration;
      accumulated += dur;
    }

    if (sctPreviewNodes.length >0) {
      const lastNode = sctPreviewNodes[sctPreviewNodes.length - 1];
      lastNode.onended = () =>{
        if (!issctPreviewing) return;
        issctPreviewing = false;
        btnPreview.textContent = "Preview Remaining Audio";
        btnPreview.setAttribute('aria-label', `Preview remaining audio`);
        statusEl.textContent = "";
      };
    }
    
    sctLastPlayedWasPreview = true;
    btnPreview.textContent = " Pause Preview";
    btnPreview.setAttribute('aria-label', `Pause preview`);
    statusEl.textContent = "";
  }

  const performSuperCutExport = async (isSaveToLib) =>{
    if (isExportingMedia) { alert('An export is already in progress. Please wait.'); return; }
    if (!select.value) return alert("Select a file to process");
    
    const asset = getAsset(select.value);
    
    try {
      isExportingMedia = true;
      btnExport.textContent = "Exporting...";
      
      statusEl.textContent = "Processing... please wait.";
      announce("Processing remaining audio... please wait.");
      
      if (!sctBuffer) sctBuffer = await decodeAudio(asset.objectURL);
      
      const keepRegions = getKeepRegions(sctBuffer.duration);
      if (keepRegions.length === 0) throw new Error("Everything is cut! Cannot export empty file.");

      const totalDur = keepRegions.reduce((sum, r) =>sum + (r.end - r.start), 0);
      const sr = sctBuffer.sampleRate;
      const numCh = sctBuffer.numberOfChannels;
      const offline = new OfflineAudioContext(numCh, Math.ceil(totalDur * sr), sr);
      
      let scheduleTime = 0;
      for (let region of keepRegions) {
        const dur = region.end - region.start;
        if (dur <= 0) continue;
        const src = offline.createBufferSource();
        src.buffer = sctBuffer;
        src.connect(offline.destination);
        src.start(scheduleTime, region.start, dur);
        scheduleTime += dur;
      }

      const cutBuffer = await offline.startRendering();
      const wavBlob = await audioBufferToWav(cutBuffer);
      
      if (isSaveToLib) {
        saveBlobToLibrary(wavBlob, `${asset.name}_super_cut`, 'audio');
        statusEl.textContent = "Saved to Library!";
      } else {
        downloadBlob(wavBlob, `${asset.name}_super_cut.wav`);
        statusEl.textContent = "Export complete!";
        announce("Export complete.");
      }
    } catch (err) {
      statusEl.textContent = "Error: " + err.message;
      announce("Error during export.");
    } finally {
      isExportingMedia = false;
      btnExport.textContent = "Download Remaining WAV";
    }
  };

  btnExport.addEventListener('click', () =>performSuperCutExport(false));
  document.getElementById('btn-sct-save').addEventListener('click', () =>performSuperCutExport(true));

}
