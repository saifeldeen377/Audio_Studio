# Audio_Studio

**Open Source · Browser-Only · Accessible**

**An accessibility-first audio workstation that lets anyone edit, trim, and mix audio entirely with a keyboard.**

- **Fully local — No Server**
- **NVDA / JAWS / VoiceOver**
- **Keyboard First**
- **Persistent Library**
- **Live Mixer (Super Merger)**

---

## Why This Project?

Most audio editing tools and digital audio workstations (DAWs) — whether desktop software or online services — are visually driven. Their interfaces rely heavily on timelines you drag, waveforms you click on, and menus that open with a right-click. For people who are blind or have low vision and rely on screen readers like **NVDA**, **JAWS**, or **VoiceOver**, these tools are essentially unusable.

This project was built to answer a simple question: _What if an audio workstation was designed for keyboard and screen reader users from day one — not as an afterthought?_

- **Accessibility First**: Every feature was designed to work fully via keyboard. No drag-and-drop. No visual-only controls. Every element has a label.
- **Privacy by Default**: Your files never leave your device. No uploads, no accounts, no cloud. Everything is processed locally in your browser.
- **No Installation Required**: Open a single HTML file and it works. No Python, no Node.js, no app stores. Just your browser.
- **Live Mixer for Everyone**: Super Merger lets you perform a live audio mix using only keyboard shortcuts — something no other accessible tool offers.

> **Note:** This project was built iteratively with real accessibility feedback in mind — every announcement, focus behavior, and keyboard shortcut was shaped by actual screen reader usage patterns.

---

## Features at a Glance

### Super Tools
- **1. Super Merger**: Live-mix audio with keyboard shortcuts. Auto-records and exports as a perfectly synced WAV.
- **2. Super Cut**: Remove multiple mistakes or unwanted sections seamlessly while listening with sample-accurate auditory cues.
- **3. Super Trim**: Live-trim audio with keyboard shortcuts. Set start and end points instantly.

### Standard Tools
- **1. Merge Audio**: Mix unlimited tracks with custom timing, crop ranges, and volume.
- **2. Merge Video**: Concatenate video clips in sequence with optional crop ranges.
- **3. Audio → Video (Slideshow)**: Turn images + a music file into a timed slideshow video.
- **4. Video → Audio (Extract)**: Extract the audio track from any video as a clean WAV file.
- **5. Trim Audio**: Crop audio to exact in/out points. Preview before you download.
- **6. Trim Video**: Crop video to exact timestamps and export as WebM.

- **Persistent Library**: Files saved locally in IndexedDB — survive page refresh.

---

## Getting Started

### Option A — Play Online (Easiest)
You can use the studio directly in your browser without downloading anything:
 **[Audio_Studio - Live Version](https://saifeldeen377.github.io/Audio_Studio/)**

### Option B — Open locally
1. Download or clone this project folder.
2. Double-click `index.html` to open in Chrome, Edge, or Firefox.
3. Done. No setup, no installation.
   > **Note:** An internet connection is required the **first time** you open the app so your browser can cache a few small assets (like Google Fonts and a video conversion library). Once cached, the app will work completely offline (unless you clear your browser cache, in which case you'll need internet once to cache them again).

### Option C — Local server
```bash
# Using Python (built into most systems)
python -m http.server 3000

# Then open your browser and go to:
# http://localhost:3000
```

### Browser Compatibility

| Browser | Status | Notes |
| :--- | :--- | :--- |
| Google Chrome 90+ | Full | Recommended |
| Microsoft Edge 90+ | Full | Recommended |
| Firefox 88+ | Full | All features work |
| Safari 15+ | Partial | WebM export may not work |

---

## The Media Library

The Media Library is the central hub. Upload once, and every tool can immediately access the file.

### How to add a file
1. Click **"Choose File"** and pick your audio, video, or image.
2. Give it a short name (e.g., `background_music`).
3. Click **"Add to Library"**. It immediately appears in all tool dropdowns.

### Managing Files
Each file in your library has three action buttons:
1. **Download**: Download the file directly to your device. The correct extension (e.g., `.wav`, `.mp3`, `.webm`) is automatically applied based on the file's exact MIME type.
2. **Preview/Show**: Play the audio/video or view the image directly in the library.
3. **Remove**: Delete the file from the library to free up space. *(Note: A confirmation dialog will appear first to ensure you don't delete files accidentally.)*

### More Library Options (Menu Button & Accessible Dialogs)
Directly above the files list is the accessible **"More library options"** menu button (`aria-haspopup="menu"`). Pressing `Enter`, `Space`, or `↓` opens a standard WAI-ARIA dropdown menu:
- **Reset library**: Opens an accessible confirmation dialog with a dedicated checkbox:
  - By default (checkbox unchecked), only your uploaded files are deleted, preserving all built-in procedural sounds (`Ambient Beep`, `Laser Sweep`, etc.).
  - Checking **"Delete all files including default sounds"** completely wipes the library.
- **Delete files by selection**: Opens a dedicated modal dialog focused solely on batch deletion:
  - Contains a clean, accessible list of file checkboxes without individual media buttons. Default sounds are clearly labeled with `(Default Sound)`.
  - Includes a **"Selection options"** menu button with: **Select all**, **Deselect all**, **Invert selection**, and **Select only user files**.
  - A live badge announces the number of selected files (`aria-live="polite"`).
  - Clicking **"Delete Selected"** confirms and permanently deletes only the selected files.
- **Download files by selection**: Opens a dedicated batch export modal dialog mirroring the batch selection experience:
  - Select any combination of files using individual checkboxes or the **"Selection options"** menu (**Select all**, **Deselect all**, **Invert selection**, and **Select only user files**).
  - Seamless keyboard navigation allows rapid browsing through checkboxes using `Arrow Down` and `Arrow Up`.
  - Shows real-time badge count (`aria-live="polite"`) and dynamically updates the confirm button (`Download Selected (N)`).
  - Clicking **"Download Selected"** initiates staggered downloads (250ms interval) to ensure browser download managers process every selected file reliably without throttling.
- **Restore default files**: Intelligently appears in the menu only if one or more default procedural sounds have been removed. Clicking it regenerates and restores only the missing default sounds without duplicating any existing files.
- **Dialog Focus Isolation**: When any confirmation dialog (such as Reset, Selection Deletion, or Single Removal) is opened, the main interface and sidebar are safely isolated (`aria-hidden="true"`). Pressing `Tab` cycles circularly strictly within the dialog controls, preventing screen readers (such as NVDA and JAWS) from getting lost in browser toolbars or background content.
- **Real-Time Library Synchronization & Safety Prompts**: When a file is removed from the library, all tools instantly remove that file from their active selectors. If an audio file assigned as base audio or overlay in Super Merger is deleted from the library while Super Merger is open, pressing "Go Now"or "Play"automatically surfaces a clear safety prompt asking if you want to proceed without it. If you press "Cancel", the studio provides clear guidance: *"Okay, choose another file to continue with, or press Go Now again to start without it."*
- **Keyboard & Screen Reader Navigation**: Full WAI-ARIA arrow key navigation (`↑`/`↓` to cycle items, `Home`/`End`, `Enter` to activate, `Escape` to close any menu or modal). Focus is safely managed at every step.

### Persistence
Files are saved automatically to your browser's **IndexedDB**. Refresh the page and they're still there. The status badge below the library title always shows the current state:

| Badge Text | Meaning |
| :--- | :--- |
| Library autosaved to browser | All files are safely stored |
| 3 file(s) restored from browser | Files reloaded after page refresh |
| Database unavailable | Storage blocked - app still works, files will not persist |

### Supported File Types
| Type | Formats |
| :--- | :--- |
| Audio | MP3, WAV, OGG, AAC, M4A, FLAC, OPUS |
| Video | MP4, WebM, OGG, AVI, MOV, MKV |
| Image | PNG, JPG, JPEG, WebP, GIF, SVG, BMP |

---

## Tools Guide

Use the **tab bar** to switch between tools. Press `←` `→` Arrow Keys when the tab bar is focused to navigate between tabs.

---

## Super Tools

### 1. Super Merger — Live Mixer

Super Merger lets you **perform a live audio mix in real time** using keyboard shortcuts, then **automatically records and exports** everything as a perfectly timed WAV — exactly matching what you heard during your performance.

### Why Super Merger Exists
Traditional editors require you to carefully place audio clips on a visual timeline using a mouse. If you can't see the screen, this is impossible.
**Super Merger solves this by turning your keyboard into a live instrument.** You play a base track, and whenever you want an overlay sound to play, you just press its key. It captures your exact timing in real-time, builds a mix, and exports it as a perfectly synced WAV file.

### Quick Start
1. Press `M` anywhere on the page - or click **"Super Merger"** in the header. Focus jumps directly to the dialog.
2. **Step 1:** Select your base audio (the backbone of your mix) or scroll to the very bottom to choose **"no base, record overlays only"**.
   - In **"No Base"** mode, Super Merger acts as a blank multi-track soundboard canvas without any background file (`Continuous` timeline). You can trigger, punch in, pause, resume, and layer overlays and live audio filters freely. When exported, the output WAV contains only your recorded overlays and filters at their exact duration.
   - If using a backing track, adjust its **Base Audio Volume** (0-100%) to ensure it sits well in the mix.
   - **Additional Settings & Behaviors:** Click the collapsible **"Additional Settings & Behaviors"** button to configure advanced settings like **Render & Export Range (Output Cutoff)**, **Base Audio End Behavior**, **Undo Behavior**, **Multiple Effects of Same Type**, and **Overwritten & Connected Effects Stop / Deletion** (detailed below). Grouped behind an accessible disclosure button, this keeps the setup clean and uncluttered.
   - **Headphone Latency Compensation & Calibration:** If you are using wireless or Bluetooth headphones with noticeable delay, click **"Calibrate Delay"** (located conveniently next to the additional settings button) and follow the audio prompts. You can also toggle the **"Apply headphone delay compensation"** checkbox on or off at any time. When disabled, the compensation value becomes 0 ms. When enabled, the studio automatically deducts your calibrated delay from both your future **overlay** and **audio effect (FX)** recordings so your final exported mix is perfectly on beat. *(Note: The calibrated delay value is unified and saved globally across Super Merger, Super Trim, and Super Cut — calibrating once in any tool automatically updates the others).*
3. **Step 2:** Add your live triggers (Overlays and Effects):
   - **For Overlays (Audio clips):** Leave type as "Audio File Overlay". Select an audio file from your library, type a shortcut key (e.g., `d`), adjust **Volume**, choose **Trigger Behavior**, and click **"Add to Super Mix"**.
   - **For Effects (Audio Filters/FX):** Change type to "Audio Effect (FX)". Select an effect (like Cave Reverb or Walkie-Talkie), assign a shortcut key, choose its target (Base track, Overlays, or All), configure its parameter (if applicable), and click **"Add to Super Mix"**.
   *(Note: If you forget a shortcut, or choose one that is already in use, the app will announce a warning and automatically return your focus to the correct field so you can fix it.)*
4. Click **"Go Now - Start Live Mixer"**. *(Focus automatically moves to the **Manage Overlays** button while session files load in the background, accompanied by periodic loading announcements for files larger than 30MB).*

### Managing Overlays and Effects
If you made a mistake or want to change your assigned triggers, use the **"Manage Overlays"** or **"Manage Effects"** buttons in the setup view. From these separate dialogs, you can:
- **Edit**: Change the assigned file/effect, shortcut key, volume, target, or behavior of any existing trigger.
- **Remove**: Delete a specific trigger entirely.
- **Reset**: Clear all overlays or effects from your setup at once.

### Keyboard Shortcuts in Super Merger
| Key | Action |
| :--- | :--- |
| `Space` | Restart playback from 0.0s (Replay mode). During replay, any new overlays you trigger will be overdubbed/layered onto the mix without erasing your previous recordings. |
| `Shift` + `Space` | Hard Pause / Resume all tracks (pauses base, timeline, active overlays, and active effects, seamlessly resuming them together) |
| `Ctrl` + `Space` | Soft-Pause / **Punch-In**. If you use this during replay, it deletes any future base segments and starts recording a new one. Can also be used to create silent gaps in the base audio where the timeline continues ticking. |
| `Ctrl` + `Shift` + `Space` | **Cancel Gap.** If in a soft-pause mid-track: rewinds timeline to where the gap started and resumes the base, as if the gap never happened. Any downstream effects and overlays shift back in sync. Behavior depends on the **Cancel Gap** setting. |
| `←` / `→` | Seek timeline back or forward by 5 seconds. |
| `Ctrl` + `←` / `→` | Delete the previous/next recorded overlay clip or effect (including during gaps) and jump to its position on the timeline. |
| `[Your Overlay Key]` | Play overlay from beginning (restarts if already playing) |
| `Shift` + `[Your Overlay Key]` | Pause / Resume that overlay from current position in both listening and the final track |
| `Alt` + `[Your Overlay Key]` | Stop, delete, and erase the currently playing overlay clip from the log and timeline |
| `[Your Effect Key]` | Toggle audio effect ON / OFF during live recording. During review/replay playback, pressing the key punches out (stops) the currently playing effect segment at the current timestamp. |
| `Alt` + `[Your Effect Key]` | Stop, delete, and erase recorded effect segments from the timeline (removes connected segments or the topmost layered pass based on your clear behavior setting). |
| `Escape` | During Setup: Exits Super Merger. During Live Session: Returns to Setup view safely. |

> **Note:** Overlays are only **recorded** when the timeline is actively running. This includes when the base audio is playing naturally, when overdubbing during a replay, and during a **Soft-Pause** gap. Triggering an overlay while the timeline is fully paused lets you audition the sound without it appearing in the final mix.

### Super Merger Effects (Live Audio FX)
You can assign real-time effects to keys and apply them live (or offline via export) to the base track, overlays, or both.
- **Auto-Pan (8D Audio)**: Pits the audio back and forth between the left and right speakers.
- **True Reverb (Cave)**: A convolution reverb that simulates massive, echoing physical spaces.
- **Radio Announcer (Bass Boost)**: A multi-stage broadcast chain that boosts bass, enhances highs, and compresses the audio for a professional podcast/radio sound.
- **Walkie-Talkie**: A distorted, band-passed megaphone/police radio effect.
- **Flanger / Underwater**: A sweeping delay effect that creates a swirling, underwater sound.
- **Pitch Shift**: Deepens or heightens the pitch in real-time (WSOLA delay-line algorithm) without altering the speed.
- **Echo, Tremolo, Doubling, Robot, Lowpass, Highpass, and Distortion**: A full suite of standard audio manipulation tools.

**Smart Effect Routing & Management**: Super Merger ensures your audio graph remains pristine, no matter how many effects you trigger:
- **Zero Signal Leakage**: Effects are routed purely in series (e.g., `Phone -> Pitch -> Reverb`). Disconnecting or changing effects instantly cleans up the internal web audio nodes to prevent "dry signal"leakage or double-triggering.
- **Intelligent Overrides & De-overlapping**: Triggering multiple instances of heavy delay-line effects (like Pitch Shifting) or same-type effects automatically cancels older active instances (live and review) when `Auto-Stop Previous` is active, preventing audio corruption, WSOLA engine conflicts, and overlapping duplicate effects in exports.
- **Headphone Latency Compensation**: The calibrated headphone delay offset is automatically subtracted from effect start and end boundaries, keeping live-triggered filters tightly in sync with the audio you hear.
- **Gap & Punch-In Synchronization**: If you cancel a soft-pause gap (`Ctrl` + `Shift` + `Space`) or punch-in over existing base audio, all subsequent recorded effect timelines are automatically shifted and kept in frame-accurate alignment.
- **State Persistence Across Pauses**: Live active effects remain engaged across hard pause and resume cycles (`Shift` + `Space`), continuing seamlessly until you toggle them off.
- **Continuous Timeline Seeking & Replay**: Live active effects do not prematurely cut off when jumping backwards or forwards on the timeline (`←` / `→`) or restarting from the beginning (`Space`). An effect remains open-ended and continues processing indefinitely from its start point until explicitly stopped by pressing its shortcut key again.
- **Calibrated Makeup Gain & Volume Balance**: Filter-heavy effects (Phone, Radio, Walkie-Talkie, Lowpass) incorporate calibrated makeup gain to prevent signal drops caused by frequency cuts, while intelligent single-pass routing guarantees compensation never stacks or doubles unexpectedly across re-recorded intervals.

### Additional Settings & Behaviors

#### Render & Export Range (Output Cutoff)
Located at the beginning of the additional settings panel, this controls where your exported WAV file ends:
- **Render full mix to the end (Default):** Renders the complete project until everything finishes. Both the full base audio file (even if you stopped listening early) and all recorded overlay sounds are rendered to their natural ends.
- **Render up to stop / save moment only:** Cuts off the export at the exact timeline timestamp where you clicked Save or stopped recording. Useful for live tape-style recordings where you only want what was actively captured.
- **Strictly up to base audio end:** Completes the entire base audio track and stops immediately when the base finishes, trimming off any trailing overlay tails that extend past the base.
- **Up to last active overlay end:** Renders until the end of the last recorded overlay sound and stops there, without continuing unneeded base audio. This completely eliminates the "dead air"problem when using long background music tracks with short dialogue or effects.

#### Base Audio End Behavior
Under the Base Audio File selection, you can configure what happens when the base audio ends physically:
- **Stop Timeline (Default):** Playback stops and recording is capped immediately. If you decide you want to continue recording, simply press `Ctrl` + `Space` to manually restart the timeline. Press it again when you are finished.
- **Auto-Continue Timeline:** Automatically transitions into a soft-paused state so the virtual timeline continues to tick, allowing you to seamlessly record extra overlay sounds at the end.

**Important details about timeline behavior at the end of the base track:**
- **Dynamic Settings Evaluation:** If you replay your mix from the beginning (by pressing `Space`), the behavior at the end of the base audio is always determined by your *current* setting in the dropdown at the exact moment the base ends. For example, if you chose "Auto-Continue", manually stopped the timeline with `Ctrl` + `Space`, and then restarted from the beginning, the timeline will still automatically continue when the base finishes again, regardless of your previous manual pause.
- **Using `Ctrl` + `Space` after the base ends:** If you press `Ctrl` + `Space` during the "Auto-Continue"phase (when the base audio has already finished but the timeline is still running and overlay sounds are playing), it acts as a clean manual stop. It pauses the timeline and silences any currently playing overlays, without causing any issues or unintended punch-ins to the base audio. Pressing it again will resume the timeline so you can continue adding overlays.

#### Undo Behavior
Choose how `Ctrl` + `←` / `→` behaves when deleting an overlay clip:
- **Delete & Seek (Default):** Deletes the clip and immediately jumps the timeline back to where that clip started, allowing you to seamlessly re-record it in context.
- **Delete Only:** Deletes the clip but keeps the timeline playing exactly where it is. Useful if you made a mistake but don't want to break the flow of your live recording session.

#### Ctrl+Shift+Space — Cancel Gap Behavior
Choose how the **Cancel Gap** shortcut works when you are inside a soft-pause silent period:
- **Only when gap has no overlays (Default):** The gap is cancelled only if no overlay clips were triggered during it. If overlays exist in the gap, the shortcut does nothing and announces a warning.
- **Always:** Cancels the gap regardless — any overlays that were triggered during the gap are stopped and deleted along with it.

#### Trigger Behavior (Cutoff vs Overlap)
When assigning a shortcut key to an overlay, you can configure how it behaves when pressed rapidly:
- **Overlap (Default):** If you press the key multiple times, the sound will play on top of itself. This is ideal for sounds with long tails (like crash cymbals or pads) where you want the sound to ring out naturally without being cut short.
- **Cutoff:** If you press the key multiple times, the currently playing instance of the sound will instantly stop, and a new one will begin. This acts as a " Choke Group"and is perfect for percussive hits, vocal chops, or melodic samples. **Note:** This choke behavior applies both during live recording and when playing back previously recorded overlays (overdubbing).

#### Multiple Effects of Same Type (e.g., 2 Pitch keys)
Configure how the mixer handles triggering multiple effects of the same type (such as two different Pitch Shift presets or multiple Reverbs):
- **Auto-Stop Previous (Default):** Pressing a shortcut for an effect of a type that is already running immediately stops the current active instance (both live and review playback) before starting the new one. This prevents WSOLA pitch delay-line conflicts, avoids duplicate signal processing, and eliminates clashing stacked effects during export.
- **Allow Overlap:** Allows multiple instances of the same effect type to run simultaneously on the audio bus.

#### Overwritten & Connected Effects Stop / Deletion
Configure how the timeline handles stop and delete actions when an effect has been recorded in overlapping passes or contiguous segments:
- **Unified (Default):** Contiguous or touching segments of the same effect are treated as a single unified effect. When you stop live recording, the effect ends cleanly (any touching downstream remnants are swallowed so the effect never restarts unexpectedly later). Deleting via `Alt` + `[Your Key]` or timeline actions deletes the entire connected segment cluster at once.
- **Sequential / Layered (Preserves History):** Each recording pass is tracked as an independent layer with an undo history (while strictly ensuring zero double-processing during playback and export). Deleting via `Alt` + `[Your Key]` removes only the most recent recording pass and automatically restores the underlying prior pass to its original boundaries. A second delete will then remove the earlier pass.

#### Collapsible Additional Settings Panel
All secondary mixer behaviors in Step 1 are tucked inside an accessible disclosure panel toggled with the **"Additional Settings & Behaviors"** button. Built using standard button disclosure semantics (`aria-expanded` and `aria-controls`), it keeps the setup screen streamlined while ensuring screen readers (NVDA, JAWS) announce clear collapsed/expanded status without intrusive list announcements ("1 of 1").

### Resuming Interrupted Sessions
If you accidentally press `Escape` or leave the Live Mixer while you have a session with recorded clips or an active timeline, your work is perfectly preserved. When you open the Super Merger again, a **Continue Recording** button will appear next to the "Go Now"button. Clicking it instantly restores your base track, timeline, and all overlays precisely where you left off, and seamlessly auto-resumes the playback and recording.

### Live Session Actions
During the live performance, you can use the actions located in the **Super Merger Header** (right next to the Close button):
- ** Download WAV:** Click this button to render and download your current live mix. The app processes the base audio and overlays via `OfflineAudioContext` (much faster than real-time) and downloads a WAV file with exact timing. You can also use **Save to Library** to keep the result in the studio without downloading.
- ** Reset & Restart:** Click this to clear all recorded overlays, base track segments, and logs, seek the base audio back to 0.0s, and restart the recording from scratch.

### 2. Super Cut — Live Audio Cleaner

Super Cut allows you to listen to an audio file and seamlessly "cut out"multiple mistakes, long pauses, stutters, or unwanted sections in real time using simple, muscle-memory keyboard shortcuts. Designed specifically for podcasters, voice actors, students, and audio engineers who cannot rely on dragging mouse cursors across visual waveform timelines.

#### Core Workflow
1. Press `C` anywhere on the page (or click **"Super Cut"** in the header) to open the interface. Focus instantly lands inside the workspace.
2. Select your audio file from your library and press `Space` to start playback immediately.
3. When you hear a mistake or section you want to cut out, press **`s`** (or `[`). This sets the cut start point.
4. When the mistake finishes and the good audio resumes, press **`e`** (or `]`). This sets the cut end point and registers the removal region.
5. The audio continues playing uninterrupted. Repeat this sequence (`s` then `e`) as many times as needed to clean an entire recording in a single live pass.
6. Press `Space` at any time to toggle play/pause directly.
7. Click **"Preview Remaining Audio"** to hear how your file sounds with all cuts seamlessly excised.
8. Click **"Download Remaining WAV"** to export a pristine 16-bit PCM WAV, or **"Save to Library"** to keep it within AudioStudio for further mixing.

#### Auditory Feedback & Cut Markers (Zero Visual Dependency)
Super Cut provides complete auditory grounding so you know exactly where cuts lie without looking at the screen:
- **Live Playback Cut Cues:** While playing or scrubbing audio, Super Cut schedules sample-accurate audio cues via the Web Audio API:
  - **Cut Start Cue:** A clean high-frequency tone blip sounds at the exact start of every cut.
  - **Cut End Cue:** A clean low-frequency tone blip sounds at the exact end of every cut.
- **Deletion Confirmation Micro-Beep (1760 Hz):** Whenever any cut, end, or start marker is removed via keyboard shortcuts, Super Cut plays an ultra-short (20ms) pure sine micro-beep. This crisp audio blip gives immediate positive feedback without interrupting your concentration, and sounds completely distinct from boundary cue clicks to eliminate any ambiguity.

#### Comprehensive Deletion & Correction Shortcuts
Mistakes during cutting are effortlessly corrected on the fly using dedicated arrow key combinations:
- **`Ctrl + Left Arrow`**: Deletes the **previous full cut** before the current playback position.
- **`Ctrl + Right Arrow`**: Deletes the **next full cut** after the current playback position.
- **`Shift + Left Arrow`**: Deletes the **previous cut end**, reverting that cut back to an open-ended active start so you can mark a new end with `e`.
- **`Shift + Right Arrow`**: Deletes the **next cut end**, reopening that cut's boundary.
- **`Alt + Left Arrow`**: Deletes the **previous cut start**, leaving the cut awaiting a new start point with `s` while preserving its end point.
- **`Alt + Right Arrow`**: Deletes the **next cut start**.

#### Customizable Deletion Seek Behavior
Configure how the playback cursor behaves when deleting cuts or boundaries:
- **Jump to Deleted Range (Default):** Playback instantly jumps to the deleted cut's start or end boundary so you can immediately re-listen and place accurate cut points.
- **Don't Jump (Keep Current Position):** The cut is removed while playback continues unaffected from its current position.
- **Custom Settings:** Discloses independent controls to customize seek targets for each operation:
  - **Full Cut Deletion:** Jump to Cut Start or Don't Jump.
  - **Cut End Deletion:** Jump to Cut End, Jump to Cut Start, or Don't Jump.
  - **Cut Start Deletion:** Jump to Cut Start, Jump to Cut End, or Don't Jump.
- **Screen Reader Peace of Mind:** Selecting options in these menus is silent—no repetitive screen reader chatter is announced because screen readers automatically speak focused list items natively.
- **Persistent Storage:** Your chosen seek preferences are saved locally to `localStorage` across sessions.

#### Direct Spacebar Playback Engine
Pressing `Space` anywhere in Super Cut directly plays, pauses, or resumes the audio immediately—even if focus is currently resting on a dropdown menu or button. It prevents dropdown menus from inadvertently expanding and eliminates frustrating extra keystrokes.

#### Manage Cuts Modal Dialog
Click **"Manage Cuts"** (or press the button in the view) to open a dedicated, focus-trapped dialog listing all registered cut regions:
- **Individual Cut Preview:** Audition the exact audio snippet inside any cut to verify what will be removed.
- **Individual Cut Removal:** Cancel and restore any specific cut with a single click or `Enter`.
- **Delete All Cuts:** Clears all defined cuts at once with safety confirmation.
- **Focus Trap:** Tab navigation cycles strictly within the dialog until closed with `Escape` or the Close button, safely returning focus to the Manage Cuts trigger.

#### Keyboard Shortcuts in Super Cut
| Key | Action |
| :--- | :--- |
| `Space` | Direct Play / Pause from anywhere in Super Cut |
| `S` or `[` | Set Start point (beginning of mistake to cut) |
| `E` or `]` | Set End point (end of mistake to cut) |
| `Ctrl + ←` | Delete previous full cut |
| `Ctrl + →` | Delete next full cut |
| `Shift + ←` | Delete previous cut end (reopens start) |
| `Shift + →` | Delete next cut end |
| `Alt + ←` | Delete previous cut start (awaits new start) |
| `Alt + →` | Delete next cut start |
| `←` / `→` | Skip backward or forward by 5 seconds (works during preview) |
| `Escape` | Exit Super Cut and return safely to main workspace |

#### Smart Edge Cases & Error Tolerance
- **Missing End:** Pressing `s` without a subsequent `e` cuts from that start timestamp all the way to the end of the file.
- **Missing Start:** Pressing `e` without a preceding `s` cuts from 0.0s (beginning of the file) up to that end timestamp.
- **Sequential Duplicate Presses:** Pressing `s` twice updates the active cut start to the newer timestamp without creating an invalid cut. Pressing `e` twice extends or shortens the active cut end cleanly.
- **Global Headphone Latency Compensation:** Synchronized with Super Merger and Super Trim, deducting your measured Bluetooth delay so cut boundaries match the acoustic audio you perceived.

---

### 3. Super Trim — Live Audio Cropper

Super Trim is the fastest, most precise way to crop audio files using only your keyboard. It was designed to solve the problem of visual timeline dependency in traditional editors.

#### How to use
1. Press `T` anywhere on the page, or click **"Super Trim"** in the header. Focus jumps directly to the dialog.
2. Select your audio file and press `Space` to start playing.
3. Listen to the audio. Exactly when you hear the start point, press **`s`** (or `[`).
4. Exactly when you hear the end point, press **`e`** (or `]`).
5. Click **"Preview Trimmed Range"** to hear the exact cut.
6. Click **"Download Trimmed WAV"** to download, or **"Save to Library"** to keep it in the app.

#### Keyboard Shortcuts in Super Trim
| Key | Action |
| :--- | :--- |
| `Space` | Play / Pause main audio and Preview |
| `S` or `[` | Set Start point at current playback time |
| `E` or `]` | Set End point at current playback time |
| `←` / `→` | Skip backward or forward by 5 seconds (Works during Preview as well) |
| `Escape` | Exit Super Trim |

#### Why Super Trim is Unique
- **100% Sample-Accurate Sync:** Super Trim bypasses the standard browser audio player and uses the raw `Web Audio API` for playback. This means the time you capture during playback is guaranteed to have **0ms of drift** compared to the final exported file (a common issue when playing MP3s in Chrome/Edge).
- **International Keyboard Support:** The shortcuts `s` / `[` for start and `e` / `]` for end read physical key codes, meaning they work perfectly on any layout.
- **Headphone Latency Compensation:** Using Bluetooth headphones? Calibrate your delay once (shared globally across Super Merger, Super Trim, and Super Cut) and Super Trim will automatically offset marked In/Out points backward so you never trim too late due to wireless audio delay. Calibrating in any tool automatically synchronizes across all three.

---

## Standard Tools

### 1. Merge Audio
Mix multiple audio tracks into one WAV file. All tracks play simultaneously, positioned by time.
1. Select a file from the library dropdown.
2. Set **"Start at"** — when this track begins in the final mix (seconds).
3. Optionally set **"Crop from"** and **"Crop until"** to use a portion of the file.
4. Set the **Volume** (0–100%).
5. Click **"Add to Mix"**. Repeat for each track.
6. Click **"Preview Mix"** to listen, then **"Export WAV"** or **"Save to Library"**.

> **Tip:** You can add the same file multiple times with different start times to create loops or layered echoes.

### 2. Merge Video
Join multiple video clips one after another into a single WebM file.
1. Select a video, optionally set crop range, click **"Add to Queue"**.
2. Repeat for all clips (they play in the order you added them).
3. Click **"Export Video"** or **"Save to Library"** to start processing.

> **Warning:** **Real-time export:** A 5-minute video takes ~5 minutes to process. Don't close the tab during export.

### 3. Audio → Video (Slideshow)
Combine a music track with images to create a timed slideshow video.
1. Select your audio/music file in Step 1.
2. For each slide: select an image, set "Show from" and "Show until" (seconds), click **"Add Image Slide"**.
3. Click **"Generate Slideshow Video"** or **"Save to Library"**.

### 4. Video → Audio (Extract)
Strip the audio track out of a video and save it as a WAV file.
1. Select a video from the library.
2. Click **"Extract Audio as WAV"** or **"Save to Library"**.

> **Warning:** **Memory note:** Files over 50MB will trigger a warning on systems with 4GB RAM before decoding begins.

### 5. Trim Audio
1. Select an audio file. Set Start and End times.
2. Click **"Preview Trim"** to hear the result.
3. Click **"Export Trimmed WAV"** or **"Save to Library"**.

### 6. Trim Video
1. Select a video file. Set **"Trim Start"** and **"Trim End"** (seconds).
2. Click **"Download Trimmed Video (WebM)"** or **"Save to Library"** to process.

---

## Accessibility

Accessibility is not a feature here — it's the foundation.

### Smart Preview Controls
All tools and the media library use smart, accessible preview buttons and playback management:
- **Play/Pause/Resume**: Toggles the preview. The button label naturally updates, allowing screen readers to announce the state automatically without annoying extra notifications.
- **Stop**: Hard stops the preview and resets to 0.0s. It is hidden by default, appears only when playing/paused, and disappears when stopped. If triggered by a screen reader or keyboard, focus is safely forced back to the Play button so you never lose your place. Pressing Stop also fully deactivates arrow key seeking to prevent accidental playback resumption.
- **Replay**: Rewinds the preview to 0.0s and continues playing. Like the Stop button, it auto-hides when not needed and safely transfers focus back to Play if activated while visually hidden.
- **Single-Stream Engine (Zero Audio Overlap)**: Playing any preview in the library or any standard tool instantly and automatically stops whatever was previously playing. Switching tabs also halts background playback, ensuring only one clean audio or video stream plays at a time.
- **Arrow Key Seeking & Natural End Rewind**: During any active preview, pressing Left Arrow (`←`) or Right Arrow (`→`) seeks backward or forward by 5 seconds with zero screen reader speech interruption. If a track reaches its natural end, pressing Left Arrow (`←`) automatically resumes and plays the final 5 seconds. Once explicit Stop is clicked, arrow navigation is deactivated.

### Screen Reader Support
- ARIA live regions (`aria-live="polite"` and `aria-live="assertive"`) announce all events.
- Every button, input, and element has a descriptive `aria-label`.
- Super Merger dialog receives **automatic focus** on open — no need to scroll or search.
- Live mixing is **screen-reader-silent by design** — no announcements during key presses so you can focus on listening.

### Keyboard Navigation
| Key | Action |
| :--- | :--- |
| `Tab` / `Shift+Tab` | Move between all interactive elements |
| `←` `→` (In Tab Bar) | Navigate between tabs in the tab bar |
| `←` `→` (During Preview) | Seek backward / forward 5s silently (or replay last 5s when track naturally finished) |
| `Enter` / `Space` | Activate buttons and checkboxes |
| `M` | Open Super Merger from anywhere |
| `C` | Open Super Cut from anywhere |
| `T` | Open Super Trim from anywhere |

### Comparison


| Feature | Audio_Studio | Traditional Editors |
| ------- | ----------------------- | ------------------- |
| **Workflow** | Keyboard-centric & Live Mixing | Mouse-centric Visual Timelines |
| **Accessibility** | Designed for screen readers | Primarily designed for visual workflows |
| **Installation** | Zero (Runs entirely in browser) | Heavy desktop installations |
| **Privacy** | Fully offline (No uploads) | Often requires cloud uploads |

---

## Data & Privacy

- **All processing happens in your browser.** No files are ever sent to any server.
- Files are stored in your browser's **IndexedDB** — sandboxed, local, private.
- Clearing browser site data will erase the stored library.
- **No cookies. No analytics. No tracking of any kind.**

---

## Known Limitations

| Limitation | Reason |
| :--- | :--- |
| Video export is WebM only | Browsers only encode WebM natively. MP4 needs ffmpeg.wasm (~30MB) — too heavy for low-RAM systems. |
| Video export is real-time | MediaRecorder works in real time; a 5-min video takes 5 minutes to export. |
| Large files may slow the tab | `decodeAudioData` loads the full file into RAM. Files over 50MB trigger a warning. |
| Library is per-browser | IndexedDB is scoped to the browser. Switching browsers or going incognito starts fresh. |

---

## Technical Notes

### Stack
- **Pure HTML, CSS, JavaScript** — zero frameworks, zero build tools, zero dependencies.
- **Web Audio API** — audio decoding, mixing, and WAV rendering via `OfflineAudioContext`.
- **MediaRecorder API** — video capture and concatenation.
- **IndexedDB** — persistent local file storage.
- **Google Fonts (Outfit)** — requires a one-time internet connection for typography.

### File Structure
```text
audio_studio/
├── index.html # App structure, ARIA markup, all tool panels
├── readme.md # Documentation (Markdown format)
├── readme.html # Documentation (HTML format)
├── style.css # Dark theme, layout, animations, component styles
├── script_globals.js # Base utilities, db, library, tabs
├── script_main.js # Main initialization script
└── script_*.js # Tool scripts (merge, trim, super-merger)
```

### WAV Encoder
A custom 16-bit PCM WAV encoder (`audioBufferToWav`) is written from scratch and handles:
- Multi-channel audio (stereo and mono).
- Correct RIFF/WAVE header generation.
- Float32 → Int16 sample conversion with clamping.

### Super Merger Recording Engine
The live mixer uses a **timeline-based clip log** (`smRecordedClips`) and **effect segment log** (`smRecordedEffects`). Each overlay trigger creates a clip with:
- `timelineStart` — when in the base timeline this clip begins (adjusted by calibrated headphone latency).
- `cropStart` — where in the overlay file playback starts.
- `cropEnd` — where it stops (set on pause or retrigger).

Similarly, each recorded audio effect tracks its timeline window (`timelineStart` to `timelineEnd` with headphone delay offset), target audio bus, effect parameters, and overwrite layer history. The exporter replays all clips and effects through an `OfflineAudioContext` — applying effects strictly in de-overlapped series for studio-quality exports that perfectly match the live performance.


## Screen Reader Compatibility
We designed this app to feel completely natural for screen reader users (like NVDA, JAWS, or VoiceOver). You don't need to learn any complex rules to use it:

- **Recommended Mode (Focus / Application Mode):** For the smoothest experience, use **Focus Mode** (NVDA: `NVDA + Space`, JAWS: `Forms Mode`). Because the app relies heavily on live single-key shortcuts (Space for Play/Pause, shortcut keys for live mixing and trimming), Focus Mode allows key presses to pass directly to the app without Virtual Buffer latency, avoiding screen reader virtual cursor misalignment when closing dialogs or switching tools.
- **Quiet and Clean:** We removed unnecessary notifications and emojis. The app only speaks when it's important.
- **Smart Focus:** When you click buttons that disappear (like stopping a preview), we automatically move your cursor to the next logical place (like the Play button) so you never get lost.
- **Accident-Proof:** Destructive actions, like removing a file, will always ask you to confirm first, protecting you from accidental clicks.
- **Full Keyboard Control:** Everything you can do with a mouse, you can do instantly with simple keyboard shortcuts.


---
*Built with care for accessibility. Everyone deserves powerful tools. · Audio_Studio*
