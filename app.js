const $ = (id) => document.getElementById(id);

const state = {
  speaker: 'not tested',
  mic: 'not tested',
  webcam: 'not tested',
  battery: 'not tested',
  screen: 'not tested',
  touchpad: { left: false, right: false, scroll: 0, x: 0, y: 0 },
  keyboard: new Set(),
  failedKeys: new Set(),
  system: {},
  streams: { mic: null, webcam: null },
};

// System & Browser Info is informational only and does not count toward pass/fail totals.
const statusIds = ['webcamStatus', 'keyboardStatus', 'micStatus', 'speakerStatus', 'touchpadStatus', 'screenStatus', 'batteryStatus'];

function setStatus(id, text, kind = 'neutral') {
  const el = $(id);
  el.textContent = text;
  el.className = `status ${kind}`;
  updateScore();
}

function updateScore() {
  let pass = 0;
  let fail = 0;
  statusIds.forEach(id => {
    const el = $(id);
    if (!el) return;
    if (el.classList.contains('pass')) pass += 1;
    if (el.classList.contains('fail')) fail += 1;
  });
  if ($('passCount')) $('passCount').textContent = pass;
  if ($('failCount')) $('failCount').textContent = fail;
}


const screenColors = [
  { name: 'White', value: '#ffffff' },
  { name: 'Black', value: '#000000' },
  { name: 'Red', value: '#ff0000' },
  { name: 'Green', value: '#00ff00' },
  { name: 'Blue', value: '#0000ff' },
  { name: 'Gray', value: '#808080' },
];
let screenColorIndex = 0;

function renderScreenOverlay() {
  const color = screenColors[screenColorIndex];
  $('screenOverlay').style.background = color.value;
  $('screenOverlayLabel').textContent = `${color.name} (${screenColorIndex + 1}/${screenColors.length}) · Click to advance · Esc to exit`;
}

function launchScreenTest() {
  screenColorIndex = 0;
  renderScreenOverlay();
  $('screenOverlay').classList.remove('hidden');
  state.screen = 'running';
  $('screenDetails').textContent = 'Screen test running. Click to advance colors, Esc or Exit to finish.';
  setStatus('screenStatus', 'Running', 'neutral');
  if ($('screenOverlay').requestFullscreen) {
    $('screenOverlay').requestFullscreen().catch(() => {});
  }
}

function nextScreenColor() {
  screenColorIndex = (screenColorIndex + 1) % screenColors.length;
  renderScreenOverlay();
}

function exitScreenTest() {
  $('screenOverlay').classList.add('hidden');
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
  state.screen = 'completed';
  $('screenDetails').textContent = 'Screen test completed by user.';
  setStatus('screenStatus', 'Passed', 'pass');
}


function setTouchpadStatusFromClicks() {
  const t = state.touchpad;
  if (t.left && t.right) {
    setStatus('touchpadStatus', 'Passed', 'pass');
  } else if (t.left || t.right || t.scroll > 0 || t.x || t.y) {
    setStatus('touchpadStatus', 'Running', 'neutral');
  }
}

function updateTouchpadBadges() {
  $('touchLeft').classList.toggle('on', state.touchpad.left);
  $('touchRight').classList.toggle('on', state.touchpad.right);
  $('touchScroll').classList.toggle('on', state.touchpad.scroll > 0);
  $('touchScroll').textContent = `Scroll ${state.touchpad.scroll}`;
  $('touchpadCoords').textContent = `X: ${state.touchpad.x} · Y: ${state.touchpad.y}`;
  $('touchpadCursor').style.left = `${state.touchpad.x}px`;
  $('touchpadCursor').style.top = `${state.touchpad.y}px`;
}

function addTouchpadTrailDot(x, y) {
  const area = $('touchpadArea');
  const dot = document.createElement('span');
  dot.className = 'trail-dot';
  dot.style.left = `${x}px`;
  dot.style.top = `${y}px`;
  dot.style.opacity = '0.8';
  area.appendChild(dot);
  const dots = area.querySelectorAll('.trail-dot');
  dots.forEach((d, i) => d.style.opacity = String(((i + 1) / dots.length) * 0.8));
  while (area.querySelectorAll('.trail-dot').length > 40) {
    area.querySelector('.trail-dot')?.remove();
  }
}

function handleTouchpadMove(e) {
  const area = $('touchpadArea');
  const rect = area.getBoundingClientRect();
  const x = Math.max(0, Math.min(Math.round(e.clientX - rect.left), Math.round(rect.width)));
  const y = Math.max(0, Math.min(Math.round(e.clientY - rect.top), Math.round(rect.height)));
  state.touchpad.x = x;
  state.touchpad.y = y;
  addTouchpadTrailDot(x, y);
  updateTouchpadBadges();
  if (!$('touchpadStatus').classList.contains('pass')) setTouchpadStatusFromClicks();
}

function markTouchpad(partial) {
  state.touchpad = { ...state.touchpad, ...partial };
  updateTouchpadBadges();
  setTouchpadStatusFromClicks();
}

function resetTouchpad() {
  state.touchpad = { left: false, right: false, scroll: 0, x: 0, y: 0 };
  document.querySelectorAll('#touchpadArea .trail-dot').forEach(d => d.remove());
  updateTouchpadBadges();
  setStatus('touchpadStatus', 'Not tested', 'neutral');
}

function labelFromKey(key) {
  const labels = {
    chromeOSOrBrowserVersion: 'ChromeOS or Browser Version',
    keyboardLanguage: 'Keyboard Language',
    cpuLogicalCores: 'CPU Logical Cores',
    browserFullVersion: 'Browser Full Version',
    memoryInfo: 'Memory Info',
    storageCapacity: 'Local Storage Capacity',
    storageRemaining: 'Local Storage Remaining',
    networkStatus: 'Network Status',
    screen: 'Screen'
  };
  if (labels[key]) return labels[key];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .replace('Cpu', 'CPU')
    .replace('Os', 'OS')
    .replace('Ua', 'UA');
}

function addInfo(label, value) {
  const item = document.createElement('div');
  item.className = 'info-item';
  item.innerHTML = `<div class="info-label">${label}</div><div class="info-value">${value ?? 'Unavailable'}</div>`;
  $('systemInfo').appendChild(item);
}

function parseChromeOSVersion() {
  const match = navigator.userAgent.match(/CrOS\s+[^\s]+\s+([\d._-]+)/i);
  return match ? match[1].replace(/_/g, '.') : '';
}

async function getHighEntropy() {
  if (!navigator.userAgentData?.getHighEntropyValues) return {};
  try {
    return await navigator.userAgentData.getHighEntropyValues([
      'architecture', 'bitness', 'model', 'platformVersion', 'uaFullVersion', 'fullVersionList'
    ]);
  } catch {
    return {};
  }
}

function getBrowserFullVersion(highEntropy) {
  if (highEntropy.uaFullVersion) return highEntropy.uaFullVersion;
  const chromeMatch = navigator.userAgent.match(/Chrome\/([\d.]+)/i);
  if (chromeMatch) return chromeMatch[1];
  return navigator.userAgentData?.brands?.map(b => `${b.brand} ${b.version}`).join(', ') || 'Unavailable';
}

async function getKeyboardLanguageHint() {
  const browserLanguage = navigator.language || 'Unavailable';
  const languages = navigator.languages?.length ? navigator.languages.join(', ') : browserLanguage;
  return `${browserLanguage}${languages && languages !== browserLanguage ? ` (${languages})` : ''}`;
}

function formatBytes(bytes) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return 'Unavailable';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const decimals = value >= 10 || unit === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unit]}`;
}

async function getStorageEstimate() {
  if (!navigator.storage?.estimate) {
    return { capacity: 'Unavailable', remaining: 'Unavailable' };
  }
  try {
    const estimate = await navigator.storage.estimate();
    const quota = typeof estimate.quota === 'number' ? estimate.quota : null;
    const usage = typeof estimate.usage === 'number' ? estimate.usage : 0;
    return {
      capacity: quota == null ? 'Unavailable' : `${formatBytes(quota)} browser quota`,
      remaining: quota == null ? 'Unavailable' : `${formatBytes(Math.max(0, quota - usage))} available`,
    };
  } catch {
    return { capacity: 'Unavailable', remaining: 'Unavailable' };
  }
}

function getMemoryInfo() {
  if (typeof navigator.deviceMemory === 'number') {
    return `${navigator.deviceMemory} GB browser-reported bucket`;
  }
  return 'Unavailable - not exposed by this browser';
}

function getScreenInfo() {
  return `${screen.width} x ${screen.height} @ ${window.devicePixelRatio}x`;
}

function getNetworkStatusText() {
  return navigator.onLine ? '<span class="network-pill online"><span></span>Online</span>' : '<span class="network-pill offline"><span></span>Offline</span>';
}

async function loadSystemInfo() {
  setStatus('systemStatus', 'Checking', 'neutral');
  const highEntropy = await getHighEntropy();
  const chromeOSFromUA = parseChromeOSVersion();
  const browserFullVersion = getBrowserFullVersion(highEntropy);
  const chromeOSVersion = chromeOSFromUA || highEntropy.platformVersion || '';
  const versionDisplay = chromeOSVersion
    ? `ChromeOS ${chromeOSVersion}`
    : `ChromeOS version not exposed; Browser ${browserFullVersion}`;
  const keyboardLanguage = await getKeyboardLanguageHint();
  const networkStatus = getNetworkStatusText();
  const storageEstimate = await getStorageEstimate();

  state.system = {
    chromeOSOrBrowserVersion: versionDisplay,
    keyboardLanguage,
    cpuLogicalCores: navigator.hardwareConcurrency ? String(navigator.hardwareConcurrency) : 'Unavailable',
    browserFullVersion,
    memoryInfo: getMemoryInfo(),
    storageCapacity: storageEstimate.capacity,
    storageRemaining: storageEstimate.remaining,
    screen: getScreenInfo(),
    networkStatus,
  };

  $('systemInfo').innerHTML = '';
  Object.entries(state.system).forEach(([key, value]) => addInfo(labelFromKey(key), value));
  setStatus('systemStatus', 'Detected', 'pass');
}

async function checkBattery() {
  setStatus('batteryStatus', 'Checking', 'neutral');
  if (!navigator.getBattery) {
    $('batteryDetails').textContent = 'Battery API is not available or is blocked by browser/policy.';
    $('batteryPct').textContent = '--';
    $('batteryLevel').style.width = '0%';
    state.battery = 'unavailable';
    setStatus('batteryStatus', 'Unavailable', 'warn');
    return;
  }
  try {
    const battery = await navigator.getBattery();
    function render() {
      const pct = Math.round(battery.level * 100);
      $('batteryLevel').style.width = `${pct}%`;
      $('batteryPct').textContent = `${pct}%`;
      $('batteryDetails').innerHTML = `${battery.charging ? 'Charging' : 'Discharging'}<br>full in ${battery.chargingTime === Infinity ? '--' : Math.round(battery.chargingTime / 60) + ' min'}<br>remaining ${battery.dischargingTime === Infinity ? '--' : Math.round(battery.dischargingTime / 60) + ' min'}`;
      state.battery = `${pct}% | charging: ${battery.charging}`;
      setStatus('batteryStatus', pct > 20 ? 'Working' : 'Low', pct > 20 ? 'pass' : 'warn');
    }
    ['chargingchange', 'levelchange', 'chargingtimechange', 'dischargingtimechange'].forEach(evt => battery.addEventListener(evt, render));
    render();
  } catch (err) {
    $('batteryDetails').textContent = `Battery check failed: ${err.message}`;
    state.battery = `failed: ${err.message}`;
    setStatus('batteryStatus', 'Failed', 'fail');
  }
}

function playTone(freq = 440, duration = 1600, pan = 0) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) throw new Error('Web Audio API is not available.');
  const ctx = new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.24, ctx.currentTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration / 1000);
  if (panner) {
    panner.pan.value = pan;
    osc.connect(gain).connect(panner).connect(ctx.destination);
  } else {
    osc.connect(gain).connect(ctx.destination);
  }
  osc.start();
  osc.stop(ctx.currentTime + duration / 1000 + 0.05);
}

function speakerTest(pan = 0, label = 'both') {
  try {
    setStatus('speakerStatus', `Playing ${label}`, 'neutral');
    playTone(pan === -1 ? 440 : pan === 1 ? 660 : 523.25, 1600, pan);
    $('speakerResult').textContent = `Tone played through ${label}. Choose whether you heard it.`;
    setTimeout(() => setStatus('speakerStatus', 'Confirm', 'warn'), 1650);
  } catch (err) {
    $('speakerResult').textContent = err.message;
    state.speaker = `failed: ${err.message}`;
    setStatus('speakerStatus', 'Failed', 'fail');
  }
}

async function startMicTest() {
  try {
    setStatus('micStatus', 'Requesting', 'neutral');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.streams.mic = stream;
    state.mic = 'access granted';
    setStatus('micStatus', 'Listening', 'pass');

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const canvas = $('micCanvas');
    const c = canvas.getContext('2d');

    function draw() {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) {
        const centered = v - 128;
        sum += centered * centered;
      }
      const rms = Math.sqrt(sum / data.length);
      const level = Math.min(100, Math.round(rms * 5));
      $('micMeter').style.width = `${level}%`;
      $('micPercent').textContent = `${level}%`;
      $('micDetails').textContent = `Input level ${level}%`;
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = 74 * devicePixelRatio;
      c.clearRect(0, 0, canvas.width, canvas.height);
      c.strokeStyle = '#20d3ee';
      c.lineWidth = 2 * devicePixelRatio;
      c.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = (i / data.length) * canvas.width;
        const y = (data[i] / 255) * canvas.height;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
      requestAnimationFrame(draw);
    }
    draw();
  } catch (err) {
    state.mic = `failed: ${err.message}`;
    $('micDetails').textContent = `Microphone test failed: ${err.message}`;
    setStatus('micStatus', 'Failed', 'fail');
  }
}

function stopWebcamFpsCounter() {
  if (state.webcamFpsLoop) cancelAnimationFrame(state.webcamFpsLoop);
  state.webcamFpsLoop = null;
  state.webcamFps = null;
  const badge = $('webcamFps');
  if (badge) badge.textContent = 'FPS: --';
}

function startWebcamFpsCounter() {
  stopWebcamFpsCounter();
  const video = $('webcamVideo');
  const badge = $('webcamFps');
  let lastSecond = performance.now();
  let frames = 0;
  let lastPaint = performance.now();

  if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
    const onFrame = () => {
      frames += 1;
      const now = performance.now();
      if (now - lastSecond >= 1000) {
        state.webcamFps = Math.round((frames * 1000) / (now - lastSecond));
        badge.textContent = `FPS: ${state.webcamFps}`;
        frames = 0;
        lastSecond = now;
      }
      if (state.streams.webcam) video.requestVideoFrameCallback(onFrame);
    };
    video.requestVideoFrameCallback(onFrame);
    return;
  }

  const tick = () => {
    const now = performance.now();
    if (video.readyState >= 2) frames += 1;
    if (now - lastSecond >= 1000) {
      state.webcamFps = Math.round((frames * 1000) / (now - lastSecond));
      badge.textContent = `FPS: ${state.webcamFps}`;
      frames = 0;
      lastSecond = now;
    }
    lastPaint = now;
    if (state.streams.webcam) state.webcamFpsLoop = requestAnimationFrame(tick);
  };
  state.webcamFpsLoop = requestAnimationFrame(tick);
}

async function startWebcamTest() {
  try {
    setStatus('webcamStatus', 'Requesting', 'neutral');
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
    state.streams.webcam = stream;
    $('webcamVideo').srcObject = stream;
    $('cameraPlaceholder').classList.add('hidden');
    $('snapshotBtn').disabled = false;
    $('stopWebcamBtn').disabled = false;
    const track = stream.getVideoTracks()[0];
    const settings = track.getSettings();
    $('webcamDetails').textContent = `Camera active: ${track.label || 'camera'} | ${settings.width || '?'} x ${settings.height || '?'} @ requested ${settings.frameRate || '?'} fps`;
    startWebcamFpsCounter();
    state.webcam = 'access granted';
    setStatus('webcamStatus', 'Live', 'pass');
  } catch (err) {
    $('webcamDetails').textContent = `Webcam test failed: ${err.message}`;
    state.webcam = `failed: ${err.message}`;
    setStatus('webcamStatus', 'Failed', 'fail');
  }
}

function stopWebcam() {
  stopWebcamFpsCounter();
  if (state.streams.webcam) {
    state.streams.webcam.getTracks().forEach(t => t.stop());
    state.streams.webcam = null;
  }
  $('webcamVideo').srcObject = null;
  $('cameraPlaceholder').classList.remove('hidden');
  $('snapshotBtn').disabled = true;
  $('stopWebcamBtn').disabled = true;
  setStatus('webcamStatus', 'Stopped', 'neutral');
}

function takeSnapshot() {
  const video = $('webcamVideo');
  const canvas = $('snapshotCanvas');
  canvas.classList.remove('hidden');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  $('webcamDetails').textContent = `Snapshot captured at ${canvas.width} x ${canvas.height}.`;
}

const keyboardRows = [
  [
    ['Esc','esc',1.1,'Esc'], ['BrowserBack','←',1.15,'Back'], ['BrowserForward','→',1.15,'Forward'], ['BrowserRefresh','⟳',1.15,'Reload'],
    ['F4','▣',1.15,'Full screen'], ['F5','▤',1.15,'Overview'], ['BrightnessDown','☼-',1.15,'Brightness down'], ['BrightnessUp','☼+',1.15,'Brightness up'],
    ['AudioVolumeMute','🔇',1.15,'Mute'], ['AudioVolumeDown','🔉',1.15,'Volume down'], ['AudioVolumeUp','🔊',1.15,'Volume up'], ['Power','⏻',1.15,'Power']
  ],
  [
    ['Backquote','~\n`',0.8], ['Digit1','!\n1',0.95], ['Digit2','@\n2',0.95], ['Digit3','#\n3',0.95], ['Digit4','$\n4',0.95], ['Digit5','%\n5',0.95], ['Digit6','^\n6',0.95],
    ['Digit7','&\n7',0.95], ['Digit8','*\n8',0.95], ['Digit9','(\n9',0.95], ['Digit0',')\n0',0.95], ['Minus','_\n-',0.95], ['Equal','+\n=',0.95], ['Backspace','backspace',1.45]
  ],
  [
    ['Tab','tab',1.35], ['KeyQ','q',0.95], ['KeyW','w',0.95], ['KeyE','e',0.95], ['KeyR','r',0.95], ['KeyT','t',0.95], ['KeyY','y',0.95], ['KeyU','u',0.95],
    ['KeyI','i',0.95], ['KeyO','o',0.95], ['KeyP','p',0.95], ['BracketLeft','{\n[',0.95], ['BracketRight','}\n]',0.95], ['Backslash','|\n\\',0.95]
  ],
  [
    ['Search','⌕',1.6,'Launcher/Search'], ['KeyA','a',0.95], ['KeyS','s',0.95], ['KeyD','d',0.95], ['KeyF','f',0.95], ['KeyG','g',0.95], ['KeyH','h',0.95], ['KeyJ','j',0.95],
    ['KeyK','k',0.95], ['KeyL','l',0.95], ['Semicolon',':\n;',0.95], ['Quote','”\n\'',0.95], ['Enter','enter',1.65]
  ],
  [
    ['ShiftLeft','shift',2.15], ['KeyZ','z',0.95], ['KeyX','x',0.95], ['KeyC','c',0.95], ['KeyV','v',0.95], ['KeyB','b',0.95], ['KeyN','n',0.95], ['KeyM','m',0.95],
    ['Comma','<\n,',0.95], ['Period','>\n.',0.95], ['Slash','?\n/',0.95], ['ShiftRight','shift',2.15]
  ],
  [
    ['ControlLeft','ctrl',2.15], ['AltLeft','alt',2.0], ['Space','',5.25,'Space'], ['AltRight','alt',0.95], ['ControlRight','ctrl',0.95], ['ArrowLeft','‹',0.95], ['ArrowStack','',0.95,'Arrow up/down'], ['ArrowRight','›',0.95]
  ]
];

const aliasCodes = {
  Search: ['Search', 'MetaLeft', 'OSLeft', 'SuperLeft'],
  Power: ['Power', 'Sleep', 'WakeUp'],
  BrowserRefresh: ['BrowserRefresh', 'F3'],
  BrowserBack: ['BrowserBack', 'F1'],
  BrowserForward: ['BrowserForward', 'F2'],
  BrightnessDown: ['BrightnessDown', 'F6'],
  BrightnessUp: ['BrightnessUp', 'F7'],
  AudioVolumeMute: ['AudioVolumeMute', 'F8'],
  AudioVolumeDown: ['AudioVolumeDown', 'F9'],
  AudioVolumeUp: ['AudioVolumeUp', 'F10'],
};

function keyElementIdsForCode(code) {
  const matches = [code];
  Object.entries(aliasCodes).forEach(([display, aliases]) => {
    if (display === code || aliases.includes(code)) matches.push(display, ...aliases);
  });
  return [...new Set(matches)].map(c => `key-${CSS.escape(c)}`);
}

function buildKeyboard() {
  const root = $('keyboardLayout');
  root.innerHTML = '';
  keyboardRows.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'k-row';
    row.forEach(([code, label, units, title]) => {
      if (code === 'ArrowStack') {
        const stack = document.createElement('div');
        stack.className = 'key arrow-stack';
        stack.style.setProperty('--u', units);
        [['ArrowUp', '⌃'], ['ArrowDown', '⌄']].forEach(([arrowCode, arrowLabel]) => {
          const arrow = document.createElement('div');
          arrow.className = 'key tall';
          arrow.id = `key-${arrowCode}`;
          arrow.dataset.code = arrowCode;
          arrow.textContent = arrowLabel;
          arrow.title = arrowCode;
          stack.appendChild(arrow);
        });
        rowEl.appendChild(stack);
        return;
      }
      const key = document.createElement('div');
      key.className = 'key';
      key.id = `key-${code}`;
      key.dataset.code = code;
      key.style.setProperty('--u', units);
      key.innerHTML = String(label).split('\n').map(part => `<span>${part}</span>`).join('');
      key.title = title || code;
      rowEl.appendChild(key);
    });
    root.appendChild(rowEl);
  });
}

function markKey(code, className, on = true) {
  keyElementIdsForCode(code).forEach(id => {
    const el = document.getElementById(id.replace(/\\/g, '')) || document.querySelector(`#${id}`);
    if (el) el.classList.toggle(className, on);
  });
}

function handleKeyDown(e) {
  if (!$('captureTyping').checked) return;
  e.preventDefault();
  const code = e.code || e.key;
  state.keyboard.add(code);
  markKey(code, 'hit', true);
  markKey(code, 'active', true);
  $('testedKeyCount').textContent = state.keyboard.size;
  $('lastKey').textContent = `keydown · key: ${e.key} · code: ${code}`;
  setStatus('keyboardStatus', `${state.keyboard.size} keys`, state.keyboard.size >= 20 ? 'pass' : 'neutral');
}

function handleKeyUp(e) {
  const code = e.code || e.key;
  markKey(code, 'active', false);
}

function clearKeys() {
  state.keyboard.clear();
  state.failedKeys.clear();
  document.querySelectorAll('.key').forEach(k => k.classList.remove('hit', 'active', 'missing'));
  $('testedKeyCount').textContent = '0';
  $('lastKey').textContent = 'Waiting for input…';
  setStatus('keyboardStatus', 'Not tested', 'neutral');
}

function resetAll() {
  clearKeys();
  stopWebcam();
  state.speaker = 'not tested';
  state.mic = 'not tested';
  state.webcam = 'not tested';
  state.battery = 'not tested';
  state.screen = 'not tested';
  resetTouchpad();
  $('speakerResult').textContent = '';
  $('micDetails').textContent = '';
  $('micMeter').style.width = '0%';
  $('micPercent').textContent = '0%';
  $('batteryDetails').textContent = 'Waiting for battery check…';
  $('batteryLevel').style.width = '0%';
  $('batteryPct').textContent = '--';
  if ($('reportOutput')) $('reportOutput').value = '';
  if ($('screenDetails')) $('screenDetails').textContent = 'Click launch to begin.';
  if ($('screenOverlay')) $('screenOverlay').classList.add('hidden');
  const fpsBadge = $('webcamFps');
  if (fpsBadge) fpsBadge.textContent = 'FPS: --';
  setStatus('speakerStatus', 'Not tested', 'neutral');
  setStatus('micStatus', 'Not tested', 'neutral');
  setStatus('batteryStatus', 'Not tested', 'neutral');
  setStatus('screenStatus', 'Not tested', 'neutral');
  if ($('reportStatus')) setStatus('reportStatus', 'Not generated', 'neutral');
}

function generateReport() {
  const report = {
    generatedAt: new Date().toISOString(),
    system: state.system,
    tests: {
      battery: state.battery,
      speaker: state.speaker,
      microphone: state.mic,
      webcam: state.webcam,
      webcamMeasuredFps: state.webcamFps,
      touchpad: state.touchpad,
      screen: state.screen,
      keyboardKeysDetected: Array.from(state.keyboard).sort(),
    }
  };
  $('reportOutput').value = JSON.stringify(report, null, 2);
  setStatus('reportStatus', 'Generated', 'pass');
}

async function copyReport() {
  if (!$('reportOutput').value) generateReport();
  try {
    await navigator.clipboard.writeText($('reportOutput').value);
    setStatus('reportStatus', 'Copied', 'pass');
  } catch (err) {
    setStatus('reportStatus', 'Copy failed', 'fail');
  }
}

function downloadReport() {
  if (!$('reportOutput').value) generateReport();
  const blob = new Blob([$('reportOutput').value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chromebook-diagnostic-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function runAll() {
  await loadSystemInfo();
  await checkBattery();
  speakerTest(0, 'both');
  await startMicTest();
  await startWebcamTest();
}

$('batteryBtn').addEventListener('click', checkBattery);
$('speakerBtn').addEventListener('click', () => speakerTest(0, 'both'));
$('speakerLeftBtn').addEventListener('click', () => speakerTest(-1, 'left'));
$('speakerRightBtn').addEventListener('click', () => speakerTest(1, 'right'));
$('micBtn').addEventListener('click', startMicTest);
$('webcamBtn').addEventListener('click', startWebcamTest);
$('stopWebcamBtn').addEventListener('click', stopWebcam);
$('snapshotBtn').addEventListener('click', takeSnapshot);
$('clearKeysBtn').addEventListener('click', clearKeys);
if ($('reportBtn')) $('reportBtn').addEventListener('click', generateReport);
if ($('copyReportBtn')) $('copyReportBtn').addEventListener('click', copyReport);
if ($('downloadReportBtn')) $('downloadReportBtn').addEventListener('click', downloadReport);
if ($('runAllBtn')) $('runAllBtn').addEventListener('click', runAll);
$('resetAllBtn').addEventListener('click', resetAll);
$('screenLaunchBtn').addEventListener('click', launchScreenTest);
$('screenExitBtn').addEventListener('click', (e) => { e.stopPropagation(); exitScreenTest(); });
$('screenOverlay').addEventListener('click', nextScreenColor);
window.addEventListener('keydown', (e) => {
  if (!$('screenOverlay').classList.contains('hidden') && e.key === 'Escape') {
    e.preventDefault();
    exitScreenTest();
  }
}, { passive: false });

$('touchpadArea').addEventListener('pointermove', handleTouchpadMove);
$('touchpadArea').addEventListener('click', () => markTouchpad({ left: true }));
$('touchpadArea').addEventListener('contextmenu', (e) => { e.preventDefault(); markTouchpad({ right: true }); });
$('touchpadArea').addEventListener('wheel', (e) => { e.preventDefault(); markTouchpad({ scroll: state.touchpad.scroll + 1 }); }, { passive: false });
$('resetTouchpadBtn').addEventListener('click', resetTouchpad);


document.querySelectorAll('[data-result="speaker"]').forEach(btn => {
  btn.addEventListener('click', () => {
    state.speaker = btn.dataset.value === 'pass' ? 'heard tone' : 'no sound reported';
    setStatus('speakerStatus', btn.dataset.value === 'pass' ? 'Passed' : 'Failed', btn.dataset.value);
    $('speakerResult').textContent = `Speaker result: ${state.speaker}`;
  });
});

window.addEventListener('keydown', handleKeyDown, { passive: false });
window.addEventListener('keyup', handleKeyUp, { passive: true });
function initDiagnostics() {
  buildKeyboard();
  resetTouchpad();
  loadSystemInfo();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initDiagnostics);
} else {
  initDiagnostics();
}
