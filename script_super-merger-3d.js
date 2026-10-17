/**
 * vaudio - Super Merger 3D Spatial Positioning Engine & Studio
 * Engineered for Saif's ISEF 2026 Project
 * Features:
 *  - 3D Positioning selection modal with 1:1 Media Library parity (inert, focus trap, arrow navigation, dropdown menu)
 *  - Step-by-step Screen Reader guided 3D Positioning Studio (role="application")
 *  - Hyper-Realistic HRTF, Convolver Room Impulse, and Psychoacoustic filter matrix
 *  - Radically sharp Front vs. Back distinction (Crisp front concha boost vs. Deep rear pinna notch & 4.8kHz head shadow)
 *  - Live 3D Panning during Super Merger recording: Ctrl + [Key] for Overlays, Ctrl + Alt + Space for Base Audio
 *  - Strictly zero screen reader verbal clutter during arrow movement (earcons only)
 *  - 3D Binaural rendering in OfflineAudioContext for exported WAV files (both Base and Overlays)
 * Strictly zero emojis, 100% WAI-ARIA and NVDA accessible. Entirely in English.
 */

'use strict';

(function() {
  // ── Global 3D State ───────────────────────────────────────────
  let sm3dAudioCtx = null;
  let sm3dRoomConvolver = null;
  let sm3dCueGain = null;

  // Selection Modal state
  let sm3dModalTrap = null;
  let sm3dSelectItems = []; // List of available files in modal

  // 3D Positioning Studio Wizard state
  let sm3dQueue = []; // Selected items queue
  let sm3dIndex = 0;
  let sm3dState = 'idle'; // 'ready_to_start' | 'announcing_file' | 'positioning' | 'idle'
  let sm3dLoopNode = null;
  let sm3dCurrentPanner = null;
  let sm3dCurrentFilters = null;
  let sm3dStepSize = 0.5;

  // Live Mixer 3D Tracking
  let smLive3dActiveOverlay = null; // Currently selected overlay for live arrow key movement
  let smLive3dActiveBase = false;    // Whether Base audio is currently in live 3D movement mode

  // ── Audio Engine & Room Convolver ─────────────────────────────
  function ensureSm3dAudioEngine() {
    if (sm3dAudioCtx) return sm3dAudioCtx;

    if (typeof getAudioCtx === 'function') {
      sm3dAudioCtx = getAudioCtx();
    } else {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      sm3dAudioCtx = new AudioCtxClass();
    }

    // Configure Listener (facing forward along -Z)
    const listener = sm3dAudioCtx.listener;
    if (listener.forwardX) {
      listener.forwardX.setValueAtTime(0, sm3dAudioCtx.currentTime);
      listener.forwardY.setValueAtTime(0, sm3dAudioCtx.currentTime);
      listener.forwardZ.setValueAtTime(-1, sm3dAudioCtx.currentTime);
      listener.upX.setValueAtTime(0, sm3dAudioCtx.currentTime);
      listener.upY.setValueAtTime(1, sm3dAudioCtx.currentTime);
      listener.upZ.setValueAtTime(0, sm3dAudioCtx.currentTime);
      listener.positionX.setValueAtTime(0, sm3dAudioCtx.currentTime);
      listener.positionY.setValueAtTime(0, sm3dAudioCtx.currentTime);
      listener.positionZ.setValueAtTime(0, sm3dAudioCtx.currentTime);
    } else if (listener.setOrientation) {
      listener.setOrientation(0, 0, -1, 0, 1, 0);
      if (listener.setPosition) listener.setPosition(0, 0, 0);
    }

    // Earcon cue gain
    sm3dCueGain = sm3dAudioCtx.createGain();
    sm3dCueGain.gain.setValueAtTime(0.2, sm3dAudioCtx.currentTime);
    sm3dCueGain.connect(sm3dAudioCtx.destination);

    // Direct clean monitoring (no artificial room reverb/convolver simulation)
    sm3dRoomConvolver = null;

    return sm3dAudioCtx;
  }

  function generateRoomIR(sampleRate) {
    const duration = 0.9;
    const decayRate = 4.0;
    const length = Math.floor(sampleRate * duration);
    const buffer = sm3dAudioCtx.createBuffer(2, length, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    const earlyDelays = [
      { timeMs: 5.5,  pan: -0.4, amp: 0.7 },
      { timeMs: 10.2, pan: 0.5,  amp: 0.6 },
      { timeMs: 15.0, pan: -0.6, amp: 0.5 },
      { timeMs: 22.0, pan: 0.2,  amp: 0.4 },
      { timeMs: 31.0, pan: -0.3, amp: 0.3 }
    ];

    earlyDelays.forEach(ref => {
      const idx = Math.floor((ref.timeMs / 1000) * sampleRate);
      if (idx < length) {
        left[idx] += Math.cos((ref.pan + 1) * Math.PI / 4) * ref.amp;
        right[idx] += Math.sin((ref.pan + 1) * Math.PI / 4) * ref.amp;
      }
    });

    let prevL = 0, prevR = 0;
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * decayRate);
      const whiteL = (Math.random() * 2 - 1) * env * 0.2;
      const whiteR = (Math.random() * 2 - 1) * env * 0.2;
      const damp = Math.min(0.85, 0.35 + t * 0.5);
      prevL = prevL * damp + whiteL * (1 - damp);
      prevR = prevR * damp + whiteR * (1 - damp);
      left[i] += prevL;
      right[i] += prevR;
    }
    return buffer;
  }

  // ── Psychoacoustic Filter Creation & Updates ──────────────────
  function createAcousticChain(ctx) {
    // 1. Proximity bass boost (< 0.9m)
    const prox = ctx.createBiquadFilter();
    prox.type = 'lowshelf';
    prox.frequency.setValueAtTime(180, ctx.currentTime);

    // 2. Front concha resonance peak boost (3.5 kHz, Q=1.3)
    const front = ctx.createBiquadFilter();
    front.type = 'peaking';
    front.frequency.setValueAtTime(3500, ctx.currentTime);
    front.Q.setValueAtTime(1.3, ctx.currentTime);

    // 3. Front presence brilliance shelf (7.5 kHz)
    const frontBrilliance = ctx.createBiquadFilter();
    frontBrilliance.type = 'highshelf';
    frontBrilliance.frequency.setValueAtTime(7500, ctx.currentTime);

    // 4. Head-shadow / Air absorption lowpass (Open front up to 20 kHz; drops to 4.8 kHz behind)
    const air = ctx.createBiquadFilter();
    air.type = 'lowpass';
    air.frequency.setValueAtTime(20000, ctx.currentTime);
    air.Q.setValueAtTime(0.7, ctx.currentTime);

    // 5. Rear Pinna Occlusion Deep Notch (6.0 kHz, Q=4.0)
    const pinnaNotch = ctx.createBiquadFilter();
    pinnaNotch.type = 'peaking';
    pinnaNotch.frequency.setValueAtTime(6000, ctx.currentTime);
    pinnaNotch.Q.setValueAtTime(4.0, ctx.currentTime);

    // 6. Rear Pinna High-Shelf Occlusion Cut (2.8 kHz)
    const rearShelf = ctx.createBiquadFilter();
    rearShelf.type = 'highshelf';
    rearShelf.frequency.setValueAtTime(2800, ctx.currentTime);

    // 7. Rear Head Cavity Boxiness (1.1 kHz, Q=1.5)
    const rearBoxy = ctx.createBiquadFilter();
    rearBoxy.type = 'peaking';
    rearBoxy.frequency.setValueAtTime(1100, ctx.currentTime);
    rearBoxy.Q.setValueAtTime(1.5, ctx.currentTime);

    // 8. Elevation Below Torso Notch (9.0 kHz, Q=3.0)
    const belowNotch = ctx.createBiquadFilter();
    belowNotch.type = 'peaking';
    belowNotch.frequency.setValueAtTime(9000, ctx.currentTime);
    belowNotch.Q.setValueAtTime(3.0, ctx.currentTime);

    // 9. Elevation Below High-Shelf Cut (5.5 kHz)
    const belowShelf = ctx.createBiquadFilter();
    belowShelf.type = 'highshelf';
    belowShelf.frequency.setValueAtTime(5500, ctx.currentTime);

    // 10. Floor/Torso Reflection Resonance (280 Hz)
    const floorTorso = ctx.createBiquadFilter();
    floorTorso.type = 'lowshelf';
    floorTorso.frequency.setValueAtTime(280, ctx.currentTime);

    // 11. Elevation Above Open-Air Boost (8.5 kHz)
    const aboveAir = ctx.createBiquadFilter();
    aboveAir.type = 'highshelf';
    aboveAir.frequency.setValueAtTime(8500, ctx.currentTime);

    // 12. Panner Node (HRTF Model)
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1.0;
    panner.maxDistance = 100.0;
    panner.rolloffFactor = 1.0;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 360;

    const dryGain = ctx.createGain();
    dryGain.gain.setValueAtTime(1.0, ctx.currentTime);

    // Sequential Audio Graph:
    prox.connect(front);
    front.connect(frontBrilliance);
    frontBrilliance.connect(air);
    air.connect(pinnaNotch);
    pinnaNotch.connect(rearShelf);
    rearShelf.connect(rearBoxy);
    rearBoxy.connect(belowNotch);
    belowNotch.connect(belowShelf);
    belowShelf.connect(floorTorso);
    floorTorso.connect(aboveAir);
    aboveAir.connect(panner);

    panner.connect(dryGain);

    return {
      inputNode: prox,
      panner,
      dryGain,
      roomSendGain: null,
      filters: {
        prox, front, frontBrilliance, air, pinnaNotch, rearShelf, rearBoxy,
        belowNotch, belowShelf, floorTorso, aboveAir
      }
    };
  }

  function updateAcousticParameters(chain, x, y, z, ctx, immediate = false) {
    if (!chain || !ctx) return;
    const time = ctx.currentTime;
    const panner = chain.panner;
    const f = chain.filters;

    const setParam = (param, val) => {
      if (!param) return;
      if (immediate) {
        param.setValueAtTime(val, time);
      } else {
        param.setTargetAtTime(val, time, 0.04);
      }
    };

    if (panner.positionX) {
      setParam(panner.positionX, x);
      setParam(panner.positionY, y);
      setParam(panner.positionZ, z);
    } else if (panner.setPosition) {
      panner.setPosition(x, y, z);
    }

    const dist = Math.sqrt(x * x + y * y + z * z);
    const safeDist = Math.max(0.1, dist);
    const zRatio = z / safeDist; // -1.0 (pure front) to +1.0 (pure rear)

    // ── Radical Front vs. Rear Decoupling ─────────────────────────
    if (z < 0) {
      // FRONT MODE (Z < 0):
      // Direct concha boost (+5 dB) and presence brilliance (+3 dB)
      const frontStrength = Math.min(1.0, Math.abs(zRatio));
      setParam(f.front.gain, frontStrength * 5.0);
      setParam(f.frontBrilliance.gain, frontStrength * 3.0);

      // Disable rear occlusion filters
      setParam(f.pinnaNotch.gain, 0.0);
      setParam(f.rearShelf.gain, 0.0);
      setParam(f.rearBoxy.gain, 0.0);

      // Air filter stays open (14kHz to 20kHz based solely on distance)
      const frontCutoff = Math.max(14000, 20000 / (1 + Math.max(0, dist - 1.0) * 0.25));
      setParam(f.air.frequency, frontCutoff);

    } else {
      // REAR MODE (Z > 0) or CENTER (Z = 0):
      // Disable front brightness boosts
      setParam(f.front.gain, 0.0);
      setParam(f.frontBrilliance.gain, 0.0);

      const rearStrength = Math.min(1.0, zRatio);
      // Deep Pinna Notch (-18 dB) and high shelf cut (-16 dB @ 2.8kHz)
      setParam(f.pinnaNotch.gain, -18.0 * rearStrength);
      setParam(f.rearShelf.gain, -16.0 * rearStrength);
      setParam(f.rearBoxy.gain, 3.2 * rearStrength);

      // Severe head-shadow occlusion lowpass: drops dramatically down to 4800 Hz
      const rearCutoff = Math.max(4800, 20000 - 15200 * rearStrength);
      setParam(f.air.frequency, rearCutoff);
    }

    // ── Below Elevation (Torso shadow & floor reflection) ────────
    if (y < 0) {
      const downRatio = Math.min(1.0, Math.abs(y) / 2.5);
      setParam(f.belowNotch.gain, -14.0 * downRatio);
      setParam(f.belowShelf.gain, -8.5 * downRatio);
      setParam(f.floorTorso.gain, 3.8 * downRatio);
    } else {
      setParam(f.belowNotch.gain, 0.0);
      setParam(f.belowShelf.gain, 0.0);
      setParam(f.floorTorso.gain, 0.0);
    }

    // ── Above Elevation (Open-air clarity) ───────────────────────
    if (y > 0) {
      const upRatio = Math.min(1.0, y / 2.5);
      setParam(f.aboveAir.gain, upRatio * 4.0);
    } else {
      setParam(f.aboveAir.gain, 0.0);
    }

    // ── Proximity Bass Boost (< 0.9m) ────────────────────────────
    if (dist > 0.05 && dist < 0.9) {
      const proxRatio = (0.9 - dist) / 0.9;
      setParam(f.prox.gain, proxRatio * 5.0);
    } else {
      setParam(f.prox.gain, 0.0);
    }

    // Direct clean natural sound matching export output
    if (chain.dryGain && chain.dryGain.gain) {
      setParam(chain.dryGain.gain, 1.0);
    }
    if (chain.roomSendGain && chain.roomSendGain.gain) {
      setParam(chain.roomSendGain.gain, 0.0);
    }
  }

  // ── Earcon Cues ───────────────────────────────────────────────
  function playCenterChime() {
    if (!sm3dAudioCtx || !sm3dCueGain) return;
    const osc = sm3dAudioCtx.createOscillator();
    const env = sm3dAudioCtx.createGain();
    const t = sm3dAudioCtx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1760, t + 0.05);
    env.gain.setValueAtTime(0.12, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(env);
    env.connect(sm3dCueGain);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  function playBoundaryTap() {
    if (!sm3dAudioCtx || !sm3dCueGain) return;
    const osc = sm3dAudioCtx.createOscillator();
    const env = sm3dAudioCtx.createGain();
    const t = sm3dAudioCtx.currentTime;
    osc.type = 'square';
    osc.frequency.setValueAtTime(120, t);
    env.gain.setValueAtTime(0.14, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(env);
    env.connect(sm3dCueGain);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  // ── English Spatial Description ──────────────────────────────
  function getEnglishSpatialDescription(x, y, z) {
    const parts = [];
    if (Math.abs(x) < 0.25) parts.push('Center');
    else if (x > 0) parts.push(`Right ${x.toFixed(1)}m`);
    else parts.push(`Left ${Math.abs(x).toFixed(1)}m`);

    if (Math.abs(z) < 0.25) parts.push('Ear level depth');
    else if (z < 0) parts.push(`Front ${Math.abs(z).toFixed(1)}m`);
    else parts.push(`Behind ${z.toFixed(1)}m`);

    if (Math.abs(y) < 0.25) parts.push('Ear height');
    else if (y > 0) parts.push(`Above ${y.toFixed(1)}m`);
    else parts.push(`Below ${Math.abs(y).toFixed(1)}m`);

    return parts.join(', ');
  }

  // ── Modal Logic (Selection Screen - 1:1 Media Library Parity) ──
  function open3dSelectionModal() {
    ensureSm3dAudioEngine();

    const hasBase = Boolean(smBaseAsset && !smBaseAsset.isNoBase && smBaseAsset.name);
    const hasOverlays = Array.isArray(smOverlays) && smOverlays.length > 0;

    if (!hasBase && !hasOverlays) {
      if (typeof announce === 'function') {
        announce('Please select a Base Audio or add at least one Overlay sound first.', true);
      }
      return;
    }

    const modal = document.getElementById('modal-sm-3d-select');
    const fileListEl = document.getElementById('sm-3d-file-list');
    fileListEl.innerHTML = '';
    sm3dSelectItems = [];

    // 1. Add Base Audio if configured
    if (hasBase) {
      sm3dSelectItems.push({
        id: 'item-base',
        type: 'base',
        name: smBaseAsset.name,
        key: 'Base',
        volume: Math.round((smBaseAsset.volume !== undefined ? smBaseAsset.volume : 1.0) * 100),
        behavior: 'Continuous',
        assetId: smBaseAsset.assetId || smBaseAsset.id,
        targetObj: smBaseAsset,
        spatialPos: smBaseAsset.spatialPos || { x: 0.0, y: 0.0, z: 0.0 }
      });
    }

    // 2. Add all Overlays
    if (hasOverlays) {
      smOverlays.forEach((ov, idx) => {
        sm3dSelectItems.push({
          id: `item-ov-${idx}`,
          type: 'overlay',
          name: ov.name,
          key: (ov.key || '').toUpperCase(),
          volume: Math.round((ov.volume !== undefined ? ov.volume : 1.0) * 100),
          behavior: ov.behavior === 'cutoff' ? 'Cutoff' : 'Overlap',
          assetId: ov.assetId,
          targetObj: ov,
          spatialPos: ov.spatialPos || { x: 0.0, y: 0.0, z: 0.0 }
        });
      });
    }

    // Render Checkboxes with exact Library Modal structure and keyboard navigation
    // Formatting: Shortcut between commas, then volume and behavior without commas for faster screen reader reading
    sm3dSelectItems.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'batch-file-item';
      row.setAttribute('role', 'listitem');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '12px';
      row.style.padding = '10px 14px';
      row.style.background = 'var(--bg-card)';
      row.style.border = '1px solid var(--border)';
      row.style.borderRadius = 'var(--radius-sm)';

      const keyFormatted = item.type === 'base' ? ',Base,' : `,Key ${item.key},`;
      const detailsNoCommas = `${item.volume}% ${item.behavior}`;
      const isPreChecked = Boolean(item.targetObj.spatialPos);

      row.innerHTML = `
        <label style="display: flex; align-items: center; justify-content: space-between; gap: 12px; cursor: pointer; width: 100%;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <input type="checkbox" class="batch-file-checkbox" id="sm-3d-chk-${index}" data-index="${index}" ${isPreChecked ? 'checked' : ''} aria-label="${item.name}, ${keyFormatted} ${detailsNoCommas}">
            <span style="font-weight: 600; color: var(--text);">${item.name}</span>
          </div>
          <span style="font-size: 0.85rem; color: var(--text-dim);">${keyFormatted} ${detailsNoCommas}</span>
        </label>
      `;

      fileListEl.appendChild(row);
    });

    // Attach checkbox event listeners: change event + ArrowUp/ArrowDown cycling (identical to Library UI)
    const checkboxes = Array.from(fileListEl.querySelectorAll('.batch-file-checkbox'));
    checkboxes.forEach((chk, idx) => {
      chk.addEventListener('change', updateSelectionCount);
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

    updateSelectionCount();

    // Show modal and apply inert background
    modal.hidden = false;
    modal.removeAttribute('hidden');
    modal.style.display = 'flex';

    if (typeof setAppBackgroundInert === 'function') {
      setAppBackgroundInert(true, modal);
    }
    const smOverlay = document.getElementById('super-mode-overlay');
    if (smOverlay) {
      smOverlay.inert = true;
      smOverlay.setAttribute('aria-hidden', 'true');
    }

    // Direct focus landing on first checkbox (or close button if list is empty)
    const firstChk = fileListEl.querySelector('.batch-file-checkbox');
    const closeBtn = document.getElementById('btn-close-sm-3d-modal');
    if (firstChk) {
      firstChk.focus();
    } else if (closeBtn) {
      closeBtn.focus();
    }

    if (typeof announce === 'function') {
      announce(`Select files for 3D positioning dialog opened. ${sm3dSelectItems.length} files available. Use arrow keys to navigate files.`, true);
    }
  }

  function close3dSelectionModal() {
    const modal = document.getElementById('modal-sm-3d-select');
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('hidden', '');
    modal.style.display = 'none';

    if (sm3dModalTrap && typeof sm3dModalTrap.release === 'function') {
      sm3dModalTrap.release();
      sm3dModalTrap = null;
    }

    // Safely restore Super Merger Setup View
    const smOverlay = document.getElementById('super-mode-overlay');
    if (smOverlay && !smOverlay.hidden && smOverlay.style.display !== 'none') {
      smOverlay.inert = false;
      smOverlay.removeAttribute('aria-hidden');
      if (typeof setAppBackgroundInert === 'function') {
        setAppBackgroundInert(true, smOverlay);
      }
      const setupView = document.getElementById('sm-setup-view');
      if (setupView) {
        setupView.hidden = false;
        setupView.style.display = 'block';
        setupView.removeAttribute('aria-hidden');
        setupView.removeAttribute('inert');
      }
    } else {
      if (typeof setAppBackgroundInert === 'function') {
        setAppBackgroundInert(false);
      }
    }

    const triggerBtn = document.getElementById('btn-sm-3d-pos');
    if (triggerBtn) triggerBtn.focus();
  }

  function updateSelectionCount() {
    const checkboxes = document.querySelectorAll('#sm-3d-file-list .batch-file-checkbox');
    let count = 0;
    checkboxes.forEach(c => { if (c.checked) count++; });

    const badge = document.getElementById('sm-3d-sel-count-badge');
    if (badge) badge.textContent = `${count} ${count === 1 ? 'file' : 'files'} selected`;

    const letsGoBtn = document.getElementById('btn-sm-3d-letsgo');
    if (letsGoBtn) {
      letsGoBtn.textContent = `Let's go (${count})`;
      letsGoBtn.disabled = (count === 0);
    }
  }

  function selectAllFiles() {
    const checkboxes = document.querySelectorAll('#sm-3d-file-list .batch-file-checkbox');
    checkboxes.forEach(c => c.checked = true);
    updateSelectionCount();
    if (typeof announce === 'function') announce(`All ${checkboxes.length} files selected.`, true);
  }

  function deselectAllFiles() {
    const checkboxes = document.querySelectorAll('#sm-3d-file-list .batch-file-checkbox');
    checkboxes.forEach(c => c.checked = false);
    updateSelectionCount();
    if (typeof announce === 'function') announce('All files deselected.', true);
  }

  function invertSelectionFiles() {
    const checkboxes = document.querySelectorAll('#sm-3d-file-list .batch-file-checkbox');
    let count = 0;
    checkboxes.forEach(c => {
      c.checked = !c.checked;
      if (c.checked) count++;
    });
    updateSelectionCount();
    if (typeof announce === 'function') announce(`Selection inverted. ${count} files now selected.`, true);
  }

  // ── 3D Positioning Studio (Wizard Flow) ───────────────────────
  function start3dStudioWorkflow() {
    const checkboxes = document.querySelectorAll('#sm-3d-file-list .batch-file-checkbox:checked');
    if (checkboxes.length === 0) return;

    sm3dQueue = [];
    checkboxes.forEach(cb => {
      const idx = parseInt(cb.dataset.index, 10);
      const item = sm3dSelectItems[idx];
      if (item) {
        // Clone current or default spatial coordinates
        const initPos = item.targetObj.spatialPos ? { ...item.targetObj.spatialPos } : { ...item.spatialPos };
        sm3dQueue.push({
          ...item,
          x: initPos.x !== undefined ? initPos.x : 0.0,
          y: initPos.y !== undefined ? initPos.y : 0.0,
          z: initPos.z !== undefined ? initPos.z : 0.0,
          isSaved: false
        });
      }
    });

    close3dSelectionModal();

    // Open Studio Overlay
    const stage = document.getElementById('sm-3d-stage-overlay');
    stage.hidden = false;
    stage.removeAttribute('hidden');
    stage.style.display = 'flex';

    if (typeof setAppBackgroundInert === 'function') {
      setAppBackgroundInert(true, stage);
    }
    const smOverlay = document.getElementById('super-mode-overlay');
    if (smOverlay) {
      smOverlay.inert = true;
      smOverlay.setAttribute('aria-hidden', 'true');
    }

    sm3dIndex = 0;
    sm3dState = 'ready_to_start';

    // Update Banner & UI
    updateStudioHeaderAndBanner();
    draw3dRadar();

    // Initial Screen Reader Announcement
    const countText = sm3dQueue.length === 1 ? '1 file' : `${sm3dQueue.length} files`;
    const initialSpeech = `You selected ${countText} to position in 3D spatial audio. Press Enter to start.`;
    setStudioAnnouncer(initialSpeech);

    const focusRegion = document.getElementById('sm-3d-focus-region');
    if (focusRegion) focusRegion.focus();
  }

  function updateStudioHeaderAndBanner() {
    if (sm3dQueue.length === 0) return;
    const current = sm3dQueue[sm3dIndex] || sm3dQueue[0];

    const progressBadge = document.getElementById('sm-3d-file-progress-badge');
    if (progressBadge) {
      progressBadge.textContent = `File ${sm3dIndex + 1} of ${sm3dQueue.length}`;
    }

    const nameEl = document.getElementById('sm-3d-current-file-name');
    if (nameEl) nameEl.textContent = current.name;

    const keyBadge = document.getElementById('sm-3d-current-key-badge');
    if (keyBadge) {
      keyBadge.textContent = current.type === 'base' ? 'Base Audio' : `Key ${current.key}`;
    }

    const volBadge = document.getElementById('sm-3d-current-vol-badge');
    if (volBadge) volBadge.textContent = `${current.volume}% Vol`;

    const behaviorBadge = document.getElementById('sm-3d-current-behavior-badge');
    if (behaviorBadge) behaviorBadge.textContent = current.behavior;

    updateCoordinatesDisplay(current);
  }

  function updateCoordinatesDisplay(current) {
    if (!current) return;
    const dist = Math.sqrt(current.x * current.x + current.y * current.y + current.z * current.z);

    const elX = document.getElementById('sm-3d-val-x');
    if (elX) elX.textContent = `${current.x > 0 ? '+' : ''}${current.x.toFixed(1)}m`;

    const elZ = document.getElementById('sm-3d-val-z');
    if (elZ) elZ.textContent = `${current.z.toFixed(1)}m`;

    const elY = document.getElementById('sm-3d-val-y');
    if (elY) elY.textContent = `${current.y > 0 ? '+' : ''}${current.y.toFixed(1)}m`;

    const elDist = document.getElementById('sm-3d-val-dist');
    if (elDist) elDist.textContent = `${dist.toFixed(1)}m`;

    const elDesc = document.getElementById('sm-3d-val-desc');
    if (elDesc) elDesc.textContent = getEnglishSpatialDescription(current.x, current.y, current.z);
  }

  function setStudioAnnouncer(text) {
    const el = document.getElementById('sm-3d-announcer-text');
    if (el) el.textContent = text;
    if (typeof announce === 'function') {
      announce(text, true);
    }
  }

  // ── Studio Audio Playback Loop ────────────────────────────────
  async function startCurrentSoundLoop() {
    stopCurrentSoundLoop();
    ensureSm3dAudioEngine();

    const current = sm3dQueue[sm3dIndex];
    if (!current) return;

    let buffer = null;
    if (typeof decodedAudioBuffers !== 'undefined' && decodedAudioBuffers[current.assetId]) {
      buffer = decodedAudioBuffers[current.assetId];
    } else if (typeof getDecodedBuffer === 'function') {
      buffer = await getDecodedBuffer(current.assetId);
    } else if (typeof decodeAudio === 'function' && current.targetObj.objectURL) {
      buffer = await decodeAudio(current.targetObj.objectURL);
    }

    if (!buffer) {
      setStudioAnnouncer('Error loading audio buffer for this file. Skipping to next.');
      return;
    }

    const chain = createAcousticChain(sm3dAudioCtx);
    sm3dCurrentPanner = chain.panner;
    sm3dCurrentFilters = chain;

    // Connect direct natural output
    chain.dryGain.connect(sm3dAudioCtx.destination);

    // Initial position update
    updateAcousticParameters(chain, current.x, current.y, current.z, sm3dAudioCtx);

    const src = sm3dAudioCtx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const gain = sm3dAudioCtx.createGain();
    gain.gain.setValueAtTime((current.volume / 100), sm3dAudioCtx.currentTime);

    src.connect(gain);
    gain.connect(chain.inputNode);

    src.start();
    sm3dLoopNode = src;
  }

  function stopCurrentSoundLoop() {
    if (sm3dLoopNode) {
      try { sm3dLoopNode.stop(); sm3dLoopNode.disconnect(); } catch (_) {}
      sm3dLoopNode = null;
    }
    sm3dCurrentPanner = null;
    sm3dCurrentFilters = null;
  }

  // ── Enter Key Progression Wizard ─────────────────────────────
  function handleStudioEnterKey() {
    if (sm3dQueue.length === 0) return;
    const current = sm3dQueue[sm3dIndex];

    if (sm3dState === 'ready_to_start') {
      // Step 1 -> Step 2
      sm3dState = 'announcing_file';
      updateStudioHeaderAndBanner();
      const promptText = `Now positioning ${current.name}, shortcut ${current.key}, volume ${current.volume} percent, behavior ${current.behavior}. Press Enter to begin positioning.`;
      setStudioAnnouncer(promptText);

    } else if (sm3dState === 'announcing_file') {
      // Step 2 -> Step 3: Start Audio & Move
      sm3dState = 'positioning';
      startCurrentSoundLoop();
      const activeText = `Audio playing for ${current.name}. Use Arrow keys to move left, right, front, back, and Shift plus Arrow keys for elevation. Press Enter when finished.`;
      setStudioAnnouncer(activeText);

    } else if (sm3dState === 'positioning') {
      // Step 3 -> Finish current file and save position
      stopCurrentSoundLoop();
      current.targetObj.spatialPos = { x: current.x, y: current.y, z: current.z };
      current.targetObj.spatialTrajectory = [{ t: 0.0, x: current.x, y: current.y, z: current.z }];
      current.isSaved = true;

      if (sm3dIndex + 1 < sm3dQueue.length) {
        // More files to position
        sm3dIndex++;
        sm3dState = 'announcing_file';
        updateStudioHeaderAndBanner();
        draw3dRadar();
        const next = sm3dQueue[sm3dIndex];
        const nextText = `Position saved. Moving to next sound: ${next.name}, shortcut ${next.key}, volume ${next.volume} percent, behavior ${next.behavior}. Press Enter to begin.`;
        setStudioAnnouncer(nextText);
      } else {
        // All files finished!
        setStudioAnnouncer('Done! You have finished setting 3D positions for all selected files.');
        setTimeout(() => {
          exitStudioWorkflow(true);
        }, 1200);
      }
    }
  }

  // NOTE: Screen reader speech is strictly muted on arrow moves so user has 100% hearing concentration!
  function moveCurrentPosition(dx, dy, dz) {
    if (sm3dState !== 'positioning' && sm3dState !== 'announcing_file') return;
    const current = sm3dQueue[sm3dIndex];
    if (!current) return;

    const prevX = current.x;
    let newX = current.x + dx;
    let newY = current.y + dy;
    let newZ = current.z + dz;

    let hitBound = false;
    if (newX > 5.0) { newX = 5.0; hitBound = true; }
    if (newX < -5.0) { newX = -5.0; hitBound = true; }
    if (newZ > 5.0) { newZ = 5.0; hitBound = true; }
    if (newZ < -5.0) { newZ = -5.0; hitBound = true; }
    if (newY > 3.0) { newY = 3.0; hitBound = true; }
    if (newY < -3.0) { newY = -3.0; hitBound = true; }

    if ((prevX < 0 && newX >= 0) || (prevX > 0 && newX <= 0)) {
      playCenterChime();
    }
    if (hitBound) {
      playBoundaryTap();
    }

    current.x = parseFloat(newX.toFixed(2));
    current.y = parseFloat(newY.toFixed(2));
    current.z = parseFloat(newZ.toFixed(2));

    if (sm3dCurrentFilters && sm3dAudioCtx) {
      updateAcousticParameters(sm3dCurrentFilters, current.x, current.y, current.z, sm3dAudioCtx);
    }

    // Visual labels update without screen reader interruption
    updateCoordinatesDisplay(current);
    draw3dRadar();
  }

  function resetCurrentPosition() {
    const current = sm3dQueue[sm3dIndex];
    if (!current) return;
    current.x = 0.0;
    current.y = 0.0;
    current.z = 0.0;
    if (sm3dCurrentFilters && sm3dAudioCtx) {
      updateAcousticParameters(sm3dCurrentFilters, current.x, current.y, current.z, sm3dAudioCtx, true);
    }
    playCenterChime();
    updateCoordinatesDisplay(current);
    draw3dRadar();
    setStudioAnnouncer(`${current.name} reset to center.`);
  }

  function saveProgressAndExit() {
    stopCurrentSoundLoop();
    // Save any actively edited item
    if (sm3dQueue[sm3dIndex]) {
      const cur = sm3dQueue[sm3dIndex];
      cur.targetObj.spatialPos = { x: cur.x, y: cur.y, z: cur.z };
      cur.targetObj.spatialTrajectory = [{ t: 0.0, x: cur.x, y: cur.y, z: cur.z }];
      cur.isSaved = true;
    }
    exitStudioWorkflow(true);
  }

  function skipCurrentFile() {
    stopCurrentSoundLoop();
    if (sm3dIndex + 1 < sm3dQueue.length) {
      sm3dIndex++;
      sm3dState = 'announcing_file';
      updateStudioHeaderAndBanner();
      draw3dRadar();
      const next = sm3dQueue[sm3dIndex];
      setStudioAnnouncer(`Skipped. Now at next sound: ${next.name}, shortcut ${next.key}. Press Enter to begin.`);
    } else {
      setStudioAnnouncer('Reached the end of files.');
      exitStudioWorkflow(true);
    }
  }

  function exitStudioWorkflow(didSave = false) {
    stopCurrentSoundLoop();
    const stage = document.getElementById('sm-3d-stage-overlay');
    if (stage) {
      stage.hidden = true;
      stage.setAttribute('hidden', '');
      stage.style.display = 'none';
    }

    // Safely restore Super Merger Setup View
    const smOverlay = document.getElementById('super-mode-overlay');
    if (smOverlay && !smOverlay.hidden && smOverlay.style.display !== 'none') {
      smOverlay.inert = false;
      smOverlay.removeAttribute('aria-hidden');
      if (typeof setAppBackgroundInert === 'function') {
        setAppBackgroundInert(true, smOverlay);
      }
      const setupView = document.getElementById('sm-setup-view');
      if (setupView) {
        setupView.hidden = false;
        setupView.style.display = 'block';
        setupView.removeAttribute('aria-hidden');
        setupView.removeAttribute('inert');
      }
    } else {
      if (typeof setAppBackgroundInert === 'function') {
        setAppBackgroundInert(false);
      }
    }

    sm3dState = 'idle';
    sm3dQueue = [];

    const triggerBtn = document.getElementById('btn-sm-3d-pos');
    if (triggerBtn) triggerBtn.focus();

    if (didSave && typeof announce === 'function') {
      announce('3D positioning complete. Ready to mix in Super Merger.', true);
    }
  }

  // ── Visual Radar Canvas ───────────────────────────────────────
  function draw3dRadar() {
    const canvas = document.getElementById('sm-3d-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = 28;

    ctx.fillStyle = '#080812';
    ctx.fillRect(0, 0, w, h);

    // Distance rings
    for (let r = 1; r <= 5; r++) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
      ctx.strokeStyle = r === 2 ? '#2a2a55' : '#14142a';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#4a4aaa';
      ctx.font = '10px monospace';
      ctx.fillText(`${r}m`, cx + 4, cy - r * scale + 10);
    }

    // Axes
    ctx.beginPath();
    ctx.moveTo(0, cy); ctx.lineTo(w, cy);
    ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
    ctx.strokeStyle = '#1a1a35';
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#9090bb';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Front (-Z)', cx, 16);
    ctx.fillText('Back (+Z)', cx, h - 6);
    ctx.textAlign = 'right';
    ctx.fillText('Left (-X)', w - 8, cy - 6);
    ctx.textAlign = 'left';
    ctx.fillText('Right (+X)', 8, cy - 6);

    // Listener icon
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#1e1e45';
    ctx.strokeStyle = '#7c6fff';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    // Nose
    ctx.beginPath();
    ctx.moveTo(cx, cy - 14);
    ctx.lineTo(cx - 4, cy - 8);
    ctx.lineTo(cx + 4, cy - 8);
    ctx.closePath();
    ctx.fillStyle = '#00d4aa';
    ctx.fill();

    // Draw active sound
    const current = sm3dQueue[sm3dIndex];
    if (current) {
      const px = cx + current.x * scale;
      const py = cy + current.z * scale;

      ctx.beginPath();
      ctx.arc(px, py, 12, 0, Math.PI * 2);
      ctx.fillStyle = sm3dState === 'positioning' ? '#00d4aa' : '#7c6fff';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(current.key || '3D', px, py + 3.5);

      ctx.fillStyle = '#00d2ff';
      ctx.font = '10px sans-serif';
      const alt = `${current.y > 0 ? '+' : ''}${current.y.toFixed(1)}m`;
      ctx.fillText(alt, px, py - 16);
    }
  }

  // ── Live Mixer Integration (Routing, Ctrl+Alt+Space & Ctrl+Key) ──

  /**
   * Calculates acoustic filter parameters for given 3D coordinates.
   */
  function computeAcousticParameters(x, y, z) {
    const dist = Math.sqrt(x * x + y * y + z * z);
    const safeDist = Math.max(0.1, dist);
    const zRatio = z / safeDist;

    let frontGain = 0;
    let pinnaGain = 0;
    let rearShelfGain = 0;
    let airFreq = 20000;

    if (z < 0) {
      const frontStrength = Math.min(1.0, Math.abs(zRatio));
      frontGain = frontStrength * 5.0;
      airFreq = Math.max(14000, 20000 / (1 + Math.max(0, dist - 1.0) * 0.25));
    } else {
      const rearStrength = Math.min(1.0, zRatio);
      pinnaGain = -18.0 * rearStrength;
      rearShelfGain = -16.0 * rearStrength;
      airFreq = Math.max(4800, 20000 - 15200 * rearStrength);
    }

    return { x, y, z, dist, zRatio, frontGain, pinnaGain, rearShelfGain, airFreq };
  }

  /**
   * Records a 3D coordinate point at a specific timeline timestamp.
   */
  function recordSpatialPoint(targetObj, time, x, y, z) {
    if (!targetObj) return;
    const safeTime = Math.max(0, typeof time === 'number' && !isNaN(time) ? time : 0);
    const initPos = targetObj.spatialPos || { x: 0.0, y: 0.0, z: 0.0 };
    if (!targetObj.spatialTrajectory || targetObj.spatialTrajectory.length === 0) {
      targetObj.spatialTrajectory = [];
      const baseT = (typeof targetObj.timelineStart === 'number') ? targetObj.timelineStart : 0.0;
      targetObj.spatialTrajectory.push({ t: baseT, x: initPos.x, y: initPos.y, z: initPos.z });
    }
    if (targetObj.spatialTrajectory.length === 1 && safeTime > targetObj.spatialTrajectory[0].t + 0.05) {
      const p0 = targetObj.spatialTrajectory[0];
      targetObj.spatialTrajectory.push({ t: safeTime - 0.03, x: p0.x, y: p0.y, z: p0.z });
    }
    targetObj.spatialPos = { x, y, z };
    const last = targetObj.spatialTrajectory[targetObj.spatialTrajectory.length - 1];
    if (last && Math.abs(last.t - safeTime) < 0.04) {
      last.x = x;
      last.y = y;
      last.z = z;
    } else {
      const existingIdx = targetObj.spatialTrajectory.findIndex(p => Math.abs(p.t - safeTime) < 0.04);
      if (existingIdx !== -1) {
        targetObj.spatialTrajectory[existingIdx].x = x;
        targetObj.spatialTrajectory[existingIdx].y = y;
        targetObj.spatialTrajectory[existingIdx].z = z;
      } else {
        targetObj.spatialTrajectory.push({ t: safeTime, x, y, z });
        targetObj.spatialTrajectory.sort((a, b) => a.t - b.t);
      }
    }
  }

  /**
   * Retrieves the 3D coordinate for an object at a given timeline time.
   * If there is a trajectory, interpolates smoothly between keyframes.
   * Otherwise returns targetObj.spatialPos.
   */
  function getSpatialPosAtTime(targetObj, time) {
    if (!targetObj) return { x: 0.0, y: 0.0, z: 0.0 };
    const defaultPos = targetObj.spatialPos || { x: 0.0, y: 0.0, z: 0.0 };
    if (!targetObj.spatialTrajectory || targetObj.spatialTrajectory.length === 0) {
      return { ...defaultPos };
    }
    const t = Math.max(0, typeof time === 'number' && !isNaN(time) ? time : 0);
    const traj = targetObj.spatialTrajectory;
    if (t <= traj[0].t) {
      return { x: traj[0].x, y: traj[0].y, z: traj[0].z };
    }
    if (t >= traj[traj.length - 1].t) {
      const last = traj[traj.length - 1];
      return { x: last.x, y: last.y, z: last.z };
    }
    for (let i = 0; i < traj.length - 1; i++) {
      if (t >= traj[i].t && t <= traj[i + 1].t) {
        const p1 = traj[i];
        const p2 = traj[i + 1];
        const span = p2.t - p1.t;
        if (span <= 0.001) return { x: p2.x, y: p2.y, z: p2.z };
        const r = (t - p1.t) / span;
        return {
          x: parseFloat((p1.x + (p2.x - p1.x) * r).toFixed(2)),
          y: parseFloat((p1.y + (p2.y - p1.y) * r).toFixed(2)),
          z: parseFloat((p1.z + (p2.z - p1.z) * r).toFixed(2))
        };
      }
    }
    return { ...defaultPos };
  }

  /**
   * Updates 3D audio positions of Base Audio and all active/review overlays in real time during playback.
   */
  function updateLive3dAudioPositions(currentTime) {
    const ctx = sm3dAudioCtx || (typeof getAudioCtx === 'function' ? getAudioCtx() : null);
    if (!ctx) return;
    const t = Math.max(0, typeof currentTime === 'number' && !isNaN(currentTime) ? currentTime : 0);

    // 1. Base Audio
    if (typeof smBaseAudio !== 'undefined' && smBaseAudio && smBaseAudio.spatialChain) {
      if (!smLive3dActiveBase && typeof smBaseAsset !== 'undefined' && smBaseAsset) {
        const p = getSpatialPosAtTime(smBaseAsset, t);
        updateAcousticParameters(smBaseAudio.spatialChain, p.x, p.y, p.z, ctx);
      }
    }

    // 2. Active Overlays
    if (typeof activeOverlayAudios !== 'undefined') {
      Object.values(activeOverlayAudios).forEach(inst => {
        if (!inst || !inst.spatialChain) return;
        if (smLive3dActiveOverlay && smLive3dActiveOverlay.id === inst.overlayId) return;
        const target = inst.clipEntry || (typeof smOverlays !== 'undefined' ? smOverlays.find(o => o.id === inst.overlayId) : null);
        if (target) {
          const p = getSpatialPosAtTime(target, t);
          updateAcousticParameters(inst.spatialChain, p.x, p.y, p.z, ctx);
        }
      });
    }

    // 3. Review Overlays
    if (typeof reviewOverlayPlaybacks !== 'undefined' && Array.isArray(reviewOverlayPlaybacks)) {
      reviewOverlayPlaybacks.forEach(inst => {
        if (!inst || !inst.spatialChain) return;
        if (smLive3dActiveOverlay && smLive3dActiveOverlay.id === inst.overlayId) return;
        const target = inst.clip || (typeof smOverlays !== 'undefined' ? smOverlays.find(o => o.id === inst.overlayId) : null);
        if (target) {
          const p = getSpatialPosAtTime(target, t);
          updateAcousticParameters(inst.spatialChain, p.x, p.y, p.z, ctx);
        }
      });
    }
  }

  /**
   * Applies 3D spatial acoustic nodes to an active overlay instance during live mixing or replay.
   */
  function apply3dToOverlayInstance(activeInstance, overlay) {
    if (!overlay || !activeInstance) return;
    if (!overlay.spatialPos) {
      overlay.spatialPos = { x: 0.0, y: 0.0, z: 0.0 };
    }
    if (!overlay.spatialTrajectory || overlay.spatialTrajectory.length === 0) {
      overlay.spatialTrajectory = [{ t: 0.0, x: overlay.spatialPos.x, y: overlay.spatialPos.y, z: overlay.spatialPos.z }];
    }
    const ctx = sm3dAudioCtx || ensureSm3dAudioEngine();

    const chain = createAcousticChain(ctx);
    activeInstance.panner = chain.panner;
    activeInstance.spatialChain = chain;

    // Disconnect default gain output
    try { activeInstance.gainNode.disconnect(); } catch (_) {}

    // Route: gain -> chain.inputNode
    activeInstance.gainNode.connect(chain.inputNode);

    // Chain dry -> smOverlayBusNode
    if (typeof smOverlayBusNode !== 'undefined' && smOverlayBusNode) {
      chain.dryGain.connect(smOverlayBusNode);
    } else if (typeof masterCompressor !== 'undefined' && masterCompressor) {
      chain.dryGain.connect(masterCompressor);
    } else {
      chain.dryGain.connect(ctx.destination);
    }

    // Set initial 3D positions at current timeline timestamp immediately with no startup glide
    const t = Math.max(typeof smVirtualTime !== 'undefined' ? smVirtualTime : 0, overlay && typeof overlay.timelineStart === 'number' ? overlay.timelineStart : 0);
    const pos = getSpatialPosAtTime(overlay, t);
    updateAcousticParameters(chain, pos.x, pos.y, pos.z, ctx, true);
  }

  /**
   * Applies 3D spatial acoustic nodes to Base Audio instance during live mixing.
   */
  function apply3dToBaseInstance(player, baseAsset) {
    if (!baseAsset || !player) return;
    if (!baseAsset.spatialPos) {
      baseAsset.spatialPos = { x: 0.0, y: 0.0, z: 0.0 };
    }
    if (!baseAsset.spatialTrajectory || baseAsset.spatialTrajectory.length === 0) {
      baseAsset.spatialTrajectory = [{ t: 0.0, x: baseAsset.spatialPos.x, y: baseAsset.spatialPos.y, z: baseAsset.spatialPos.z }];
    }
    const ctx = sm3dAudioCtx || ensureSm3dAudioEngine();

    if (!player.spatialChain) {
      const chain = createAcousticChain(ctx);
      player.panner = chain.panner;
      player.spatialChain = chain;

      const dest = player.outputNode || (typeof smBaseBusNode !== 'undefined' && smBaseBusNode) || (typeof masterCompressor !== 'undefined' && masterCompressor) || ctx.destination;
      chain.dryGain.connect(dest);
    }

    // Always reconnect current player.gainNode to spatial chain input
    if (player.gainNode) {
      try { player.gainNode.disconnect(); } catch (_) {}
      try { player.gainNode.connect(player.spatialChain.inputNode); } catch (_) {}
    }

    const t = typeof smVirtualTime !== 'undefined' ? smVirtualTime : 0;
    const pos = getSpatialPosAtTime(baseAsset, t);
    updateAcousticParameters(player.spatialChain, pos.x, pos.y, pos.z, ctx, true);
  }

  /**
   * Applies 3D spatial acoustic nodes to offline clips during WAV export.
   * Supports dynamic trajectory ramps across timeline duration for both base and overlays.
   */
  function apply3dToOfflineClip(offline, srcNode, clipGain, item, itemType = 'overlay', clipTimelineStart = 0, clipDuration = 0, outputBus = null) {
    if (!item) return;
    if (!item.spatialPos) {
      item.spatialPos = { x: 0.0, y: 0.0, z: 0.0 };
    }

    const startT = Math.max(0, typeof clipTimelineStart === 'number' && !isNaN(clipTimelineStart) ? clipTimelineStart : 0);
    const dur = Math.max(0, typeof clipDuration === 'number' && !isNaN(clipDuration) ? clipDuration : 0);
    const endT = startT + dur;

    const initPos = getSpatialPosAtTime(item, startT);

    const panner = offline.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1.0;
    panner.maxDistance = 100.0;
    panner.rolloffFactor = 1.0;

    if (panner.positionX) {
      panner.positionX.setValueAtTime(initPos.x, startT);
      panner.positionY.setValueAtTime(initPos.y, startT);
      panner.positionZ.setValueAtTime(initPos.z, startT);
    } else if (panner.setPosition) {
      panner.setPosition(initPos.x, initPos.y, initPos.z);
    }

    const initParams = computeAcousticParameters(initPos.x, initPos.y, initPos.z);

    const air = offline.createBiquadFilter();
    air.type = 'lowpass';
    air.frequency.setValueAtTime(initParams.airFreq, startT);

    const pinna = offline.createBiquadFilter();
    pinna.type = 'peaking';
    pinna.frequency.setValueAtTime(6000, startT);
    pinna.Q.setValueAtTime(4.0, startT);
    pinna.gain.setValueAtTime(initParams.pinnaGain, startT);

    const rearShelf = offline.createBiquadFilter();
    rearShelf.type = 'highshelf';
    rearShelf.frequency.setValueAtTime(2800, startT);
    rearShelf.gain.setValueAtTime(initParams.rearShelfGain, startT);

    const front = offline.createBiquadFilter();
    front.type = 'peaking';
    front.frequency.setValueAtTime(3500, startT);
    front.Q.setValueAtTime(1.3, startT);
    front.gain.setValueAtTime(initParams.frontGain, startT);

    // Apply Trajectory Automations if present
    if (item.spatialTrajectory && Array.isArray(item.spatialTrajectory) && item.spatialTrajectory.length > 1) {
      const activeTrajectory = item.spatialTrajectory.filter(kf => kf.t >= startT && kf.t <= endT);
      let lastRampTime = startT;
      activeTrajectory.forEach(kf => {
        let rampT = Math.max(lastRampTime + 0.01, kf.t);
        if (dur > 0 && rampT > endT) rampT = endT;
        if (rampT <= lastRampTime) rampT = lastRampTime + 0.005;
        lastRampTime = rampT;
        const kfParams = computeAcousticParameters(kf.x, kf.y, kf.z);
        if (panner.positionX && panner.positionX.linearRampToValueAtTime) {
          panner.positionX.linearRampToValueAtTime(kf.x, rampT);
          panner.positionY.linearRampToValueAtTime(kf.y, rampT);
          panner.positionZ.linearRampToValueAtTime(kf.z, rampT);
        }
        if (front.gain && front.gain.linearRampToValueAtTime) front.gain.linearRampToValueAtTime(kfParams.frontGain, rampT);
        if (air.frequency && air.frequency.linearRampToValueAtTime) air.frequency.linearRampToValueAtTime(kfParams.airFreq, rampT);
        if (pinna.gain && pinna.gain.linearRampToValueAtTime) pinna.gain.linearRampToValueAtTime(kfParams.pinnaGain, rampT);
        if (rearShelf.gain && rearShelf.gain.linearRampToValueAtTime) rearShelf.gain.linearRampToValueAtTime(kfParams.rearShelfGain, rampT);
      });
      if (activeTrajectory.length === 0 && dur > 0.02) {
        const endPos = getSpatialPosAtTime(item, endT);
        if (Math.abs(endPos.x - initPos.x) > 0.02 || Math.abs(endPos.y - initPos.y) > 0.02 || Math.abs(endPos.z - initPos.z) > 0.02) {
          const endParams = computeAcousticParameters(endPos.x, endPos.y, endPos.z);
          if (panner.positionX && panner.positionX.linearRampToValueAtTime) {
            panner.positionX.linearRampToValueAtTime(endPos.x, endT);
            panner.positionY.linearRampToValueAtTime(endPos.y, endT);
            panner.positionZ.linearRampToValueAtTime(endPos.z, endT);
          }
          if (front.gain && front.gain.linearRampToValueAtTime) front.gain.linearRampToValueAtTime(endParams.frontGain, endT);
          if (air.frequency && air.frequency.linearRampToValueAtTime) air.frequency.linearRampToValueAtTime(endParams.airFreq, endT);
          if (pinna.gain && pinna.gain.linearRampToValueAtTime) pinna.gain.linearRampToValueAtTime(endParams.pinnaGain, endT);
          if (rearShelf.gain && rearShelf.gain.linearRampToValueAtTime) rearShelf.gain.linearRampToValueAtTime(endParams.rearShelfGain, endT);
        }
      }
    }

    clipGain.disconnect();
    clipGain.connect(front);
    front.connect(air);
    air.connect(pinna);
    pinna.connect(rearShelf);
    rearShelf.connect(panner);

    const dest = outputBus || (itemType === 'base' ? (typeof offlineBaseBus !== 'undefined' ? offlineBaseBus : (window.offlineBaseBus || null)) : (typeof offlineOverlayBus !== 'undefined' ? offlineOverlayBus : (window.offlineOverlayBus || null)));
    if (dest) {
      panner.connect(dest);
    } else {
      panner.connect(offline.destination);
    }
  }

  function canMoveBaseInGap() {
    const el = document.getElementById('sm-3d-base-gap-move');
    return el && el.value === 'allow';
  }

  function canMoveOverlay(overlayId) {
    const el = document.getElementById('sm-3d-overlay-inactive-move');
    const val = el ? el.value : 'playing_only';

    const state = typeof window.getSmOverlayPlaybackState === 'function'
      ? window.getSmOverlayPlaybackState(overlayId)
      : (typeof window.isSmOverlayPlaying === 'function' && window.isSmOverlayPlaying(overlayId) ? 'playing' : 'inactive');

    // Legacy values support
    if (val === 'allow' || val === 'always_allow') {
      return { allowed: true, state };
    }
    if (val === 'disallow' || val === 'playing_only') {
      return { allowed: (state === 'playing'), state };
    }
    if (val === 'allow_paused') {
      return { allowed: (state === 'playing' || state === 'paused'), state };
    }
    if (val === 'allow_inactive') {
      return { allowed: (state === 'playing' || state === 'inactive'), state };
    }
    return { allowed: (state === 'playing'), state };
  }

  function canMoveOverlayInactive(overlayId) {
    if (!overlayId && smLive3dActiveOverlay) overlayId = smLive3dActiveOverlay.id;
    return canMoveOverlay(overlayId).allowed;
  }

  function disengageSmLive3dMovement() {
    smLive3dActiveBase = false;
    smLive3dActiveOverlay = null;
  }

  /**
   * Toggles Live 3D movement mode for Base Audio via Ctrl + Alt + Space.
   */
  function handleSmLive3dBaseToggle() {
    if (typeof smBaseAsset === 'undefined' || !smBaseAsset || smBaseAsset.isNoBase || !smBaseAsset.name) {
      if (typeof announce === 'function') {
        announce('No base audio available to move in 3D.', true);
      }
      return;
    }

    if (!smBaseAsset.spatialPos) {
      smBaseAsset.spatialPos = { x: 0.0, y: 0.0, z: 0.0 };
    }

    if (smLive3dActiveBase) {
      // Toggle OFF
      smLive3dActiveBase = false;
      if (typeof announce === 'function') {
        announce('Base 3D movement disabled.', true);
      }
    } else {
      // Check if base is in gap or inactive and setting is disallow
      if (!canMoveBaseInGap() && typeof window.isSmBaseInGapOrInactive === 'function' && window.isSmBaseInGapOrInactive()) {
        playBoundaryTap();
        if (typeof announce === 'function') {
          announce('Cannot move base audio in 3D while in a silent gap or paused.', true);
        }
        return;
      }

      // Toggle ON
      smLive3dActiveBase = true;
      smLive3dActiveOverlay = null; // Disengage any overlay movement

      if (typeof smBaseAudio !== 'undefined' && smBaseAudio) {
        apply3dToBaseInstance(smBaseAudio, smBaseAsset);
      }

      if (typeof announce === 'function') {
        announce('Base 3D movement enabled. Use arrow keys to move base audio.', true);
      }
    }
  }

  /**
   * Handles Ctrl + [Shortcut Key] during live Super Merger recording to toggle 3D movement for an overlay.
   */
  function handleSmLive3dKey(e) {
    if (!e.ctrlKey || e.altKey || e.shiftKey) return false;
    if (typeof smOverlays === 'undefined' || !Array.isArray(smOverlays)) return false;

    // Check if key matches an overlay
    const matchedOverlay = smOverlays.find(o => {
      if (typeof matchesShortcutKey === 'function') {
        return matchesShortcutKey(o.key, e);
      }
      return (o.key || '').toLowerCase() === (e.key || '').toLowerCase();
    });

    if (!matchedOverlay) return false;

    e.preventDefault();
    e.stopPropagation();

    if (!matchedOverlay.spatialPos) {
      matchedOverlay.spatialPos = { x: 0.0, y: 0.0, z: 0.0 };
    }

    if (smLive3dActiveOverlay && smLive3dActiveOverlay.id === matchedOverlay.id) {
      // Toggle OFF
      smLive3dActiveOverlay = null;
      if (typeof announce === 'function') {
        announce(`Live 3D control disabled for ${matchedOverlay.name}.`, true);
      }
    } else {
      // Check if overlay is allowed to move in its current playback state
      const check = canMoveOverlay(matchedOverlay.id);
      if (!check.allowed) {
        playBoundaryTap();
        if (typeof announce === 'function') {
          const reason = check.state === 'paused' ? 'temporarily paused' : 'inactive';
          announce(`Cannot move ${matchedOverlay.name} in 3D while ${reason}.`, true);
        }
        return true;
      }

      // Toggle ON
      smLive3dActiveOverlay = matchedOverlay;
      smLive3dActiveBase = false; // Disengage base movement

      if (typeof announce === 'function') {
        announce(`Live 3D control enabled for ${matchedOverlay.name}. Use arrow keys to move sound in 3D space.`, true);
      }
    }
    return true;
  }

  /**
   * Checks whether 3D spatial movement is active (either overlay or base audio).
   */
  function isSmLive3dMovementActive() {
    if (smLive3dActiveBase) {
      if (!canMoveBaseInGap() && typeof window.isSmBaseInGapOrInactive === 'function' && window.isSmBaseInGapOrInactive()) {
        smLive3dActiveBase = false;
      }
    }
    if (smLive3dActiveOverlay) {
      const check = canMoveOverlay(smLive3dActiveOverlay.id);
      if (!check.allowed) {
        smLive3dActiveOverlay = null;
      }
    }
    return Boolean(smLive3dActiveBase || smLive3dActiveOverlay);
  }

  /**
   * Handles Arrow keys during live recording if Base or Overlay is in Live 3D movement mode.
   * Strictly silent for NVDA (no screen reader speech on arrow keys) so the user can listen clearly.
   */
  function handleSmLive3dArrowMove(e) {
    // If movement of the active sound is currently disallowed, disengage immediately and restore timeline navigation
    if (smLive3dActiveBase) {
      const isBaseBlocked = !canMoveBaseInGap() && typeof window.isSmBaseInGapOrInactive === 'function' && window.isSmBaseInGapOrInactive();
      if (isBaseBlocked) {
        smLive3dActiveBase = false;
        return false;
      }
    }

    if (smLive3dActiveOverlay) {
      const check = canMoveOverlay(smLive3dActiveOverlay.id);
      if (!check.allowed) {
        smLive3dActiveOverlay = null;
        return false;
      }
    }

    if (!isSmLive3dMovementActive()) return false;

    let handled = false;
    let dx = 0, dy = 0, dz = 0;
    const step = 0.4;

    if (e.shiftKey && e.key === 'ArrowUp') { dy = step; handled = true; }
    else if (e.shiftKey && e.key === 'ArrowDown') { dy = -step; handled = true; }
    else if (e.key === 'ArrowRight') { dx = step; handled = true; }
    else if (e.key === 'ArrowLeft') { dx = -step; handled = true; }
    else if (e.key === 'ArrowUp') { dz = -step; handled = true; }
    else if (e.key === 'ArrowDown') { dz = step; handled = true; }

    if (!handled) return false;

    e.preventDefault();
    e.stopPropagation();

    const targetObj = smLive3dActiveBase ? smBaseAsset : smLive3dActiveOverlay;
    if (!targetObj) return true;
    if (!targetObj.spatialPos) {
      targetObj.spatialPos = { x: 0.0, y: 0.0, z: 0.0 };
    }
    if (!targetObj.spatialTrajectory || targetObj.spatialTrajectory.length === 0) {
      targetObj.spatialTrajectory = [{ t: 0.0, x: targetObj.spatialPos.x, y: targetObj.spatialPos.y, z: targetObj.spatialPos.z }];
    }

    const pos = targetObj.spatialPos;
    const prevX = pos.x;

    let newX = pos.x + dx;
    let newY = pos.y + dy;
    let newZ = pos.z + dz;

    let hitBound = false;
    if (newX > 5.0) { newX = 5.0; hitBound = true; }
    if (newX < -5.0) { newX = -5.0; hitBound = true; }
    if (newZ > 5.0) { newZ = 5.0; hitBound = true; }
    if (newZ < -5.0) { newZ = -5.0; hitBound = true; }
    if (newY > 3.0) { newY = 3.0; hitBound = true; }
    if (newY < -3.0) { newY = -3.0; hitBound = true; }

    pos.x = parseFloat(newX.toFixed(2));
    pos.y = parseFloat(newY.toFixed(2));
    pos.z = parseFloat(newZ.toFixed(2));

    const curTime = typeof smVirtualTime !== 'undefined' ? smVirtualTime : 0;
    recordSpatialPoint(targetObj, curTime, pos.x, pos.y, pos.z);

    if (smLive3dActiveOverlay) {
      if (typeof activeOverlayAudios !== 'undefined') {
        Object.values(activeOverlayAudios).forEach(inst => {
          if (inst.overlayId === smLive3dActiveOverlay.id && inst.clipEntry) {
            recordSpatialPoint(inst.clipEntry, curTime, pos.x, pos.y, pos.z);
          }
        });
      }
      if (typeof reviewOverlayPlaybacks !== 'undefined' && Array.isArray(reviewOverlayPlaybacks)) {
        reviewOverlayPlaybacks.forEach(inst => {
          if (inst.overlayId === smLive3dActiveOverlay.id && inst.clip) {
            recordSpatialPoint(inst.clip, curTime, pos.x, pos.y, pos.z);
          }
        });
      }
    }

    if ((prevX < 0 && pos.x >= 0) || (prevX > 0 && pos.x <= 0)) {
      playCenterChime();
    }
    if (hitBound) {
      playBoundaryTap();
    }

    const ctx = sm3dAudioCtx || (typeof getAudioCtx === 'function' ? getAudioCtx() : null);

    if (smLive3dActiveBase) {
      // Update Base Audio instance
      if (typeof smBaseAudio !== 'undefined' && smBaseAudio && smBaseAudio.spatialChain && ctx) {
        updateAcousticParameters(smBaseAudio.spatialChain, pos.x, pos.y, pos.z, ctx);
      }
    } else if (smLive3dActiveOverlay) {
      // Update active overlay instances
      if (typeof activeOverlayAudios !== 'undefined' && ctx) {
        Object.values(activeOverlayAudios).forEach(inst => {
          if (inst.overlayId === smLive3dActiveOverlay.id && inst.spatialChain) {
            updateAcousticParameters(inst.spatialChain, pos.x, pos.y, pos.z, ctx);
          }
        });
      }
      // Also update review overlay instances
      if (typeof reviewOverlayPlaybacks !== 'undefined' && Array.isArray(reviewOverlayPlaybacks) && ctx) {
        reviewOverlayPlaybacks.forEach(inst => {
          if (inst.overlayId === smLive3dActiveOverlay.id && inst.spatialChain) {
            updateAcousticParameters(inst.spatialChain, pos.x, pos.y, pos.z, ctx);
          }
        });
      }
    }

    return true;
  }

  /**
   * Resets all 3D positions for Base Audio and Overlays to center (0.0, 0.0, 0.0)
   * and disengages any active live 3D movement modes.
   */
  function resetAll3dPositionsToCenter() {
    smLive3dActiveBase = false;
    smLive3dActiveOverlay = null;

    const ctx = sm3dAudioCtx || (typeof getAudioCtx === 'function' ? getAudioCtx() : null);

    if (typeof smBaseAsset !== 'undefined' && smBaseAsset && smBaseAsset.spatialPos) {
      smBaseAsset.spatialPos.x = 0.0;
      smBaseAsset.spatialPos.y = 0.0;
      smBaseAsset.spatialPos.z = 0.0;
      if (typeof smBaseAudio !== 'undefined' && smBaseAudio && smBaseAudio.spatialChain && ctx) {
        updateAcousticParameters(smBaseAudio.spatialChain, 0.0, 0.0, 0.0, ctx, true);
      }
    }

    if (typeof smOverlays !== 'undefined' && Array.isArray(smOverlays)) {
      smOverlays.forEach(ov => {
        if (ov.spatialPos) {
          ov.spatialPos.x = 0.0;
          ov.spatialPos.y = 0.0;
          ov.spatialPos.z = 0.0;
        }
      });
      if (typeof activeOverlayAudios !== 'undefined' && ctx) {
        Object.values(activeOverlayAudios).forEach(inst => {
          if (inst && inst.spatialChain) {
            updateAcousticParameters(inst.spatialChain, 0.0, 0.0, 0.0, ctx, true);
          }
        });
      }
    }
  }

  // ── Keyboard Event Listener for 3D Studio Overlay ─────────────
  function setupStudioKeyboardNavigation() {
    window.addEventListener('keydown', (e) => {
      const stage = document.getElementById('sm-3d-stage-overlay');
      if (!stage || stage.hidden) return;

      // Escape key cancels studio workflow
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        exitStudioWorkflow(false);
        return;
      }

      // Enter key drives the wizard
      if (e.key === 'Enter') {
        if (e.target && e.target.tagName === 'BUTTON') return; // Allow buttons to be triggered
        e.preventDefault();
        handleStudioEnterKey();
        return;
      }

      // Arrows move sound
      let handled = false;
      if (e.shiftKey && e.key === 'ArrowUp') { moveCurrentPosition(0, sm3dStepSize, 0); handled = true; }
      else if (e.shiftKey && e.key === 'ArrowDown') { moveCurrentPosition(0, -sm3dStepSize, 0); handled = true; }
      else if (e.key === 'ArrowRight') { moveCurrentPosition(sm3dStepSize, 0, 0); handled = true; }
      else if (e.key === 'ArrowLeft') { moveCurrentPosition(-sm3dStepSize, 0, 0); handled = true; }
      else if (e.key === 'ArrowUp') { moveCurrentPosition(0, 0, -sm3dStepSize); handled = true; }
      else if (e.key === 'ArrowDown') { moveCurrentPosition(0, 0, sm3dStepSize); handled = true; }
      else if (e.key === 'Home' || e.key === '0') { resetCurrentPosition(); handled = true; }

      if (handled) {
        e.preventDefault();
      }
    });

    // Escape listener for selection modal
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('modal-sm-3d-select');
        if (modal && !modal.hidden && modal.style.display !== 'none') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          close3dSelectionModal();
        }
      }
    }, true);
  }

  // ── Initialization & Button Wiring ────────────────────────────
  function initSm3d() {
    // 3D positioning button in Super Merger setup
    const btn3dPos = document.getElementById('btn-sm-3d-pos');
    if (btn3dPos) {
      btn3dPos.addEventListener('click', open3dSelectionModal);
    }

    // Modal buttons and keydown handling
    const modal3d = document.getElementById('modal-sm-3d-select');
    if (modal3d) {
      if (typeof setupFocusTrap === 'function') {
        setupFocusTrap(modal3d);
      }
      modal3d.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          close3dSelectionModal();
        }
      });
    }

    const stage3d = document.getElementById('sm-3d-stage-overlay');
    if (stage3d) {
      if (typeof setupFocusTrap === 'function') {
        setupFocusTrap(stage3d);
      }
      stage3d.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          exitStudioWorkflow(false);
        }
      });
    }

    const btnCloseModal = document.getElementById('btn-close-sm-3d-modal');
    if (btnCloseModal) btnCloseModal.addEventListener('click', close3dSelectionModal);

    const btnCancelModal = document.getElementById('btn-sm-3d-cancel');
    if (btnCancelModal) btnCancelModal.addEventListener('click', close3dSelectionModal);

    const btnLetsGo = document.getElementById('btn-sm-3d-letsgo');
    if (btnLetsGo) btnLetsGo.addEventListener('click', start3dStudioWorkflow);

    // Selection dropdown menu buttons (using shared dropdown setup if available)
    if (typeof setupDropdownMenu === 'function') {
      setupDropdownMenu('btn-sm-3d-sel-menu', 'sm-3d-sel-menu');
    } else {
      const btnSelMenu = document.getElementById('btn-sm-3d-sel-menu');
      const selMenu = document.getElementById('sm-3d-sel-menu');
      if (btnSelMenu && selMenu) {
        btnSelMenu.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = selMenu.hidden;
          selMenu.hidden = !isHidden;
          btnSelMenu.setAttribute('aria-expanded', String(!isHidden));
        });
        document.addEventListener('click', () => {
          if (!selMenu.hidden) {
            selMenu.hidden = true;
            btnSelMenu.setAttribute('aria-expanded', 'false');
          }
        });
      }
    }

    const itemSelAll = document.getElementById('menu-item-sm-3d-sel-all');
    if (itemSelAll) itemSelAll.addEventListener('click', selectAllFiles);

    const itemDeselAll = document.getElementById('menu-item-sm-3d-desel-all');
    if (itemDeselAll) itemDeselAll.addEventListener('click', deselectAllFiles);

    const itemInvert = document.getElementById('menu-item-sm-3d-invert-sel');
    if (itemInvert) itemInvert.addEventListener('click', invertSelectionFiles);

    // Studio Action buttons
    const btnSaveProgress = document.getElementById('btn-sm-3d-save-progress');
    if (btnSaveProgress) btnSaveProgress.addEventListener('click', saveProgressAndExit);

    const btnSkipFile = document.getElementById('btn-sm-3d-skip-file');
    if (btnSkipFile) btnSkipFile.addEventListener('click', skipCurrentFile);

    const btnCancelStudio = document.getElementById('btn-sm-3d-stage-cancel');
    if (btnCancelStudio) btnCancelStudio.addEventListener('click', () => exitStudioWorkflow(false));

    setupStudioKeyboardNavigation();
  }

  // Export on window for integration
  window.initSm3d = initSm3d;
  window.open3dSelectionModal = open3dSelectionModal;
  window.close3dSelectionModal = close3dSelectionModal;
  window.apply3dToOverlayInstance = apply3dToOverlayInstance;
  window.apply3dToBaseInstance = apply3dToBaseInstance;
  window.apply3dToOfflineClip = apply3dToOfflineClip;
  window.handleSmLive3dKey = handleSmLive3dKey;
  window.handleSmLive3dBaseToggle = handleSmLive3dBaseToggle;
  window.handleSmLive3dArrowMove = handleSmLive3dArrowMove;
  window.isSmLive3dMovementActive = isSmLive3dMovementActive;
  window.resetAll3dPositionsToCenter = resetAll3dPositionsToCenter;
  window.disengageSmLive3dMovement = disengageSmLive3dMovement;
  window.canMoveBaseInGap = canMoveBaseInGap;
  window.canMoveOverlay = canMoveOverlay;
  window.canMoveOverlayInactive = canMoveOverlayInactive;
  window.getSm3dSelectItems = () => sm3dSelectItems;
  window.start3dStudioWorkflow = start3dStudioWorkflow;
  window.exitStudioWorkflow = exitStudioWorkflow;
  window.saveProgressAndExit = saveProgressAndExit;
  window.skipCurrentFile = skipCurrentFile;
  window.updateAcousticParameters = updateAcousticParameters;
  window.getSpatialPosAtTime = getSpatialPosAtTime;
  window.recordSpatialPoint = recordSpatialPoint;
  window.updateLive3dAudioPositions = updateLive3dAudioPositions;
  window.computeAcousticParameters = computeAcousticParameters;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initSm3d();
    });
  } else {
    initSm3d();
  }
})();
