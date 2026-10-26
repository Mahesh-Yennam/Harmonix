/**
 * Harmonix - High-DPI Vector Resonance Visualizer
 * Crystal-clear 60fps rendering, sub-pixel anti-aliasing, and harmonic physics.
 * Fully responsive for mobile devices, tablets, and desktop.
 */

// ============================================================================
// Visualizer Engine & State
// ============================================================================
const isMobileDevice = window.innerWidth <= 640;

const state = {
  ringCount: 16,
  speed: 1.0,
  strokeWidth: 2.0,
  mode: 'harmonic', // 'harmonic' | 'cymatics' | 'orbit' | 'spirograph'
  theme: 'neon',
  isPaused: false,
  soundEnabled: false,
  hudVisible: !isMobileDevice, // Start collapsed on mobile for clean immersion

  // Smooth cursor tracking
  mouseX: window.innerWidth / 2,
  mouseY: window.innerHeight / 2,
  targetMouseX: window.innerWidth / 2,
  targetMouseY: window.innerHeight / 2,

  time: 0,
};

const THEMES = {
  neon: {
    name: 'Cyber Neon',
    c1: [0, 245, 212],   // #00f5d4 Cyan
    c2: [123, 44, 191],  // #7b2cbf Violet
    c3: [247, 37, 133],  // #f72585 Pink
    bg: '#04060e',
    glow: 'rgba(0, 245, 212, 0.3)'
  },
  aurora: {
    name: 'Aurora',
    c1: [0, 255, 135],   // #00ff87 Mint
    c2: [0, 97, 255],    // #0061ff Deep Blue
    c3: [96, 239, 255],  // #60efff Ice
    bg: '#03080e',
    glow: 'rgba(0, 255, 135, 0.3)'
  },
  solar: {
    name: 'Solar Gold',
    c1: [255, 208, 0],   // #ffd000 Gold
    c2: [255, 75, 0],    // #ff4b00 Orange
    c3: [255, 0, 85],    // #ff0055 Rose
    bg: '#090504',
    glow: 'rgba(255, 208, 0, 0.35)'
  },
  amethyst: {
    name: 'Amethyst',
    c1: [224, 170, 255], // #e0aaff Lavender
    c2: [157, 78, 221],  // #9d4edd Violet
    c3: [58, 12, 163],   // #3a0ca3 Indigo
    bg: '#06040e',
    glow: 'rgba(199, 125, 255, 0.3)'
  },
  electric: {
    name: 'Electric Glacial',
    c1: [0, 210, 255],   // #00d2ff Ice Blue
    c2: [58, 134, 255],  // #3a86ff Azure
    c3: [240, 248, 255], // #f0f8ff Alice White
    bg: '#03050c',
    glow: 'rgba(0, 210, 255, 0.35)'
  }
};

// ============================================================================
// Canvas Setup with Retina / High-DPI Scaling & Mobile Orientation Support
// ============================================================================
const canvas = document.getElementById('visualizer-canvas');
const ctx = canvas.getContext('2d');
let width = window.innerWidth;
let height = window.innerHeight;
let dpr = 1;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  // Scale context once for crisp high-DPI
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => {
  setTimeout(resize, 120);
});
resize();

// ============================================================================
// Audio Synthesizer (Ambient Crystal Chimes)
// ============================================================================
let audioCtx = null;
const NOTES = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 659.25, 783.99];

function initAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playChime(freq = null) {
  if (!state.soundEnabled || !audioCtx) return;
  try {
    const f = freq || NOTES[Math.floor(Math.random() * NOTES.length)];
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, audioCtx.currentTime);

    gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, audioCtx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.2);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 1.2);
  } catch (e) {
    console.debug('Audio error', e);
  }
}

// ============================================================================
// Interactive Shockwaves
// ============================================================================
const shockwaves = [];

function addShockwave(x, y) {
  const minDim = Math.min(width, height);
  shockwaves.push({
    x,
    y,
    radius: 4,
    maxRadius: minDim * 0.55,
    alpha: 0.9,
    speed: (minDim < 600 ? 4.5 : 6) * state.speed
  });
  playChime();
}

// Color interpolator
function getColor(t, theme) {
  const c1 = theme.c1;
  const c2 = theme.c2;
  const c3 = theme.c3;

  let r, g, b;
  if (t < 0.5) {
    const localT = t / 0.5;
    r = Math.round(c1[0] + (c2[0] - c1[0]) * localT);
    g = Math.round(c1[1] + (c2[1] - c1[1]) * localT);
    b = Math.round(c1[2] + (c2[2] - c1[2]) * localT);
  } else {
    const localT = (t - 0.5) / 0.5;
    r = Math.round(c2[0] + (c3[0] - c2[0]) * localT);
    g = Math.round(c2[1] + (c3[1] - c2[1]) * localT);
    b = Math.round(c2[2] + (c3[2] - c2[2]) * localT);
  }
  return { r, g, b };
}

// ============================================================================
// Rendering Modes (Responsive Vector Math)
// ============================================================================

// Mode 1: Harmonic Pulse (Razor-sharp infinite concentric ripples)
function drawHarmonicPulse(cx, cy, maxRadius, currentTheme) {
  const count = state.ringCount;
  const t = state.time;

  for (let i = 0; i < count; i++) {
    const phase = (t * 0.12 * state.speed + i / count) % 1;
    const radius = Math.pow(phase, 1.8) * maxRadius;
    if (radius < 2) continue;

    const alpha = Math.sin(phase * Math.PI) * (1 - Math.pow(phase, 3));
    if (alpha <= 0.01) continue;

    const { r, g, b } = getColor(phase, currentTheme);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
    ctx.lineWidth = state.strokeWidth * (0.8 + (1 - phase) * 0.8);
    ctx.stroke();

    // Subtle crisp glow ring for every 3rd circle
    if (i % 3 === 0 && alpha > 0.3) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(alpha * 0.3).toFixed(3)})`;
      ctx.lineWidth = state.strokeWidth * 2.8;
      ctx.stroke();
    }

    // Orbiting micro-satellite dot
    const nodeAngle = t * (0.5 + (i % 3) * 0.3) + i * 1.618;
    const nx = cx + Math.cos(nodeAngle) * radius;
    const ny = cy + Math.sin(nodeAngle) * radius;

    ctx.beginPath();
    ctx.arc(nx, ny, width < 600 ? 2 : 2.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${(alpha * 0.9).toFixed(3)})`;
    ctx.fill();

    ctx.restore();
  }
}

// Mode 2: Cymatic Waves (Dual-focus acoustic interference pattern)
function drawCymatics(cx, cy, maxRadius, currentTheme) {
  const count = state.ringCount;
  const t = state.time;

  const f2x = cx + (state.mouseX - cx) * 0.55;
  const f2y = cy + (state.mouseY - cy) * 0.55;

  for (let i = 0; i < count; i++) {
    const phase = (t * 0.1 * state.speed + i / count) % 1;
    const radius = phase * maxRadius * 0.85;
    const alpha = Math.sin(phase * Math.PI) * 0.75;
    if (alpha <= 0.02) continue;

    const { r, g, b } = getColor(phase, currentTheme);

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
    ctx.lineWidth = state.strokeWidth;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(f2x, f2y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(alpha * 0.7).toFixed(3)})`;
    ctx.lineWidth = state.strokeWidth * 0.85;
    ctx.stroke();
  }
}

// Mode 3: Orbital Gyro (3D Tilted Gimbal Loops)
function drawOrbitalGyro(cx, cy, maxRadius, currentTheme) {
  const count = state.ringCount;
  const t = state.time;

  for (let i = 0; i < count; i++) {
    const progress = (i + 1) / count;
    const radius = progress * maxRadius * 0.75;
    const { r, g, b } = getColor(progress, currentTheme);

    const tilt = 0.35 + Math.sin(t * 0.5 + i * 0.4) * 0.25;
    const rot = t * (0.3 + (i % 2 === 0 ? 0.2 : -0.2)) * state.speed + (i * Math.PI) / count;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(1, tilt);

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.85 - progress * 0.35})`;
    ctx.lineWidth = state.strokeWidth;
    ctx.stroke();

    const beadAngle = t * 1.5 + i * 0.8;
    const bx = Math.cos(beadAngle) * radius;
    const by = Math.sin(beadAngle) * radius;

    ctx.beginPath();
    ctx.arc(bx, by, width < 600 ? 2.5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }
}

// Mode 4: Spirograph (Harmonic Geometric Rosettes)
function drawSpirograph(cx, cy, maxRadius, currentTheme) {
  const count = state.ringCount;
  const t = state.time;
  const petals = 6;
  const baseR = maxRadius * 0.35;

  for (let i = 0; i < count; i++) {
    const p = i / count;
    const { r, g, b } = getColor(p, currentTheme);
    const scale = 0.3 + p * 0.85;
    const rot = t * 0.2 * (i % 2 === 0 ? 1 : -1) * state.speed + (i * Math.PI) / 8;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    ctx.beginPath();
    const steps = 120;
    for (let s = 0; s <= steps; s++) {
      const theta = (s / steps) * Math.PI * 2;
      const mod = 1 + 0.35 * Math.sin(theta * petals + t * state.speed);
      const rad = baseR * scale * mod;
      const x = Math.cos(theta) * rad;
      const y = Math.sin(theta) * rad;

      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.75 - p * 0.3})`;
    ctx.lineWidth = state.strokeWidth * 0.9;
    ctx.stroke();

    ctx.restore();
  }
}

// Central Glowing Core (Scales adaptively on mobile)
function drawCore(cx, cy, currentTheme) {
  const t = state.time;
  const pulse = 1 + Math.sin(t * 3) * 0.15;
  const c1 = currentTheme.c1;
  const minDim = Math.min(width, height);
  const coreRadius = Math.max(9, Math.min(14, minDim * 0.025)) * pulse;

  const gradient = ctx.createRadialGradient(cx, cy, 1, cx, cy, coreRadius);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.35, `rgb(${c1[0]}, ${c1[1]}, ${c1[2]})`);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, width < 600 ? 2 : 2.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

// ============================================================================
// Main Animation Loop
// ============================================================================
function render() {
  if (!state.isPaused) {
    state.time += 0.016;

    // Smooth cursor / touch tracking with lerp
    state.mouseX += (state.targetMouseX - state.mouseX) * 0.06;
    state.mouseY += (state.targetMouseY - state.mouseY) * 0.06;
  }

  const currentTheme = THEMES[state.theme] || THEMES.neon;

  // Clear canvas with crisp dark background
  ctx.fillStyle = currentTheme.bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle clean cosmic vignette
  const maxDim = Math.max(width, height);
  const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, maxDim * 0.7);
  bgGrad.addColorStop(0, 'rgba(15, 25, 45, 0.25)');
  bgGrad.addColorStop(0.6, 'rgba(5, 8, 16, 0.6)');
  bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Responsive center calculation
  const cx = width / 2 + (state.mouseX - width / 2) * 0.12;
  const cy = height / 2 + (state.mouseY - height / 2) * 0.12;
  const maxRadius = Math.sqrt(width * width + height * height) * 0.55;

  // Draw Selected Mode
  switch (state.mode) {
    case 'harmonic':
      drawHarmonicPulse(cx, cy, maxRadius, currentTheme);
      break;
    case 'cymatics':
      drawCymatics(cx, cy, maxRadius, currentTheme);
      break;
    case 'orbit':
      drawOrbitalGyro(cx, cy, maxRadius, currentTheme);
      break;
    case 'spirograph':
      drawSpirograph(cx, cy, maxRadius, currentTheme);
      break;
  }

  // Draw Central Core
  drawCore(cx, cy, currentTheme);

  // Draw Click Shockwaves
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    if (!state.isPaused) {
      sw.radius += sw.speed;
      sw.alpha *= 0.96;
    }

    if (sw.alpha <= 0.01 || sw.radius >= sw.maxRadius) {
      shockwaves.splice(i, 1);
      continue;
    }

    const { r, g, b } = getColor(sw.radius / sw.maxRadius, currentTheme);

    ctx.save();
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${sw.alpha.toFixed(3)})`;
    ctx.lineWidth = state.strokeWidth * 1.5;
    ctx.stroke();
    ctx.restore();
  }

  requestAnimationFrame(render);
}

// ============================================================================
// Event Listeners, Touch Support & HUD Controls
// ============================================================================
function setupControls() {
  const hudPanel = document.getElementById('hud-panel');
  const hudToggleBtn = document.getElementById('hud-toggle-btn');
  const btnCloseHud = document.getElementById('btn-close-hud');
  const hudBackdrop = document.getElementById('hud-backdrop');
  const btnPause = document.getElementById('btn-pause');
  const btnAudio = document.getElementById('btn-audio');

  const sliderRings = document.getElementById('slider-rings');
  const valRings = document.getElementById('val-rings');
  const sliderSpeed = document.getElementById('slider-speed');
  const valSpeed = document.getElementById('val-speed');
  const sliderStroke = document.getElementById('slider-stroke');
  const valStroke = document.getElementById('val-stroke');

  // Initialize initial visibility
  if (!state.hudVisible) {
    hudPanel.classList.add('hidden');
    hudToggleBtn.classList.remove('hidden');
    if (hudBackdrop) hudBackdrop.classList.remove('active');
  } else {
    hudPanel.classList.remove('hidden');
    hudToggleBtn.classList.add('hidden');
  }

  // Desktop Mouse Movement
  window.addEventListener('mousemove', (e) => {
    state.targetMouseX = e.clientX;
    state.targetMouseY = e.clientY;
  });

  // Touch Movement (Mobile & Tablet)
  window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      state.targetMouseX = e.touches[0].clientX;
      state.targetMouseY = e.touches[0].clientY;
    }
  }, { passive: true });

  // Canvas Tap / Click Shockwaves
  canvas.addEventListener('pointerdown', (e) => {
    initAudio();
    addShockwave(e.clientX, e.clientY);
  });

  // Sliders
  sliderRings.addEventListener('input', (e) => {
    state.ringCount = parseInt(e.target.value, 10);
    valRings.textContent = state.ringCount;
  });

  sliderSpeed.addEventListener('input', (e) => {
    state.speed = parseFloat(e.target.value);
    valSpeed.textContent = `${state.speed.toFixed(1)}x`;
  });

  sliderStroke.addEventListener('input', (e) => {
    state.strokeWidth = parseFloat(e.target.value);
    valStroke.textContent = `${state.strokeWidth.toFixed(1)}px`;
  });

  // Mode buttons
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.mode = btn.dataset.mode;
    });
  });

  // Theme buttons
  document.querySelectorAll('[data-theme]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-theme]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.theme = btn.dataset.theme;
      const theme = THEMES[state.theme];
      if (theme) {
        document.documentElement.style.setProperty('--accent-color', `rgb(${theme.c1.join(',')})`);
      }
    });
  });

  // Play / Pause
  function togglePause() {
    state.isPaused = !state.isPaused;
    btnPause.innerHTML = state.isPaused
      ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Resume`
      : `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> Pause`;
  }
  btnPause.addEventListener('click', togglePause);

  // Audio Toggle
  btnAudio.addEventListener('click', () => {
    initAudio();
    state.soundEnabled = !state.soundEnabled;
    btnAudio.classList.toggle('active', state.soundEnabled);
    btnAudio.innerHTML = state.soundEnabled
      ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg> Audio On`
      : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg> Audio Off`;
    if (state.soundEnabled) playChime(523.25);
  });

  // HUD Open / Close / Toggle Functions
  function openHUD() {
    state.hudVisible = true;
    hudPanel.classList.remove('hidden');
    hudToggleBtn.classList.add('hidden');
    if (hudBackdrop && window.innerWidth <= 640) {
      hudBackdrop.classList.add('active');
    }
  }

  function closeHUD() {
    state.hudVisible = false;
    hudPanel.classList.add('hidden');
    hudToggleBtn.classList.remove('hidden');
    if (hudBackdrop) {
      hudBackdrop.classList.remove('active');
    }
  }

  function toggleHUD() {
    if (state.hudVisible) {
      closeHUD();
    } else {
      openHUD();
    }
  }

  btnCloseHud.addEventListener('click', closeHUD);
  hudToggleBtn.addEventListener('click', toggleHUD);
  if (hudBackdrop) {
    hudBackdrop.addEventListener('click', closeHUD);
  }

  // Keyboard Shortcuts (Desktop)
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      togglePause();
    } else if (e.code === 'KeyH') {
      toggleHUD();
    } else if (e.code === 'KeyF') {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  });
}

// Start visualizer
setupControls();
render();
