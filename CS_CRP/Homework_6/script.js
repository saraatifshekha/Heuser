/* ==========================================================================
   Catch Game — Stage 5: Debugging & Polish
   Vanilla JavaScript · Fully Offline · Delta-Time Frame-Rate Independent
   Theme: Khaki Beige (#b7ad99) & Vintage Lavender (#a06b9a)
   ========================================================================== */

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // 1. Storage Manager (localStorage Persistence with Robust Sanitization)
  // ---------------------------------------------------------------------------
  const STORAGE_KEY = "catch_game_stage4_data";

  const DEFAULT_STORAGE = {
    highScore: 0,
    maxRoundReached: 1,
    totalGamesPlayed: 0,
    totalObjectsResolved: 0,
    totalCatches: 0,
    settings: {
      soundEnabled: true,
      screenShakeEnabled: true,
      paddleSpeedMode: "normal" // "slow" (350), "normal" (420), "fast" (500)
    }
  };

  const StorageManager = (function () {
    let memoryCache = null;

    function isValidNumber(val) {
      return typeof val === "number" && Number.isFinite(val) && val >= 0;
    }

    function loadData() {
      if (memoryCache) return memoryCache;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            const parsedSettings = (parsed.settings && typeof parsed.settings === "object") ? parsed.settings : {};
            memoryCache = {
              highScore: isValidNumber(parsed.highScore) ? Math.floor(parsed.highScore) : DEFAULT_STORAGE.highScore,
              maxRoundReached: isValidNumber(parsed.maxRoundReached) && parsed.maxRoundReached >= 1 ? Math.floor(parsed.maxRoundReached) : DEFAULT_STORAGE.maxRoundReached,
              totalGamesPlayed: isValidNumber(parsed.totalGamesPlayed) ? Math.floor(parsed.totalGamesPlayed) : DEFAULT_STORAGE.totalGamesPlayed,
              totalObjectsResolved: isValidNumber(parsed.totalObjectsResolved) ? Math.floor(parsed.totalObjectsResolved) : DEFAULT_STORAGE.totalObjectsResolved,
              totalCatches: isValidNumber(parsed.totalCatches) ? Math.floor(parsed.totalCatches) : DEFAULT_STORAGE.totalCatches,
              settings: {
                soundEnabled: typeof parsedSettings.soundEnabled === "boolean" ? parsedSettings.soundEnabled : DEFAULT_STORAGE.settings.soundEnabled,
                screenShakeEnabled: typeof parsedSettings.screenShakeEnabled === "boolean" ? parsedSettings.screenShakeEnabled : DEFAULT_STORAGE.settings.screenShakeEnabled,
                paddleSpeedMode: typeof parsedSettings.paddleSpeedMode === "string" && ["slow", "normal", "fast"].includes(parsedSettings.paddleSpeedMode) ? parsedSettings.paddleSpeedMode : DEFAULT_STORAGE.settings.paddleSpeedMode
              }
            };
          } else {
            memoryCache = JSON.parse(JSON.stringify(DEFAULT_STORAGE));
          }
        } else {
          memoryCache = JSON.parse(JSON.stringify(DEFAULT_STORAGE));
        }
      } catch (e) {
        console.warn("StorageManager: localStorage inaccessible or corrupted, using memory fallback.", e);
        memoryCache = JSON.parse(JSON.stringify(DEFAULT_STORAGE));
      }
      return memoryCache;
    }

    function saveData() {
      if (!memoryCache) return;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryCache));
      } catch (e) {
        console.warn("StorageManager: failed saving to localStorage.", e);
      }
    }

    function get() {
      return loadData();
    }

    function updateHighScore(score, round) {
      const data = loadData();
      let isNewRecord = false;
      if (score > data.highScore) {
        data.highScore = score;
        isNewRecord = true;
      }
      if (round > data.maxRoundReached) {
        data.maxRoundReached = round;
      }
      saveData();
      return isNewRecord;
    }

    function recordGameEnd(score, round, resolved, catches) {
      const data = loadData();
      data.totalGamesPlayed += 1;
      data.totalObjectsResolved += resolved;
      data.totalCatches += catches;
      const isNewRecord = updateHighScore(score, round);
      saveData();
      return isNewRecord;
    }

    function updateSettings(newSettings) {
      const data = loadData();
      data.settings = Object.assign({}, data.settings, newSettings);
      saveData();
    }

    function resetAllData() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.warn("StorageManager: failed to remove localStorage key", e);
      }
      memoryCache = JSON.parse(JSON.stringify(DEFAULT_STORAGE));
      saveData();
      return memoryCache;
    }

    return {
      get,
      updateHighScore,
      recordGameEnd,
      updateSettings,
      resetAllData
    };
  })();

  // ---------------------------------------------------------------------------
  // 2. Audio Engine (Web Audio API & Speech Synthesis)
  // ---------------------------------------------------------------------------
  const SoundController = (function () {
    let audioCtx = null;
    let isMuted = !StorageManager.get().settings.soundEnabled;

    function getAudioContext() {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          audioCtx = new AudioContextClass();
        }
      }
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume();
      }
      return audioCtx;
    }

    function setMute(muted) {
      isMuted = muted;
      if (isMuted && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch (e) {}
      }
      StorageManager.updateSettings({ soundEnabled: !isMuted });
      return isMuted;
    }

    function toggleMute() {
      return setMute(!isMuted);
    }

    function getMuted() {
      return isMuted;
    }

    // 1. Pleasant Catch Harmonic Chime (Two-tone ascending sine arpeggio)
    function playCatch() {
      if (isMuted) return;
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      [
        { freq: 587.33, start: 0, dur: 0.12 }, // D5
        { freq: 880.00, start: 0.05, dur: 0.16 } // A5
      ].forEach(note => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(note.freq, now + note.start);

        gain.gain.setValueAtTime(0.2, now + note.start);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + note.start);
        osc.stop(now + note.start + note.dur);
      });
    }

    // 2. Realistic "Boom" Explosion Sound (White Noise Buffer + Low-Pass + Dual Sub Drop)
    function playBoom() {
      if (isMuted) return;
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Filtered Noise Burst
      const bufferSize = Math.floor(ctx.sampleRate * 0.5);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(50, now + 0.45);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.5, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      noiseSource.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      noiseSource.start(now);
      noiseSource.stop(now + 0.5);

      // Low Frequency Sub Drop Oscillator
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = "triangle";
      subOsc.frequency.setValueAtTime(130, now);
      subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.38);

      subGain.gain.setValueAtTime(0.6, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      subOsc.connect(subGain);
      subGain.connect(ctx.destination);

      subOsc.start(now);
      subOsc.stop(now + 0.42);
    }

    // 3. "Watch Out" Warning Sound / Voice Alert (First missed good object)
    function playWatchOut() {
      if (isMuted) return;
      
      const ctx = getAudioContext();
      if (ctx) {
        const now = ctx.currentTime;
        [0, 0.12].forEach(delay => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(440, now + delay);
          osc.frequency.exponentialRampToValueAtTime(220, now + delay + 0.08);

          gain.gain.setValueAtTime(0.18, now + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.08);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + delay);
          osc.stop(now + delay + 0.09);
        });
      }

      // Built-in speech synthesis: "Watch out!"
      if ("speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance("Watch out!");
          utterance.rate = 1.25;
          utterance.pitch = 1.2;
          utterance.volume = 0.95;
          window.speechSynthesis.speak(utterance);
        } catch (e) {
          // Graceful fallback
        }
      }
    }

    // 4. Life Lost Thud
    function playDamage() {
      if (isMuted) return;
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.22);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    }

    // 5. Game Over Melancholy Chime
    function playGameOver() {
      if (isMuted) return;
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      [
        { f: 392.00, t: 0.00 }, // G4
        { f: 349.23, t: 0.15 }, // F4
        { f: 293.66, t: 0.32 }, // D4
        { f: 220.00, t: 0.50 }  // A3
      ].forEach(note => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(note.f, now + note.t);

        gain.gain.setValueAtTime(0.28, now + note.t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + note.t + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + note.t);
        osc.stop(now + note.t + 0.32);
      });
    }

    return {
      getAudioContext,
      setMute,
      toggleMute,
      getMuted,
      playCatch,
      playBoom,
      playWatchOut,
      playDamage,
      playGameOver
    };
  })();

  // ---------------------------------------------------------------------------
  // 3. Game State Machine Enum
  // ---------------------------------------------------------------------------
  const GameStates = Object.freeze({
    MENU: "MENU",
    PLAYING: "PLAYING",
    PAUSED: "PAUSED",
    OVER: "OVER"
  });

  // ---------------------------------------------------------------------------
  // 4. DOM Elements
  // ---------------------------------------------------------------------------
  const gameContainer = document.getElementById("game-container");
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  // HUD elements
  const hudScore = document.getElementById("hud-score");
  const hudLives = document.getElementById("hud-lives");
  const hudRound = document.getElementById("hud-round");
  const hudHighScore = document.getElementById("hud-highscore");

  // HUD buttons
  const btnSettings = document.getElementById("btn-settings");
  const btnPause = document.getElementById("btn-pause");
  const pauseIcon = document.getElementById("pause-icon");
  const btnMute = document.getElementById("btn-mute");
  const muteIcon = document.getElementById("mute-icon");
  const gameToast = document.getElementById("game-toast");

  // Screens / Overlays
  const screenStart = document.getElementById("screen-start");
  const screenPause = document.getElementById("screen-pause");
  const screenGameOver = document.getElementById("screen-gameover");
  const screenSettings = document.getElementById("screen-settings");
  const modalConfirmReset = document.getElementById("modal-confirm-reset");

  // Action Buttons
  const btnStart = document.getElementById("btn-start");
  const btnOpenSettingsMenu = document.getElementById("btn-open-settings-menu");
  const btnResume = document.getElementById("btn-resume");
  const btnPauseSettings = document.getElementById("btn-pause-settings");
  const btnQuit = document.getElementById("btn-quit");
  const btnRestart = document.getElementById("btn-restart");
  const btnOverSettings = document.getElementById("btn-over-settings");
  const btnOverMenu = document.getElementById("btn-over-menu");

  // Settings & Reset elements
  const btnCloseSettings = document.getElementById("btn-close-settings");
  const btnDoneSettings = document.getElementById("btn-done-settings");
  const btnResetData = document.getElementById("btn-reset-data");
  const btnConfirmCancel = document.getElementById("btn-confirm-cancel");
  const btnConfirmReset = document.getElementById("btn-confirm-reset");

  const storageHighScore = document.getElementById("storage-high-score");
  const storageMaxRound = document.getElementById("storage-max-round");
  const storageTotalCatches = document.getElementById("storage-total-catches");
  const storageGamesPlayed = document.getElementById("storage-games-played");
  const storageTotalResolved = document.getElementById("storage-total-resolved");

  const settingSoundToggle = document.getElementById("setting-sound-toggle");
  const settingShakeToggle = document.getElementById("setting-shake-toggle");
  const settingSpeedLabel = document.getElementById("setting-speed-label");
  const speedPills = document.querySelectorAll(".btn-pill");

  // Game Over summary elements
  const summaryScore = document.getElementById("summary-score");
  const summaryBest = document.getElementById("summary-best");
  const summaryRound = document.getElementById("summary-round");
  const summaryResolved = document.getElementById("summary-resolved");
  const summaryTotalGames = document.getElementById("summary-total-games");
  const summaryNewRecord = document.getElementById("summary-new-record");

  // ---------------------------------------------------------------------------
  // 5. Constants & Speed Configurations
  // ---------------------------------------------------------------------------
  const CANVAS_WIDTH = canvas.width;   // 480
  const CANVAS_HEIGHT = canvas.height; // 640

  const PADDLE_WIDTH = 92;
  const PADDLE_HEIGHT = 16;
  const PADDLE_Y = CANVAS_HEIGHT - 38;

  const SPEED_PRESETS = {
    slow: { val: 350, label: "Slow (350 px/s)" },
    normal: { val: 420, label: "Normal (420 px/s)" },
    fast: { val: 510, label: "Fast (510 px/s)" }
  };

  const OBJECT_RADIUS = 16;
  const MAX_START_LIVES = 3;

  // Base difficulty and spawn parameters
  const BASE_FALL_SPEED = 190;           // Base pixels per second
  const BASE_SPAWN_INTERVAL = 900;       // Starting interval: 900 ms
  const MIN_SPAWN_INTERVAL = 320;        // Floor for spawn interval
  const BOMB_SPAWN_CHANCE = 0.32;        // 32% probability for bombs

  // Progression milestones
  const RESOLVED_PER_ROUND = 3;          // 3 objects resolved per round
  const STARTING_MAX_ACTIVE = 2;         // Maximum 2 active falling objects in Round 1

  // ---------------------------------------------------------------------------
  // 6. Mutable Game State
  // ---------------------------------------------------------------------------
  let currentGameState = GameStates.MENU;
  let previousStateBeforeSettings = GameStates.MENU;

  let gameState = {
    score: 0,
    lives: MAX_START_LIVES,
    round: 1,
    resolvedObjects: 0,
    catches: 0,
    maxActiveObjects: STARTING_MAX_ACTIVE,
    fallSpeed: BASE_FALL_SPEED,
    spawnInterval: BASE_SPAWN_INTERVAL,
    paddleX: (CANVAS_WIDTH - PADDLE_WIDTH) / 2,
    paddleVelocity: 0,
    items: [],
    particles: [],
    hasTriggeredFirstMissWarning: false,
    keys: {
      left: false,
      right: false
    }
  };

  let animationFrameId = null;
  let spawnTimerId = null;
  let lastTimestamp = 0;
  let toastTimeout = null;

  // ---------------------------------------------------------------------------
  // 7. Paddle Speed Helper
  // ---------------------------------------------------------------------------
  function getActivePaddleSpeed() {
    const mode = StorageManager.get().settings.paddleSpeedMode || "normal";
    return (SPEED_PRESETS[mode] || SPEED_PRESETS.normal).val;
  }

  // ---------------------------------------------------------------------------
  // 8. Sensory Feedback Helpers (Particles, Toast, Shakes)
  // ---------------------------------------------------------------------------
  function triggerScreenShake() {
    if (!StorageManager.get().settings.screenShakeEnabled) return;
    gameContainer.classList.remove("shake-impact");
    void gameContainer.offsetWidth;
    gameContainer.classList.add("shake-impact");
  }

  function showToast(text, isGold) {
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }
    gameToast.textContent = text;
    gameToast.className = isGold ? "toast-visible toast-gold" : "toast-visible";
    toastTimeout = setTimeout(() => {
      gameToast.className = "toast-hidden";
    }, 1200);
  }

  function spawnCatchParticles(x, y) {
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 140 + 40;
      gameState.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        radius: Math.random() * 3.5 + 1.5,
        color: Math.random() > 0.4 ? "#86efac" : "#b7ad99",
        alpha: 1,
        life: 0.55
      });
    }
  }

  function spawnExplosionParticles(x, y) {
    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 220 + 60;
      gameState.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 4.5 + 2,
        color: Math.random() > 0.5 ? "#f87171" : (Math.random() > 0.5 ? "#fbbf24" : "#a06b9a"),
        alpha: 1,
        life: 0.75
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 9. Game State Machine Transitions
  // ---------------------------------------------------------------------------
  function setGameState(newState) {
    currentGameState = newState;

    // Reset overlay displays
    screenStart.classList.add("hidden");
    screenPause.classList.add("hidden");
    screenGameOver.classList.add("hidden");

    switch (currentGameState) {
      case GameStates.MENU:
        screenStart.classList.remove("hidden");
        pauseIcon.textContent = "⏸️";
        btnPause.title = "Pause Game (P or Space)";
        clearTimers();
        render();
        break;

      case GameStates.PLAYING:
        pauseIcon.textContent = "⏸️";
        btnPause.title = "Pause Game (P or Space)";
        clearTimers(); // Ensure no duplicate loops or timers
        lastTimestamp = performance.now();
        scheduleNextSpawn();
        animationFrameId = requestAnimationFrame(gameLoop);
        break;

      case GameStates.PAUSED:
        screenPause.classList.remove("hidden");
        pauseIcon.textContent = "▶️";
        btnPause.title = "Resume Game (P or Space)";
        clearTimers();
        gameState.keys.left = false;
        gameState.keys.right = false;
        gameState.paddleVelocity = 0;
        break;

      case GameStates.OVER:
        screenGameOver.classList.remove("hidden");
        pauseIcon.textContent = "⏸️";
        clearTimers();
        break;
    }

    updateHUD();
  }

  function clearTimers() {
    if (spawnTimerId !== null) {
      clearTimeout(spawnTimerId);
      spawnTimerId = null;
    }
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  // ---------------------------------------------------------------------------
  // 10. Settings & Storage Menu Controls
  // ---------------------------------------------------------------------------
  function openSettingsMenu() {
    if (!screenSettings.classList.contains("hidden")) return;

    // If currently playing, automatically pause first
    if (currentGameState === GameStates.PLAYING) {
      setGameState(GameStates.PAUSED);
      previousStateBeforeSettings = GameStates.PLAYING;
    } else {
      previousStateBeforeSettings = currentGameState;
    }

    syncSettingsUI();
    screenSettings.classList.remove("hidden");
  }

  function closeSettingsMenu() {
    screenSettings.classList.add("hidden");
    modalConfirmReset.classList.add("hidden");
    updateHUD();

    // If game was playing before opening settings, let user stay paused with pause menu open
    if (previousStateBeforeSettings === GameStates.PLAYING) {
      setGameState(GameStates.PAUSED);
    }
  }

  function syncSettingsUI() {
    const data = StorageManager.get();

    // Stats display
    storageHighScore.textContent = data.highScore;
    storageMaxRound.textContent = data.maxRoundReached;
    storageTotalCatches.textContent = data.totalCatches;
    storageGamesPlayed.textContent = data.totalGamesPlayed;
    storageTotalResolved.textContent = data.totalObjectsResolved;

    // Preferences
    settingSoundToggle.checked = !!data.settings.soundEnabled;
    settingShakeToggle.checked = !!data.settings.screenShakeEnabled;

    const speedMode = data.settings.paddleSpeedMode || "normal";
    settingSpeedLabel.textContent = (SPEED_PRESETS[speedMode] || SPEED_PRESETS.normal).label;

    speedPills.forEach(pill => {
      if (pill.dataset.speed === speedMode) {
        pill.classList.add("active");
      } else {
        pill.classList.remove("active");
      }
    });

    // Mute button in HUD
    const isMuted = !data.settings.soundEnabled;
    muteIcon.textContent = isMuted ? "🔇" : "🔊";
    btnMute.title = isMuted ? "Unmute Sound (M)" : "Mute Sound (M)";
  }

  // ---------------------------------------------------------------------------
  // 11. Reset Data Handler
  // ---------------------------------------------------------------------------
  function showConfirmReset() {
    modalConfirmReset.classList.remove("hidden");
  }

  function hideConfirmReset() {
    modalConfirmReset.classList.add("hidden");
  }

  function executeDataReset() {
    StorageManager.resetAllData();
    SoundController.setMute(false); // Default sound is on

    hideConfirmReset();
    syncSettingsUI();
    updateHUD();
    showToast("All Saved Data Reset", true);
  }

  // ---------------------------------------------------------------------------
  // 12. Keyboard & Interaction Controls
  // ---------------------------------------------------------------------------
  function resetControls() {
    gameState.keys.left = false;
    gameState.keys.right = false;
    gameState.paddleVelocity = 0;
  }

  // Handle window blur and tab switching cleanly to prevent sticky keys
  window.addEventListener("blur", function () {
    resetControls();
    if (currentGameState === GameStates.PLAYING) {
      setGameState(GameStates.PAUSED);
      showToast("Auto-Paused", true);
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      resetControls();
      if (currentGameState === GameStates.PLAYING) {
        setGameState(GameStates.PAUSED);
        showToast("Auto-Paused", true);
      }
    }
  });

  window.addEventListener("keydown", function (e) {
    SoundController.getAudioContext();

    // Escape closes settings or confirm dialog
    if (e.key === "Escape") {
      if (!modalConfirmReset.classList.contains("hidden")) {
        hideConfirmReset();
        return;
      }
      if (!screenSettings.classList.contains("hidden")) {
        closeSettingsMenu();
        return;
      }
    }

    // [S] opens/closes settings menu
    if (e.key === "s" || e.key === "S") {
      if (!screenSettings.classList.contains("hidden")) {
        closeSettingsMenu();
      } else {
        openSettingsMenu();
      }
      return;
    }

    if (e.key === "ArrowLeft" || e.key === "Left") {
      if (currentGameState === GameStates.PLAYING) gameState.keys.left = true;
    } else if (e.key === "ArrowRight" || e.key === "Right") {
      if (currentGameState === GameStates.PLAYING) gameState.keys.right = true;
    } else if (e.key === "p" || e.key === "P" || e.code === "Space") {
      if (currentGameState === GameStates.PLAYING) {
        e.preventDefault();
        setGameState(GameStates.PAUSED);
        showToast("Game Paused", true);
      } else if (currentGameState === GameStates.PAUSED && screenSettings.classList.contains("hidden")) {
        e.preventDefault();
        setGameState(GameStates.PLAYING);
        showToast("Resumed", true);
      }
    } else if (e.key === "m" || e.key === "M") {
      toggleMuteHandler();
    } else if (e.key === "Enter") {
      if (currentGameState === GameStates.MENU || currentGameState === GameStates.OVER) {
        startNewGame();
      }
    }
  });

  window.addEventListener("keyup", function (e) {
    if (e.key === "ArrowLeft" || e.key === "Left") {
      gameState.keys.left = false;
    } else if (e.key === "ArrowRight" || e.key === "Right") {
      gameState.keys.right = false;
    }
  });

  function toggleMuteHandler() {
    const isMutedNow = SoundController.toggleMute();
    muteIcon.textContent = isMutedNow ? "🔇" : "🔊";
    btnMute.title = isMutedNow ? "Unmute Sound (M)" : "Mute Sound (M)";
    settingSoundToggle.checked = !isMutedNow;
    showToast(isMutedNow ? "Sound Muted" : "Sound Enabled", true);
  }

  // ---------------------------------------------------------------------------
  // 13. Event Listeners for UI Buttons
  // ---------------------------------------------------------------------------
  btnPause.addEventListener("click", function (e) {
    e.stopPropagation();
    if (currentGameState === GameStates.PLAYING) {
      setGameState(GameStates.PAUSED);
      showToast("Game Paused", true);
    } else if (currentGameState === GameStates.PAUSED) {
      setGameState(GameStates.PLAYING);
      showToast("Resumed", true);
    }
  });

  btnResume.addEventListener("click", function (e) {
    e.stopPropagation();
    setGameState(GameStates.PLAYING);
    showToast("Resumed", true);
  });

  btnMute.addEventListener("click", function (e) {
    e.stopPropagation();
    toggleMuteHandler();
  });

  btnSettings.addEventListener("click", function (e) {
    e.stopPropagation();
    openSettingsMenu();
  });

  btnOpenSettingsMenu.addEventListener("click", function () {
    openSettingsMenu();
  });

  btnPauseSettings.addEventListener("click", function () {
    openSettingsMenu();
  });

  btnOverSettings.addEventListener("click", function () {
    openSettingsMenu();
  });

  btnCloseSettings.addEventListener("click", function () {
    closeSettingsMenu();
  });

  btnDoneSettings.addEventListener("click", function () {
    closeSettingsMenu();
  });

  btnQuit.addEventListener("click", function () {
    setGameState(GameStates.MENU);
  });

  btnOverMenu.addEventListener("click", function () {
    setGameState(GameStates.MENU);
  });

  btnStart.addEventListener("click", function () {
    SoundController.getAudioContext();
    startNewGame();
  });

  btnRestart.addEventListener("click", function () {
    SoundController.getAudioContext();
    startNewGame();
  });

  // Settings preference toggles
  settingSoundToggle.addEventListener("change", function () {
    SoundController.setMute(!this.checked);
    muteIcon.textContent = this.checked ? "🔊" : "🔇";
    btnMute.title = this.checked ? "Mute Sound (M)" : "Unmute Sound (M)";
    showToast(this.checked ? "Sound Enabled" : "Sound Muted", true);
  });

  settingShakeToggle.addEventListener("change", function () {
    StorageManager.updateSettings({ screenShakeEnabled: this.checked });
    showToast(this.checked ? "Screen Shake On" : "Screen Shake Off", true);
  });

  speedPills.forEach(pill => {
    pill.addEventListener("click", function () {
      const mode = this.dataset.speed;
      speedPills.forEach(p => p.classList.remove("active"));
      this.classList.add("active");
      StorageManager.updateSettings({ paddleSpeedMode: mode });
      settingSpeedLabel.textContent = SPEED_PRESETS[mode].label;
      showToast("Paddle Speed: " + mode.toUpperCase(), true);
    });
  });

  // Reset confirmation triggers
  btnResetData.addEventListener("click", function () {
    showConfirmReset();
  });

  btnConfirmCancel.addEventListener("click", function () {
    hideConfirmReset();
  });

  btnConfirmReset.addEventListener("click", function () {
    executeDataReset();
  });

  // ---------------------------------------------------------------------------
  // 14. Game Lifecycle
  // ---------------------------------------------------------------------------
  function startNewGame() {
    clearTimers();

    gameState.score = 0;
    gameState.lives = MAX_START_LIVES;
    gameState.round = 1;
    gameState.resolvedObjects = 0;
    gameState.catches = 0;
    gameState.maxActiveObjects = STARTING_MAX_ACTIVE;
    gameState.fallSpeed = BASE_FALL_SPEED;
    gameState.spawnInterval = BASE_SPAWN_INTERVAL;
    gameState.paddleX = (CANVAS_WIDTH - PADDLE_WIDTH) / 2;
    gameState.paddleVelocity = 0;
    gameState.items = [];
    gameState.particles = [];
    gameState.hasTriggeredFirstMissWarning = false;
    gameState.keys.left = false;
    gameState.keys.right = false;

    setGameState(GameStates.PLAYING);
  }

  function triggerGameOver() {
    clearTimers();
    currentGameState = GameStates.OVER;

    SoundController.playGameOver();

    // Persist scores and stats to localStorage
    const isNewHigh = StorageManager.recordGameEnd(
      gameState.score,
      gameState.round,
      gameState.resolvedObjects,
      gameState.catches
    );

    const savedData = StorageManager.get();

    summaryScore.textContent = gameState.score;
    summaryBest.textContent = savedData.highScore;
    summaryRound.textContent = gameState.round;
    summaryResolved.textContent = gameState.resolvedObjects;
    summaryTotalGames.textContent = savedData.totalGamesPlayed;

    if (isNewHigh && gameState.score > 0) {
      summaryNewRecord.classList.remove("hidden");
      showToast("🏆 NEW HIGH SCORE!", true);
    } else {
      summaryNewRecord.classList.add("hidden");
    }

    setGameState(GameStates.OVER);
  }

  // ---------------------------------------------------------------------------
  // 15. Spawner Engine
  // ---------------------------------------------------------------------------
  function scheduleNextSpawn() {
    if (currentGameState !== GameStates.PLAYING) return;

    spawnTimerId = setTimeout(function () {
      if (currentGameState !== GameStates.PLAYING) return;

      if (gameState.items.length < gameState.maxActiveObjects) {
        spawnItem();
      }

      scheduleNextSpawn();
    }, gameState.spawnInterval);
  }

  function spawnItem() {
    const minX = OBJECT_RADIUS + 14;
    const maxX = CANVAS_WIDTH - OBJECT_RADIUS - 14;
    const randomX = Math.random() * (maxX - minX) + minX;
    const isBomb = Math.random() < BOMB_SPAWN_CHANCE;

    gameState.items.push({
      x: randomX,
      y: -OBJECT_RADIUS,
      radius: OBJECT_RADIUS,
      speed: gameState.fallSpeed,
      isBomb: isBomb,
      pulse: Math.random() * Math.PI * 2
    });

    updateHUD();
  }

  // ---------------------------------------------------------------------------
  // 16. Progression & Round Balancing
  // ---------------------------------------------------------------------------
  function onObjectResolved() {
    gameState.resolvedObjects += 1;

    // Check if new high score live during game
    if (gameState.score > StorageManager.get().highScore) {
      StorageManager.updateHighScore(gameState.score, gameState.round);
    }

    // Every 10 objects fallen = speed increases by 20 px/s
    // Every 5 objects fallen = spawn frequency increases
    const fallen = gameState.resolvedObjects;
    const speedBoost = Math.floor(fallen / 10) * 20;
    gameState.fallSpeed = BASE_FALL_SPEED + (gameState.round - 1) * 16 + speedBoost;

    const frequencyBoostSteps = Math.floor(fallen / 5);
    gameState.spawnInterval = Math.max(
      MIN_SPAWN_INTERVAL,
      BASE_SPAWN_INTERVAL - (gameState.round - 1) * 55 - (frequencyBoostSteps * 25)
    );

    // Every 3 resolved objects = round progression
    if (gameState.resolvedObjects % RESOLVED_PER_ROUND === 0) {
      advanceRound();
    }

    updateHUD();
  }

  function advanceRound() {
    gameState.round += 1;
    // NOTE: Sound effect intentionally omitted per Stage 3 & 4 rules
    showToast("Round " + gameState.round + "!", true);

    if (gameState.round === 1) {
      gameState.maxActiveObjects = 2;
    } else if (gameState.round === 2) {
      gameState.maxActiveObjects = 3;
    } else if (gameState.round === 3) {
      gameState.maxActiveObjects = 4;
    } else {
      gameState.maxActiveObjects = Math.min(6, 4 + Math.floor((gameState.round - 3) / 2));
    }
  }

  // ---------------------------------------------------------------------------
  // 17. Physics & Collision Handling
  // ---------------------------------------------------------------------------
  function updateGamePhysics(dt) {
    if (currentGameState !== GameStates.PLAYING) return;

    const currentPaddleSpeed = getActivePaddleSpeed();

    // 1. Paddle movement & velocity tracking
    let targetVelocity = 0;
    if (gameState.keys.left) targetVelocity -= currentPaddleSpeed;
    if (gameState.keys.right) targetVelocity += currentPaddleSpeed;

    gameState.paddleVelocity += (targetVelocity - gameState.paddleVelocity) * Math.min(1, 16 * dt);
    gameState.paddleX += gameState.paddleVelocity * dt;

    if (gameState.paddleX < 4) {
      gameState.paddleX = 4;
      gameState.paddleVelocity = 0;
    } else if (gameState.paddleX + PADDLE_WIDTH > CANVAS_WIDTH - 4) {
      gameState.paddleX = CANVAS_WIDTH - PADDLE_WIDTH - 4;
      gameState.paddleVelocity = 0;
    }

    // 2. Update particle system
    for (let p = gameState.particles.length - 1; p >= 0; p--) {
      const part = gameState.particles[p];
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.life -= dt;
      part.alpha = Math.max(0, part.life / 0.7);
      if (part.life <= 0) {
        gameState.particles.splice(p, 1);
      }
    }

    // 3. Update falling objects
    for (let i = gameState.items.length - 1; i >= 0; i--) {
      const item = gameState.items[i];
      item.y += item.speed * dt;
      item.pulse += 6 * dt;

      // Paddle Collision Box
      const paddleLeft = gameState.paddleX;
      const paddleRight = gameState.paddleX + PADDLE_WIDTH;
      const paddleTop = PADDLE_Y;
      const paddleBottom = PADDLE_Y + PADDLE_HEIGHT;

      // Circle vs AABB Collision Check
      const closestX = Math.max(paddleLeft, Math.min(item.x, paddleRight));
      const closestY = Math.max(paddleTop, Math.min(item.y, paddleBottom));

      const distX = item.x - closestX;
      const distY = item.y - closestY;
      const distanceSquared = (distX * distX) + (distY * distY);

      if (distanceSquared <= (item.radius * item.radius)) {
        // Collision happened with paddle
        if (item.isBomb) {
          // Bad object caught: -1 life + "Boom" sound + explosion particle burst + screen shake
          gameState.lives -= 1;
          SoundController.playBoom();
          spawnExplosionParticles(item.x, item.y);
          triggerScreenShake();
          flashHUDLives();
        } else {
          // Good object caught: +1 score + Catch sound + green sparkle particles + score bump animation
          gameState.score += 1;
          gameState.catches += 1;
          SoundController.playCatch();
          spawnCatchParticles(item.x, item.y);
          bumpHUDScore();
        }

        gameState.items.splice(i, 1);
        onObjectResolved();

        if (gameState.lives <= 0) {
          triggerGameOver();
          return;
        }
        continue;
      }

      // Check if item passed off the bottom edge
      if (item.y - item.radius > CANVAS_HEIGHT) {
        if (!item.isBomb) {
          // Missing good object: -1 life
          gameState.lives -= 1;
          flashHUDLives();

          // STAGE 3 & 4 REQUIREMENT:
          // Trigger "Watch Out" on the FIRST good object missed
          if (!gameState.hasTriggeredFirstMissWarning) {
            gameState.hasTriggeredFirstMissWarning = true;
            SoundController.playWatchOut();
            showToast("Watch Out!", false);
          } else {
            SoundController.playDamage();
          }
        }
        // Missing a bomb does nothing

        gameState.items.splice(i, 1);
        onObjectResolved();

        if (gameState.lives <= 0) {
          triggerGameOver();
          return;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 18. Canvas Rendering
  // ---------------------------------------------------------------------------
  function render() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background aesthetic guide grid lines
    ctx.save();
    ctx.strokeStyle = "rgba(183, 173, 153, 0.05)";
    ctx.lineWidth = 1;
    for (let y = 80; y < CANVAS_HEIGHT; y += 80) {
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(CANVAS_WIDTH - 10, y);
      ctx.stroke();
    }
    ctx.restore();

    // 1. Draw Active Particles
    for (let p = 0; p < gameState.particles.length; p++) {
      const part = gameState.particles[p];
      ctx.save();
      ctx.globalAlpha = part.alpha;
      ctx.fillStyle = part.color;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Draw Player Paddle with Dynamic Tilt
    ctx.save();
    const activeSpeed = getActivePaddleSpeed();
    const tilt = (gameState.paddleVelocity / activeSpeed) * 0.08;
    const paddleCenterX = gameState.paddleX + PADDLE_WIDTH / 2;
    const paddleCenterY = PADDLE_Y + PADDLE_HEIGHT / 2;

    ctx.translate(paddleCenterX, paddleCenterY);
    ctx.rotate(tilt);
    ctx.translate(-paddleCenterX, -paddleCenterY);

    ctx.shadowColor = "rgba(160, 107, 154, 0.45)";
    ctx.shadowBlur = 12;

    const paddleGrad = ctx.createLinearGradient(
      gameState.paddleX, PADDLE_Y,
      gameState.paddleX + PADDLE_WIDTH, PADDLE_Y + PADDLE_HEIGHT
    );
    paddleGrad.addColorStop(0, "#c291bd");
    paddleGrad.addColorStop(0.5, "#a06b9a");
    paddleGrad.addColorStop(1, "#82517d");

    ctx.fillStyle = paddleGrad;
    drawRoundedRect(ctx, gameState.paddleX, PADDLE_Y, PADDLE_WIDTH, PADDLE_HEIGHT, 7);
    ctx.fill();

    // Outer Khaki Beige Trim
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#b7ad99";
    ctx.stroke();

    // Glossy Highlight Strip
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.fillRect(gameState.paddleX + 6, PADDLE_Y + 2, PADDLE_WIDTH - 12, 3);
    
    // Center decorative dot
    ctx.beginPath();
    ctx.arc(paddleCenterX, paddleCenterY, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#d8d0c0";
    ctx.fill();

    ctx.restore();

    // 3. Draw Falling Objects
    for (let i = 0; i < gameState.items.length; i++) {
      const item = gameState.items[i];
      ctx.save();

      if (item.isBomb) {
        const fuseSparkPulse = (Math.sin(item.pulse) + 1) * 1.5;

        ctx.shadowColor = "rgba(160, 107, 154, 0.65)";
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
        const bombGrad = ctx.createRadialGradient(
          item.x - 4, item.y - 4, 2,
          item.x, item.y, item.radius
        );
        bombGrad.addColorStop(0, "#a06b9a");
        bombGrad.addColorStop(0.5, "#48264e");
        bombGrad.addColorStop(1, "#1d0c22");
        ctx.fillStyle = bombGrad;
        ctx.fill();

        ctx.lineWidth = 1.8;
        ctx.strokeStyle = "#b7ad99";
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Fuse Curve
        ctx.beginPath();
        ctx.moveTo(item.x, item.y - item.radius);
        ctx.quadraticCurveTo(item.x + 6, item.y - item.radius - 8, item.x + 4, item.y - item.radius - 10);
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = "#d8d0c0";
        ctx.stroke();

        // Animated Golden Spark at Fuse Tip
        ctx.beginPath();
        ctx.arc(item.x + 4, item.y - item.radius - 10, 3 + fuseSparkPulse, 0, Math.PI * 2);
        ctx.fillStyle = "#fbbf24";
        ctx.shadowColor = "#f59e0b";
        ctx.shadowBlur = 6 + fuseSparkPulse * 2;
        ctx.fill();

        // Bomb Warning cross
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(item.x - 4, item.y - 4);
        ctx.lineTo(item.x + 4, item.y + 4);
        ctx.moveTo(item.x + 4, item.y - 4);
        ctx.lineTo(item.x - 4, item.y + 4);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
        ctx.stroke();

      } else {
        const greenPulse = (Math.sin(item.pulse) + 1) * 2;

        ctx.shadowColor = "rgba(34, 197, 94, 0.55)";
        ctx.shadowBlur = 10 + greenPulse;

        ctx.beginPath();
        ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
        const ballGrad = ctx.createRadialGradient(
          item.x - 5, item.y - 5, 2,
          item.x, item.y, item.radius
        );
        ballGrad.addColorStop(0, "#a7f3d0");
        ballGrad.addColorStop(0.5, "#22c55e");
        ballGrad.addColorStop(1, "#14532d");
        ctx.fillStyle = ballGrad;
        ctx.fill();

        ctx.lineWidth = 1.8;
        ctx.strokeStyle = "#bbf7d0";
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Specular highlight
        ctx.beginPath();
        ctx.arc(item.x - 5, item.y - 5, item.radius * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
        ctx.fill();
      }

      ctx.restore();
    }
  }

  function drawRoundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }

  // ---------------------------------------------------------------------------
  // 19. Main Animation Game Loop
  // ---------------------------------------------------------------------------
  function gameLoop(currentTimestamp) {
    if (currentGameState !== GameStates.PLAYING) return;

    let dt = (currentTimestamp - lastTimestamp) / 1000;
    if (dt > 0.1) dt = 0.1;
    lastTimestamp = currentTimestamp;

    updateGamePhysics(dt);
    render();

    if (currentGameState === GameStates.PLAYING) {
      animationFrameId = requestAnimationFrame(gameLoop);
    }
  }

  // ---------------------------------------------------------------------------
  // 20. HUD Update Helpers & Sensory Animations
  // ---------------------------------------------------------------------------
  function updateHUD() {
    hudScore.textContent = gameState.score;
    hudRound.textContent = gameState.round;

    const data = StorageManager.get();
    const effectiveHigh = Math.max(data.highScore, gameState.score);
    hudHighScore.textContent = effectiveHigh;

    let hearts = "";
    for (let i = 0; i < MAX_START_LIVES; i++) {
      hearts += i < gameState.lives ? "❤️" : "🖤";
    }
    hudLives.textContent = hearts;
  }

  function bumpHUDScore() {
    hudScore.classList.remove("score-bump");
    void hudScore.offsetWidth;
    hudScore.classList.add("score-bump");
  }

  function flashHUDLives() {
    hudLives.classList.remove("lives-flash");
    void hudLives.offsetWidth;
    hudLives.classList.add("lives-flash");
  }

  // ---------------------------------------------------------------------------
  // 21. Initialization
  // ---------------------------------------------------------------------------
  function init() {
    syncSettingsUI();
    setGameState(GameStates.MENU);
  }

  init();
})();
