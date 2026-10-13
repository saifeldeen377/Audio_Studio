// ─────────────────────────────────────────────────────────────
// TOOL 4 — VIDEO → AUDIO
// ─────────────────────────────────────────────────────────────

function initVideoToAudio() {
  const performVideoToAudioExport = async (isSaveToLib) =>{
  const assetId = document.getElementById('va-video-select').value;
  if (!assetId) { alert('Please select a video file from the library.'); return; }

  const asset = getAsset(assetId);
  const statusEl = document.getElementById('va-status');
  statusEl.textContent = 'Extracting audio track…';
  announce('Extracting audio from video, please wait…');

  if (isExportingMedia) { alert('An export is already in progress. Please wait.'); return; }
  isExportingMedia = true;
  try {
  const buffer = await decodeAudio(asset.file);
  const wavBlob = await audioBufferToWav(buffer);
  if (isSaveToLib) {
    saveBlobToLibrary(wavBlob, `${asset.name}_audio`, 'audio');
    statusEl.textContent = 'Saved to Library!';
  } else {
    downloadBlob(wavBlob, `${asset.name}_audio.wav`);
    statusEl.textContent = 'Done! Audio extracted and downloaded as WAV.';
    announce('Audio extracted and downloaded as WAV.');
  }
  } catch (err) {
  console.error(err);
  statusEl.textContent = 'Error: Could not extract audio. The video may have no audio track, or the format is not supported by your browser.';
  announce('Error: could not extract audio.', true);
  } finally {
  isExportingMedia = false;
  }
  };

  document.getElementById('btn-va-export').addEventListener('click', () =>performVideoToAudioExport(false));
  document.getElementById('btn-va-save').addEventListener('click', () =>performVideoToAudioExport(true));

  const btnPreview = document.getElementById('btn-va-preview');
  const btnReplay = document.getElementById('btn-va-replay-preview');
  const btnStop = document.getElementById('btn-va-stop');
  const statusEl = document.getElementById('va-status');

  let vaIsPreviewing = false;
  let vaPreviewAudioSrc = null;
  let vaPreviewStartTime = 0;
  let vaPreviewOffset = 0;
  let vaPreviewBuffer = null;
  let vaPreviewAssetId = null;
  let vaHasEnded = false;

  function stopVaPreview(resetEnded = true) {
    if (resetEnded) {
      vaHasEnded = false;
      window.lastEndedPreview = null;
    }
    if (!vaIsPreviewing && !vaPreviewAudioSrc) return;
    if (vaPreviewAudioSrc) {
      vaPreviewAudioSrc.onended = null;
      try { vaPreviewAudioSrc.stop(); } catch (e) {}
    }
    vaIsPreviewing = false;
    vaPreviewAudioSrc = null;
    vaPreviewOffset = 0;
    
    if (btnPreview) {
      btnPreview.textContent = 'Preview Audio';
      btnPreview.setAttribute('aria-label', `Preview audio`);
    }
    if (btnReplay) {
      if (document.activeElement === btnReplay) btnPreview.focus();
      btnReplay.style.display = 'none';
    }
    if (btnStop) {
      if (document.activeElement === btnStop) btnPreview.focus();
      btnStop.style.display = 'none';
    }
  }

  if (btnPreview) {
    btnPreview.addEventListener('click', async () =>{
      const assetId = document.getElementById('va-video-select').value;
      if (!assetId) { alert('Please select a video file from the library.'); return; }

      if (vaIsPreviewing) {
        if (vaPreviewAudioSrc) {
          try { vaPreviewAudioSrc.stop(); } catch (e) {}
          vaPreviewOffset += (getAudioCtx().currentTime - vaPreviewStartTime);
          vaPreviewAudioSrc = null;
        }
        vaIsPreviewing = false;
        btnPreview.textContent = 'Resume Preview';
        btnPreview.setAttribute('aria-label', `Resume preview`);
        statusEl.textContent = '';

        return;
      }

      if (typeof window.stopAllStudioPreviews === 'function') {
        window.stopAllStudioPreviews('video-audio');
      }
      vaHasEnded = false;

      const actx = getAudioCtx();
      if (actx.state === 'suspended') { await actx.resume(); }

      if (vaPreviewAssetId !== assetId || !vaPreviewBuffer) {
        btnPreview.textContent = 'Loading...';
        try {
          vaPreviewBuffer = await decodeAudio(getAsset(assetId).objectURL);
          vaPreviewAssetId = assetId;
          vaPreviewOffset = 0;
        } catch (err) {
          statusEl.textContent = "Error decoding audio file.";
          btnPreview.textContent = 'Preview Audio';
          return;
        }
      }

      if (vaPreviewOffset >= vaPreviewBuffer.duration) vaPreviewOffset = 0;

      vaPreviewAudioSrc = actx.createBufferSource();
      vaPreviewAudioSrc.buffer = vaPreviewBuffer;
      vaPreviewAudioSrc.connect(actx.destination);
      
      vaPreviewAudioSrc.start(0, vaPreviewOffset);
      vaPreviewStartTime = actx.currentTime;
      vaIsPreviewing = true;
      
      btnPreview.textContent = 'Pause Preview';
      btnPreview.setAttribute('aria-label', `Pause preview`);
      if (btnReplay) btnReplay.style.display = 'inline-block';
      if (btnStop) btnStop.style.display = 'inline-block';

      statusEl.textContent = '';

      vaPreviewAudioSrc.onended = () =>{
        if (!vaIsPreviewing) return; // paused
        stopVaPreview(false);
        window.lastEndedPreview = 'video-audio';
        vaHasEnded = true;
        statusEl.textContent = '';
      };
    });
  }

  if (btnReplay) {
    btnReplay.addEventListener('click', () =>{
      vaPreviewOffset = 0;
      if (vaIsPreviewing) {
        if (vaPreviewAudioSrc) {
          try { vaPreviewAudioSrc.stop(); } catch (e) {}
        }
        vaIsPreviewing = false;
      }
      if (btnPreview) btnPreview.click();
    });
  }

  if (btnStop) {
    btnStop.addEventListener('click', () =>{
      stopVaPreview(true);
      statusEl.textContent = '';
      btnPreview.focus();
    });
  }

  window.seekVideoAudio = function(seconds) {
    if (!vaPreviewBuffer) return false;
    const actx = getAudioCtx();

    if (vaIsPreviewing) {
      let currentPos = vaPreviewOffset + (actx.currentTime - vaPreviewStartTime);
      let newPos = Math.max(0, Math.min(vaPreviewBuffer.duration, currentPos + seconds));
      vaPreviewOffset = newPos;

      if (vaPreviewAudioSrc) {
        vaPreviewAudioSrc.onended = null;
        try { vaPreviewAudioSrc.stop(); } catch (e) {}
      }
      vaPreviewAudioSrc = actx.createBufferSource();
      vaPreviewAudioSrc.buffer = vaPreviewBuffer;
      vaPreviewAudioSrc.connect(actx.destination);
      vaPreviewAudioSrc.start(0, vaPreviewOffset);
      vaPreviewStartTime = actx.currentTime;
      vaPreviewAudioSrc.onended = () => {
        if (!vaIsPreviewing) return;
        stopVaPreview(false);
        window.lastEndedPreview = 'video-audio';
        vaHasEnded = true;
        statusEl.textContent = '';
      };
      return true;
    }

    if (seconds < 0 && vaHasEnded) {
      if (actx.state === 'suspended') { actx.resume(); }
      vaPreviewOffset = Math.max(0, vaPreviewBuffer.duration - 5);
      if (vaPreviewAudioSrc) {
        vaPreviewAudioSrc.onended = null;
        try { vaPreviewAudioSrc.stop(); } catch (e) {}
      }
      vaPreviewAudioSrc = actx.createBufferSource();
      vaPreviewAudioSrc.buffer = vaPreviewBuffer;
      vaPreviewAudioSrc.connect(actx.destination);
      vaPreviewAudioSrc.start(0, vaPreviewOffset);
      vaPreviewStartTime = actx.currentTime;
      vaIsPreviewing = true;
      vaHasEnded = false;
      if (btnPreview) {
        btnPreview.textContent = 'Pause Preview';
        btnPreview.setAttribute('aria-label', `Pause preview`);
      }
      if (btnReplay) btnReplay.style.display = 'inline-block';
      if (btnStop) btnStop.style.display = 'inline-block';
      vaPreviewAudioSrc.onended = () => {
        if (!vaIsPreviewing) return;
        stopVaPreview(false);
        window.lastEndedPreview = 'video-audio';
        vaHasEnded = true;
        statusEl.textContent = '';
      };
      return true;
    }
    return false;
  };

  window.isVideoAudioPreviewing = function() {
    return vaIsPreviewing;
  };

  window.stopVideoAudioPreview = function() {
    stopVaPreview(true);
  };
}
