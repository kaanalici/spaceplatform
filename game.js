/* =========================================================
   WHIRLYBIRD — gökyüzüne tırman
   Tek dosya, sıfır bağımlılık. Canvas 420x720 dünyası.
   ========================================================= */

(function () {
  'use strict';

  /* ---------------- sabitler ---------------- */

  var W = 420, H = 720;
  var GRAV = 2380;
  var JUMP = 1090;
  var SPRING_MULT = 1.62;
  var MOVE_ACC = 2700;
  var MAX_VX = 440;
  var START_CAM = -H * 0.55;
  var APEX = (JUMP * JUMP) / (2 * GRAV);

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d', { alpha: false });

  var UA = navigator.userAgent || '';
  var isMobile = /Android|iPhone|iPad|iPod|Mobile|Windows Phone|IEMobile/i.test(UA) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(UA));
  var isTouch = isMobile ||
    !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

  /* ---------------- kalite / çözünürlük ----------------
     Telefon GPU'larında shadowBlur ve tam ekran karışım katmanları
     çok pahalıdır. Kare hızına göre üç kademe arasında geçilir. */

  var QUALITY_LEVELS = [
    { dpr: 2.00, glow: 1, parts: 1.00, stars: 1.00, clouds: 1.00, grid: 1.00 }, /* masaüstü */
    { dpr: 1.50, glow: 0, parts: 0.60, stars: 0.55, clouds: 0.65, grid: 0.80 }, /* telefon */
    { dpr: 1.15, glow: 0, parts: 0.35, stars: 0.30, clouds: 0.40, grid: 0.55 }  /* zayıf telefon */
  ];

  var BASE_DPR = window.devicePixelRatio || 1;
  var qLevel = isTouch ? 1 : 0;
  var Q = QUALITY_LEVELS[qLevel];
  var GLOW = Q.glow;
  var DPR = 1;

  function applyCanvasSize() {
    var dpr = Math.min(BASE_DPR, Q.dpr);
    /* piksel bütçesi: dolgu (fill-rate) maliyetini sınırlar */
    var budget = isTouch ? 620000 : 1500000;
    dpr = Math.min(dpr, Math.sqrt(budget / (W * H)));
    DPR = Math.max(1, Math.round(dpr * 20) / 20);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }
  applyCanvasSize();

  function setQuality(level) {
    qLevel = Math.max(0, Math.min(QUALITY_LEVELS.length - 1, level));
    Q = QUALITY_LEVELS[qLevel];
    GLOW = Q.glow;
    applyCanvasSize();
    bgKey = '';
    makeClouds();
  }

  /* shadowBlur tabanlı parlama — mobilde tamamen kapatılır */
  function glowOn(color, blur) {
    if (GLOW > 0) {
      ctx.shadowColor = color;
      ctx.shadowBlur = blur * GLOW;
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0)';
      ctx.shadowBlur = 0;
    }
  }
  function glowOff() {
    ctx.shadowColor = 'rgba(0,0,0,0)';
    ctx.shadowBlur = 0;
  }

  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  function smoothstep(a, b, x) {
    var t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  /* 0 → 1 arası yumuşak zorluk eğrisi.
     Ani eşikler yerine asimptotik olarak yükselir: hiç "duvar" yok. */
  function difficulty() {
    return 1 - Math.exp(-Math.max(0, G.meters) / 2300);
  }

  /* ---------------- renk / tema ---------------- */

  function hexRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(c1, c2, t) {
    var a = hexRgb(c1), b = hexRgb(c2);
    return 'rgb(' + Math.round(lerp(a[0], b[0], t)) + ',' +
      Math.round(lerp(a[1], b[1], t)) + ',' +
      Math.round(lerp(a[2], b[2], t)) + ')';
  }
  function rgba(hex, a) {
    var c = hexRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  var THEMES = [
    {
      at: 0, name: 'NEON ŞAFAK',
      sky: ['#070418', '#2a0946'], plat: ['#00e5ff', '#0a5f74'], glow: '#00e5ff',
      star: 0.35, cloud: 0.6, grid: 1.0, aurora: '#00e5ff', nebula: '#a96bff',
      skyline: 0.55, orbStyle: 'ring', meteor: 0.2
    },
    {
      at: 700, name: 'PEMBE UFUK',
      sky: ['#160526', '#5c0a4e'], plat: ['#ff2d95', '#7a0a45'], glow: '#ff2d95',
      star: 0.55, cloud: 0.6, grid: 0.85, aurora: '#ff77bd', nebula: '#6b2bff',
      skyline: 0.7, orbStyle: 'ring', meteor: 0.35
    },
    {
      at: 1500, name: 'ZÜMRÜT HALKASI',
      sky: ['#04121d', '#053a45'], plat: ['#39ffcc', '#0a6a5c'], glow: '#39ffcc',
      star: 0.8, cloud: 0.45, grid: 0.55, aurora: '#39ff88', nebula: '#00e5ff',
      skyline: 0.3, orbStyle: 'planet', meteor: 0.5
    },
    {
      at: 2400, name: 'MOR NEBULA',
      sky: ['#04030f', '#170a30'], plat: ['#a96bff', '#45208a'], glow: '#a96bff',
      star: 1.0, cloud: 0.3, grid: 0.25, aurora: '#a96bff', nebula: '#ff2d95',
      skyline: 0.15, orbStyle: 'eclipse', meteor: 0.6
    },
    {
      at: 3300, name: 'KIZIL UYDU',
      sky: ['#110309', '#3a0a18'], plat: ['#ff3d6e', '#7a0a24'], glow: '#ff3d6e',
      star: 0.9, cloud: 0.2, grid: 0.2, aurora: '#ff3d6e', nebula: '#ffb020',
      skyline: 0.85, orbStyle: 'eclipse', meteor: 0.8
    },
    {
      at: 4300, name: 'ALTIN EKLİPS',
      sky: ['#0b0702', '#2e1b05'], plat: ['#ffd166', '#7a5a0a'], glow: '#ffd166',
      star: 0.7, cloud: 0.25, grid: 0.3, aurora: '#ffb020', nebula: '#ff5a1f',
      skyline: 0.35, orbStyle: 'planet', meteor: 0.7
    },
    {
      at: 5400, name: 'BUZUL GECESİ',
      sky: ['#02060f', '#0a2440'], plat: ['#9fe8ff', '#2a6a8a'], glow: '#9fe8ff',
      star: 1.0, cloud: 0.35, grid: 0.45, aurora: '#7fd4ff', nebula: '#00e5ff',
      skyline: 0.45, orbStyle: 'planet', meteor: 0.4
    },
    {
      at: 6800, name: 'SIFIR NOKTASI',
      sky: ['#000000', '#0b0010'], plat: ['#ffffff', '#555577'], glow: '#e8fbff',
      star: 1.0, cloud: 0.1, grid: 0.15, aurora: '#e8fbff', nebula: '#a96bff',
      skyline: 0.0, orbStyle: 'eye', meteor: 1.0
    }
  ];

  var themeCache = { m: -1, th: null };
  function themeFor(m) {
    if (themeCache.m === m) return themeCache.th;
    var i = 0;
    while (i < THEMES.length - 1 && m >= THEMES[i + 1].at) i++;
    var a = THEMES[i];
    var b = THEMES[Math.min(i + 1, THEMES.length - 1)];
    var span = b.at - a.at;
    var t = span > 0 ? clamp((m - a.at) / span, 0, 1) : 0;
    t = t * t * (3 - 2 * t);
    var th = {
      index: i,
      name: a.name,
      prog: Math.round(t * 16),
      skyTop: mix(a.sky[0], b.sky[0], t),
      skyBottom: mix(a.sky[1], b.sky[1], t),
      platTop: mix(a.plat[0], b.plat[0], t),
      platBot: mix(a.plat[1], b.plat[1], t),
      glow: mix(a.glow, b.glow, t),
      star: lerp(a.star, b.star, t),
      cloud: lerp(a.cloud, b.cloud, t),
      grid: lerp(a.grid, b.grid, t),
      aurora: mix(a.aurora, b.aurora, t),
      auroraA: lerp(0.55, 0.85, t),
      nebula: mix(a.nebula, b.nebula, t),
      skyline: lerp(a.skyline, b.skyline, t),
      meteor: lerp(a.meteor, b.meteor, t),
      orbStyle: t < 0.5 ? a.orbStyle : b.orbStyle
    };
    themeCache = { m: m, th: th };
    return th;
  }

  /* ---------------- ses ---------------- */

  /* dosyadan (file://) açıldığında localStorage hata verebilir */
  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
      return value;
    } catch (e) { return null; }
  }

  var actx = null;
  var soundOn = store('wb_sound') !== '0';

  function audio() {
    if (!soundOn) return null;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      return actx;
    } catch (e) { return null; }
  }

  function tone(freq, dur, type, vol, slideTo) {
    var ac = audio();
    if (!ac) return;
    var t0 = ac.currentTime;
    var o = ac.createOscillator();
    var g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.05, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ac.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  function sfx(kind) {
    if (!soundOn) return;
    if (kind === 'jump') { tone(420, 0.1, 'triangle', 0.045, 620); }
    else if (kind === 'spring') { tone(330, 0.22, 'sine', 0.06, 880); }
    else if (kind === 'star') { tone(880, 0.1, 'triangle', 0.05); tone(1320, 0.14, 'triangle', 0.04, 1760); }
    else if (kind === 'break') { tone(220, 0.16, 'sawtooth', 0.045, 90); }
    else if (kind === 'cloud') { tone(500, 0.12, 'sine', 0.03, 300); }
    else if (kind === 'die') { tone(300, 0.5, 'sawtooth', 0.06, 60); tone(140, 0.6, 'square', 0.035, 50); }
    else if (kind === 'start') { tone(520, 0.1, 'triangle', 0.05); tone(780, 0.16, 'triangle', 0.045, 900); }
    else if (kind === 'mile') { tone(660, 0.09, 'square', 0.03); tone(990, 0.12, 'square', 0.028, 1200); }
    else if (kind === 'shield') { tone(520, 0.12, 'triangle', 0.05); tone(780, 0.16, 'sine', 0.045, 1040); }
    else if (kind === 'magnet') { tone(300, 0.26, 'sine', 0.05, 620); tone(900, 0.2, 'triangle', 0.03, 500); }
    else if (kind === 'jet') { tone(180, 0.42, 'sawtooth', 0.06, 700); tone(520, 0.34, 'square', 0.03, 1100); }
    else if (kind === 'shieldBreak') { tone(900, 0.28, 'square', 0.05, 180); tone(420, 0.34, 'sawtooth', 0.045, 90); }
    else if (kind === 'crystal') { tone(1040, 0.1, 'triangle', 0.05); tone(1560, 0.18, 'sine', 0.04, 2080); tone(780, 0.22, 'triangle', 0.028, 1040); }
    else if (kind === 'double') { tone(620, 0.1, 'square', 0.04); tone(930, 0.1, 'square', 0.035, 1240); tone(1240, 0.2, 'triangle', 0.035, 1860); }
    else if (kind === 'freeze') { tone(1400, 0.26, 'sine', 0.045, 420); tone(900, 0.3, 'triangle', 0.03, 260); }
    else if (kind === 'feather') { tone(700, 0.12, 'sine', 0.045); tone(1050, 0.2, 'sine', 0.04, 1400); }
    else if (kind === 'revive') { tone(260, 0.18, 'sawtooth', 0.05, 520); tone(620, 0.16, 'triangle', 0.05); tone(1240, 0.3, 'sine', 0.045, 1560); }
    else if (kind === 'ui') { tone(720, 0.06, 'triangle', 0.03, 880); }
    else if (kind === 'crate') { tone(180, 0.12, 'square', 0.04, 260); tone(260, 0.12, 'square', 0.035, 200); }
    else if (kind === 'unlock') { tone(620, 0.12, 'triangle', 0.05); tone(930, 0.14, 'triangle', 0.045, 1200); tone(1480, 0.3, 'sine', 0.04, 1860); }
    else if (kind === 'equip') { tone(840, 0.09, 'sine', 0.04); tone(1260, 0.16, 'triangle', 0.04, 1500); }
    else if (kind === 'zone') { tone(520, 0.14, 'sine', 0.03); tone(780, 0.22, 'triangle', 0.028, 1040); }
    else if (kind === 'bossWarn') {
      tone(110, 0.55, 'sawtooth', 0.055, 78);
      tone(240, 0.5, 'square', 0.03, 96);
      tone(880, 0.16, 'sine', 0.03, 620);
      tone(660, 0.2, 'triangle', 0.028, 500);
    }
    else if (kind === 'bossShot') { tone(340, 0.2, 'sawtooth', 0.05, 120); tone(760, 0.1, 'square', 0.025, 420); }
    else if (kind === 'playerHit') {
      tone(240, 0.22, 'square', 0.06, 120);
      tone(560, 0.2, 'sawtooth', 0.045, 280);
      tone(140, 0.3, 'triangle', 0.05, 90);
    }
    else if (kind === 'bossHit') {
      tone(150, 0.18, 'square', 0.06, 80);
      tone(520, 0.22, 'triangle', 0.045, 240);
      tone(1040, 0.3, 'sine', 0.04, 1620);
    }
    else if (kind === 'core') { tone(880, 0.1, 'triangle', 0.045); tone(1320, 0.18, 'sine', 0.04, 1780); }
    else if (kind === 'bossDie') {
      tone(92, 0.95, 'sawtooth', 0.06, 38);
      tone(210, 0.75, 'square', 0.04, 55);
      tone(880, 0.5, 'triangle', 0.035, 220);
      tone(1560, 0.42, 'sine', 0.03, 2200);
    }
  }

  /* =========================================================
     KOZMETİK KATALOĞU / CÜZDAN / SANDIK
     ========================================================= */

  var CRATE_COST = 100;
  var START_COINS = 150;

  /* boss */
  var BOSS_AT = 1000;          /* bu metrede ilk boss gelir (koşu başına 1) */
  var BOSS_HP = 6;             /* 6 boss çekirdeği = 6 vuruş */
  var BOSS_CORE_TIME = 3.4;    /* yeni çekirdek düşme aralığı */
  var BOSS_INTRO = 1.9;        /* giriş animasyonu */
  var BOSS_SHOT_MAX = 20;
  var PLAYER_HP = 3;           /* boss mermilerine karşı oyuncu canı */

  /* 20 farklı boss türü — her koşuda biri rastgele seçilir.
     form: eye | ring | crystal | crown | void
     pattern: fan | wide | snipe | spiral */
  var BOSS_TYPES = [
    { name: 'GÖKYÜZÜ BEKÇİSİ', form: 'eye', c1: '#ff2d6e', c2: '#ff8aa8', shot: '#ff2d6e', base: 2, spread: 0.20, spd: [200, 245], amp: 96, mov: 0.55, coreSpd: 88, pattern: 'fan' },
    { name: 'KIZIL GÖZ', form: 'eye', c1: '#ff4d2d', c2: '#ffb020', shot: '#ff5a2d', base: 2, spread: 0.22, spd: [205, 250], amp: 84, mov: 0.65, coreSpd: 90, pattern: 'fan' },
    { name: 'ZÜMRÜT KÂHİN', form: 'ring', c1: '#39ffcc', c2: '#39ff88', shot: '#39ffcc', base: 2, spread: 0.30, spd: [180, 220], amp: 110, mov: 0.50, coreSpd: 86, pattern: 'wide' },
    { name: 'MOR HÜKÜMDAR', form: 'crown', c1: '#a96bff', c2: '#ff2d95', shot: '#b06bff', base: 3, spread: 0.18, spd: [210, 255], amp: 70, mov: 0.75, coreSpd: 92, pattern: 'fan' },
    { name: 'ALTIN VEZİR', form: 'crown', c1: '#ffd166', c2: '#ffb020', shot: '#ffd166', base: 2, spread: 0.07, spd: [260, 300], amp: 60, mov: 0.85, coreSpd: 96, pattern: 'snipe' },
    { name: 'BUZ EJDERİ', form: 'crystal', c1: '#9fe8ff', c2: '#7fd4ff', shot: '#9fe8ff', base: 2, spread: 0.24, spd: [190, 230], amp: 120, mov: 0.45, coreSpd: 84, pattern: 'fan' },
    { name: 'NEON HAYALET', form: 'void', c1: '#7df9ff', c2: '#e8fbff', shot: '#7df9ff', base: 4, spread: 0.32, spd: [170, 210], amp: 100, mov: 0.60, coreSpd: 90, pattern: 'spiral' },
    { name: 'PEMBE KÂBUS', form: 'eye', c1: '#ff2d95', c2: '#ff77bd', shot: '#ff2d95', base: 3, spread: 0.20, spd: [200, 245], amp: 90, mov: 0.55, coreSpd: 88, pattern: 'fan' },
    { name: 'ÇELİK YÜREK', form: 'crystal', c1: '#9fb8d6', c2: '#d9e6ff', shot: '#b9d0ff', base: 2, spread: 0.08, spd: [250, 295], amp: 80, mov: 0.70, coreSpd: 94, pattern: 'snipe' },
    { name: 'GÖLGE AVCI', form: 'void', c1: '#6b2bff', c2: '#a96bff', shot: '#8a4bff', base: 2, spread: 0.06, spd: [265, 305], amp: 130, mov: 0.80, coreSpd: 98, pattern: 'snipe' },
    { name: 'GÜNEŞ YILANI', form: 'ring', c1: '#ffb020', c2: '#ffe6a3', shot: '#ffb020', base: 3, spread: 0.34, spd: [175, 215], amp: 105, mov: 0.50, coreSpd: 86, pattern: 'wide' },
    { name: 'AY TANRIÇASI', form: 'ring', c1: '#d9e6ff', c2: '#9fb8d6', shot: '#d9e6ff', base: 2, spread: 0.22, spd: [195, 240], amp: 100, mov: 0.45, coreSpd: 88, pattern: 'fan' },
    { name: 'ZEHİR ÇİÇEĞİ', form: 'crown', c1: '#7dff6b', c2: '#39ff88', shot: '#7dff6b', base: 4, spread: 0.30, spd: [180, 220], amp: 110, mov: 0.60, coreSpd: 92, pattern: 'spiral' },
    { name: 'KUANTUM GÖZ', form: 'eye', c1: '#00e5ff', c2: '#7df9ff', shot: '#00e5ff', base: 3, spread: 0.30, spd: [190, 230], amp: 95, mov: 0.60, coreSpd: 90, pattern: 'wide' },
    { name: 'KOMET BEKÇİSİ', form: 'crystal', c1: '#e8fbff', c2: '#7fd4ff', shot: '#e8fbff', base: 2, spread: 0.05, spd: [275, 315], amp: 70, mov: 0.90, coreSpd: 100, pattern: 'snipe' },
    { name: 'SİS CANAVARI', form: 'void', c1: '#9fb8d6', c2: '#e8fbff', shot: '#b9d0ff', base: 2, spread: 0.26, spd: [185, 225], amp: 120, mov: 0.40, coreSpd: 84, pattern: 'fan' },
    { name: 'YILDIZ KIRAN', form: 'crown', c1: '#ff2d6e', c2: '#ffd166', shot: '#ff2d6e', base: 3, spread: 0.36, spd: [170, 210], amp: 115, mov: 0.55, coreSpd: 94, pattern: 'wide' },
    { name: 'TUFAN LORDU', form: 'ring', c1: '#2d7dff', c2: '#7df9ff', shot: '#2d7dff', base: 4, spread: 0.30, spd: [175, 215], amp: 100, mov: 0.50, coreSpd: 90, pattern: 'spiral' },
    { name: 'KADİM KÜRE', form: 'eye', c1: '#ffb020', c2: '#ff77bd', shot: '#ffb020', base: 3, spread: 0.20, spd: [205, 250], amp: 90, mov: 0.65, coreSpd: 92, pattern: 'fan' },
    { name: 'SIFIR VARLIK', form: 'void', c1: '#ffffff', c2: '#a96bff', shot: '#ffffff', base: 5, spread: 0.34, spd: [160, 200], amp: 130, mov: 0.70, coreSpd: 100, pattern: 'spiral' }
  ];

  var lastBossType = -1;
  function pickBossType() {
    if (BOSS_TYPES.length < 2) return BOSS_TYPES[0];
    var i = Math.floor(Math.random() * (BOSS_TYPES.length - 1));
    if (lastBossType >= 0 && i >= lastBossType) i++;
    lastBossType = i;
    return BOSS_TYPES[i];
  }

  var RARITY = {
    common: { name: 'YAYGIN', color: '#9fb6d6', w: 55 },
    rare: { name: 'NADİR', color: '#00e5ff', w: 30 },
    epic: { name: 'EPİK', color: '#a96bff', w: 12 },
    legendary: { name: 'EFSANE', color: '#ffd166', w: 3 }
  };

  var COSMETICS = [
    {
      id: 'klasik', name: 'Klasik', kind: 'skin', rarity: 'common', emblem: 'ring',
      body: ['#334665', '#16202f', '#080d16'], metal: '#3a4c6b',
      accent: '#00e5ff', light: '#ff2d95', thruster: '#ff2d95',
      glass: ['rgba(220,255,255,0.95)', 'rgba(0,190,255,0.5)']
    },
    {
      id: 'mercan', name: 'Mercan', kind: 'skin', rarity: 'common', emblem: 'diamond',
      body: ['#5c3a44', '#2b1822', '#140a10'], metal: '#6b4552',
      accent: '#2ee6c8', light: '#ff7a59', thruster: '#ff7a59',
      glass: ['rgba(255,236,220,0.95)', 'rgba(255,120,90,0.5)']
    },
    {
      id: 'limon', name: 'Limon', kind: 'skin', rarity: 'common', emblem: 'bolt',
      body: ['#3f4a1e', '#20270e', '#0d1006'], metal: '#5b6a2a',
      accent: '#d8ff3e', light: '#9bff6b', thruster: '#b6ff2e',
      glass: ['rgba(248,255,214,0.95)', 'rgba(155,255,0,0.45)']
    },
    {
      id: 'buz', name: 'Buz', kind: 'skin', rarity: 'rare', emblem: 'diamond',
      body: ['#3d5f7a', '#1a2f42', '#0a1420'], metal: '#4f7a99',
      accent: '#bfefff', light: '#7fd4ff', thruster: '#7fd4ff',
      glass: ['rgba(240,253,255,0.95)', 'rgba(120,220,255,0.55)']
    },
    {
      id: 'zumrut', name: 'Zümrüt', kind: 'skin', rarity: 'rare', emblem: 'ring',
      body: ['#1f5240', '#0d2419', '#06110c'], metal: '#2e7259',
      accent: '#39ff88', light: '#0affc8', thruster: '#0affc8',
      glass: ['rgba(224,255,238,0.95)', 'rgba(0,255,170,0.45)']
    },
    {
      id: 'gul', name: 'Gül', kind: 'skin', rarity: 'rare', emblem: 'star',
      body: ['#5a2742', '#2a0f1e', '#12060d'], metal: '#7a3459',
      accent: '#ff5fa2', light: '#ffd1e6', thruster: '#ff2d95',
      glass: ['rgba(255,235,246,0.95)', 'rgba(255,95,162,0.5)']
    },
    {
      id: 'mor', name: 'Mor', kind: 'skin', rarity: 'epic', emblem: 'star',
      body: ['#412a6b', '#1e1236', '#0b0618'], metal: '#5a3d8c',
      accent: '#b788ff', light: '#ff6be0', thruster: '#ff6be0',
      glass: ['rgba(244,236,255,0.95)', 'rgba(183,136,255,0.55)']
    },
    {
      id: 'altin', name: 'Altın', kind: 'skin', rarity: 'epic', emblem: 'bolt',
      body: ['#6b5322', '#33270d', '#151004'], metal: '#8c6d2e',
      accent: '#ffd166', light: '#ff9e2c', thruster: '#ff9e2c',
      glass: ['rgba(255,250,224,0.96)', 'rgba(255,200,80,0.5)']
    },
    {
      id: 'hayalet', name: 'Hayalet', kind: 'skin', rarity: 'epic', emblem: 'ring',
      body: ['#4a5a72', '#232c3c', '#0d1119'], metal: '#5e7190',
      accent: '#dff7ff', light: '#9bb8ff', thruster: '#9bb8ff',
      glass: ['rgba(255,255,255,0.96)', 'rgba(180,210,255,0.45)']
    },
    {
      id: 'ejder', name: 'Ejder', kind: 'skin', rarity: 'legendary', emblem: 'bolt',
      body: ['#6b2a1e', '#33110b', '#160604'], metal: '#8c3a2a',
      accent: '#ffb020', light: '#ff3d3d', thruster: '#ff5a1f',
      glass: ['rgba(255,240,214,0.96)', 'rgba(255,90,31,0.5)']
    },

    { id: 'iz-neon', name: 'Neon İz', kind: 'trail', rarity: 'common', colors: ['#00e5ff'], size: [2, 3.6], rate: 0.055 },
    { id: 'iz-pembe', name: 'Pembe İz', kind: 'trail', rarity: 'common', colors: ['#ff2d95', '#ff77bd'], size: [2, 3.6], rate: 0.055 },
    { id: 'iz-yesil', name: 'Yeşil İz', kind: 'trail', rarity: 'rare', colors: ['#39ff88', '#0affc8'], size: [2.1, 3.8], rate: 0.055 },
    { id: 'iz-altin', name: 'Altın Tozu', kind: 'trail', rarity: 'epic', colors: ['#ffd166', '#ffefb0'], size: [2.2, 4], rate: 0.05 },
    { id: 'iz-gokkusagi', name: 'Gökkuşağı', kind: 'trail', rarity: 'epic', colors: ['#ff2d95', '#ffd166', '#39ff88', '#00e5ff', '#a96bff'], size: [2.2, 3.8], rate: 0.05, rainbow: true },
    { id: 'iz-yildiz', name: 'Yıldız Tozu', kind: 'trail', rarity: 'legendary', colors: ['#ffffff', '#dff7ff'], size: [2.6, 4.6], rate: 0.045 }
  ];

  var BY_ID = {};
  for (var ci = 0; ci < COSMETICS.length; ci++) BY_ID[COSMETICS[ci].id] = COSMETICS[ci];

  var coins = START_COINS;
  var owned = {};
  var equippedSkin = BY_ID['klasik'];
  var equippedTrail = BY_ID['iz-neon'];
  var qualityMode = 'auto';
  var shakeOn = true;
  var crateOpening = false;
  var rewardItem = null;
  var cosTab = 'skin';
  var resetArmed = false;
  var toastTimer = null;

  function loadProgress() {
    var rawCoins = store('wb_coins');
    if (rawCoins === null || rawCoins === undefined) {
      coins = START_COINS;
      store('wb_coins', String(coins));
    } else {
      coins = Math.max(0, parseInt(rawCoins, 10) || 0);
    }

    var arr = null;
    try {
      var rawOwned = store('wb_owned');
      if (rawOwned) arr = JSON.parse(rawOwned);
    } catch (e) { arr = null; }

    owned = {};
    if (arr && arr.length) {
      for (var i = 0; i < arr.length; i++) {
        if (BY_ID[arr[i]]) owned[arr[i]] = 1;
      }
    }
    owned['klasik'] = 1;
    owned['iz-neon'] = 1;

    var sk = store('wb_skin');
    var tl = store('wb_trail');
    equippedSkin = (BY_ID[sk] && BY_ID[sk].kind === 'skin' && owned[sk]) ? BY_ID[sk] : BY_ID['klasik'];
    equippedTrail = (BY_ID[tl] && BY_ID[tl].kind === 'trail' && owned[tl]) ? BY_ID[tl] : BY_ID['iz-neon'];

    var qm = store('wb_quality');
    qualityMode = (qm === '0' || qm === '1' || qm === '2') ? qm : 'auto';
    shakeOn = store('wb_shake') !== '0';
  }

  function saveProgress() {
    store('wb_coins', String(coins));
    store('wb_owned', JSON.stringify(Object.keys(owned)));
    store('wb_skin', equippedSkin.id);
    store('wb_trail', equippedTrail.id);
  }

  function countOwned() {
    var n = 0;
    for (var id in owned) { if (owned[id]) n++; }
    return n;
  }

  function allOwned() {
    return countOwned() >= COSMETICS.length;
  }

  function runCoins() {
    return Math.floor(Math.max(0, G.meters) / 4) + G.starsGot * 5 + (G.crystals || 0) * 30 + (G.bossCoins || 0);
  }

  loadProgress();

  /* ---------------- oyun durumu ---------------- */

  var G = {
    mode: 'menu',            // menu | play | paused | over
    time: 0,
    camY: START_CAM,
    player: null,
    platforms: [],
    stars: [],
    traps: [],
    items: [],
    particles: [],
    floaters: [],
    clouds: [],
    keys: { left: false, right: false },
    pointer: { active: false, x: null },
    touch: { active: false, side: 0, id: null },
    highestY: 0,
    maxUp: 0,
    meters: 0,
    starsGot: 0,
    score: 0,
    shield: false,
    magnet: 0,
    jet: 0,
    invuln: 0,
    double: 0,
    freeze: 0,
    feather: 0,
    hp: PLAYER_HP,
    maxHp: PLAYER_HP,
    bonus: 0,
    crystals: 0,
    coinsEarned: 0,
    boss: null,
    bossShots: [],
    bossCore: null,
    bossTriggered: false,
    bossCoins: 0,
    themeIndex: 0,
    shake: 0,
    flash: 0,
    mile: 0,
    best: parseInt(store('wb_best') || '0', 10) || 0,
    bird: { x: W / 2, y: 0, vx: 0, vy: 0, r: 17, face: 1, tilt: 0, squash: 0, rotor: 0 },
    trailTimer: 0,
    overAt: 0
  };

  /* kontrol stili: 'pc' (klavye/fare) veya 'touch' (ekranın yarısına bas) */
  var savedInput = store('wb_input');
  var inputMode = (savedInput === 'touch' || savedInput === 'pc')
    ? savedInput
    : (isTouch ? 'touch' : 'pc');

  /* ---------------- yardımcılar ---------------- */

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
    } else {
      r = Math.min(r, w / 2, h / 2);
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  }

  function starPath(cx, cy, r, points, inner) {
    points = points || 5;
    inner = inner || 0.45;
    ctx.beginPath();
    for (var i = 0; i < points * 2; i++) {
      var ang = -Math.PI / 2 + i * Math.PI / points;
      var rad = (i % 2) ? r * inner : r;
      var x = cx + Math.cos(ang) * rad;
      var y = cy + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  /* ---------------- parçacık / yazı ---------------- */

  var MAX_PARTICLES = 240;

  function capParticles(extra) {
    var max = Math.round(MAX_PARTICLES * (isTouch ? 0.65 : 1));
    var over = G.particles.length + extra - max;
    if (over > 0) G.particles.splice(0, over);
  }

  function burst(x, y, n, color, power) {
    power = power || 1;
    n = Math.max(3, Math.round(n * Q.parts));
    capParticles(n);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = rand(40, 190) * power;
      G.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: rand(0.3, 0.7), max: 0.7,
        size: rand(2, 5),
        color: color,
        grav: 520
      });
    }
  }

  function puff(x, y, n) {
    n = Math.max(2, Math.round(n * Q.parts));
    capParticles(n);
    for (var i = 0; i < n; i++) {
      G.particles.push({
        x: x + rand(-14, 14), y: y + rand(-4, 4),
        vx: rand(-60, 60), vy: rand(-40, 20),
        life: rand(0.4, 0.8), max: 0.8,
        size: rand(4, 9),
        color: 'rgba(255,255,255,0.9)',
        grav: -30
      });
    }
  }

  function floater(x, y, text, color) {
    G.floaters.push({ x: x, y: y, text: text, color: color || '#fff', life: 1, max: 1 });
  }

  /* ---------------- dünya kurulumu ---------------- */

  function makeClouds() {
    G.clouds = [];
    var n = Math.max(4, Math.round(13 * Q.clouds));
    for (var i = 0; i < n; i++) {
      G.clouds.push({
        x: rand(-40, W + 40),
        y: rand(0, 1400),
        s: rand(0.5, 1.35),
        a: rand(0.35, 0.8),
        drift: rand(-6, 6),
        tint: Math.random() < 0.5 ? '0,229,255' : '255,45,149'
      });
    }
  }

  function reset() {
    G.bird = { x: W / 2, y: -26, vx: 0, vy: -JUMP, r: 17, face: 1, tilt: 0, squash: 0, rotor: 0 };
    G.camY = START_CAM;
    G.platforms = [];
    G.stars = [];
    G.traps = [];
    G.items = [];
    G.particles = [];
    G.floaters = [];
    G.highestY = 0;
    G.maxUp = 0;
    G.meters = 0;
    G.starsGot = 0;
    G.score = 0;
    G.shield = false;
    G.magnet = 0;
    G.jet = 0;
    G.invuln = 0;
    G.double = 0;
    G.freeze = 0;
    G.feather = 0;
    G.hp = PLAYER_HP;
    G.maxHp = PLAYER_HP;
    G.bonus = 0;
    G.crystals = 0;
    G.coinsEarned = 0;
    G.boss = null;
    G.bossShots = [];
    G.bossCore = null;
    G.bossTriggered = false;
    G.bossCoins = 0;
    G.themeIndex = 0;
    G.shake = 0;
    G.flash = 0;
    G.mile = 0;
    G.trailTimer = 0;
    G.pointer.active = false;
    G.pointer.x = null;
    G.touch.active = false;
    G.touch.id = null;
    G.touch.side = 0;

    if ($('boss-bar')) $('boss-bar').classList.add('hidden');
    if ($('boss-warn')) { $('boss-warn').classList.remove('show', 'win'); }
    clearTimeout(bossWarnTimer);

    addPlatform((W - 250) / 2, 0, 250, 'normal');
    for (var i = 0; i < 16; i++) spawnPlatform();
    makeClouds();
    updatePowersHud(true);
    syncPlayerHud(true);
  }

  function addPlatform(x, y, w, type) {
    G.platforms.push({
      x: x, y: y, w: w, h: 13, type: type || 'normal',
      baseX: x, phase: rand(0, 6.28), speed: rand(0.8, 1.5), range: rand(26, 66),
      dead: false, fade: 1
    });
  }

  function spawnPlatform() {
    var d = difficulty();
    var gap = lerp(72, 98, d) + rand(0, 16);
    G.highestY -= gap;

    var w = lerp(92, 54, d) + rand(-5, 5);
    var x = rand(14, W - 14 - w);
    var dist = -G.highestY;

    /* platform türleri de yumuşak olasılıklarla gelir — ani sıçrama yok */
    var pMove = 0.13 * smoothstep(0.20, 0.62, d);
    var pBreak = 0.10 * smoothstep(0.40, 0.85, d);
    var pCloud = 0.12 * smoothstep(0.10, 0.50, d);
    var r = Math.random();
    var type = 'normal';
    if (r < pMove) type = 'moving';
    else if (r < pMove + pBreak) type = 'break';
    else if (r < pMove + pBreak + pCloud) type = 'cloud';

    var pl = {
      x: x, y: G.highestY, w: w, h: 13, type: type,
      baseX: x, phase: rand(0, 6.28), speed: 0.6 + d * 1.1 + rand(0, 0.4), range: rand(28, 70),
      dead: false, fade: 1
    };

    if (type === 'normal' && dist > 180 && Math.random() < 0.11) pl.spring = true;

    /* platformda duran eşyalar */
    if (type === 'normal' && !pl.spring && dist > 260 && Math.random() < 0.15) {
      var roll = Math.random();
      pl.item = roll < 0.22 ? 'shield'
        : roll < 0.44 ? 'magnet'
          : roll < 0.61 ? 'jet'
            : roll < 0.77 ? 'crystal'
              : roll < 0.89 ? 'double'
                : roll < 0.96 ? 'freeze'
                  : 'feather';
    }

    if (!pl.item && dist > 120 && Math.random() < 0.26) pl.star = true;

    G.platforms.push(pl);

    if (pl.star) {
      G.stars.push({
        x: pl.x + pl.w / 2, y: pl.y - 36, r: 11,
        phase: rand(0, 6.28), got: false, plat: pl
      });
    }

    if (pl.item) {
      G.items.push({
        type: pl.item, x: pl.x + pl.w / 2, y: pl.y - 32, r: 15,
        phase: rand(0, 6.28), got: false, plat: pl
      });
    }

    /* testereler de yumuşak şekilde devreye girer */
    var pTrap = 0.34 * smoothstep(0.18, 0.95, d);
    if (Math.random() < pTrap) {
      var tx = rand(50, W - 50);
      G.traps.push({
        x: tx, baseX: tx, y: G.highestY - gap * 0.5,
        r: 14, range: rand(24, 76), phase: rand(0, 6.28),
        speed: 0.9 + d * 1.6 + rand(0, 0.6), angle: rand(0, 6.28)
      });
    }
  }

  /* ---------------- akış ---------------- */

  function startGame() {
    closeSheets();
    reset();
    setMode('play');
    sfx('start');
    updateHud(true);
    if (inputMode === 'touch') {
      goFullscreen();
      showTouchHint();
    }
  }

  function goMenu() {
    closeSheets();
    reset();
    setMode('menu');
    $('menu-best').textContent = G.best;
    updateWalletUI();
  }

  /* ---------------- tam ekran (telefon) ---------------- */

  function goFullscreen() {
    var el = document.documentElement;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) return;
      var req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) {
        var p = req.call(el, { navigationUI: 'hide' });
        if (p && p.then) p.then(lockPortrait).catch(function () { });
      }
    } catch (e) { }
  }

  function lockPortrait() {
    try {
      if (screen.orientation && screen.orientation.lock) {
        var p = screen.orientation.lock('portrait');
        if (p && p.catch) p.catch(function () { });
      }
    } catch (e) { }
  }

  /* ---------------- kontrol stili ---------------- */

  function applyInputMode(mode, persist) {
    inputMode = (mode === 'touch') ? 'touch' : 'pc';
    if (persist !== false) store('wb_input', inputMode);

    var btns = document.querySelectorAll('.mode-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('on', btns[i].getAttribute('data-mode') === inputMode);
    }
    $('ctrl-pc').classList.toggle('hidden', inputMode !== 'pc');
    $('ctrl-touch').classList.toggle('hidden', inputMode !== 'touch');

    G.touch.active = false;
    G.touch.side = 0;
    G.pointer.active = false;
    G.pointer.x = null;
  }

  function setMode(mode) {
    G.mode = mode;
    $('menu').classList.toggle('hidden', mode !== 'menu');
    $('over').classList.toggle('hidden', mode !== 'over');
    $('pause').classList.toggle('hidden', mode !== 'paused');
    $('hud').classList.toggle('hidden', mode === 'menu' || mode === 'over');
    if (mode !== 'play') {
      hideTouchHint();
      $('boss-warn').classList.remove('show');
    }
  }

  var touchHintTimer = null;
  function showTouchHint() {
    var el = $('hint-touch');
    el.classList.add('show');
    clearTimeout(touchHintTimer);
    touchHintTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }
  function hideTouchHint() {
    $('hint-touch').classList.remove('show');
    clearTimeout(touchHintTimer);
  }

  function showOver(isNew, earned) {
    G.mode = 'over';
    G.overAt = G.time;
    setMode('over');
    $('over-score').textContent = G.score;
    $('over-meters').textContent = G.meters + ' m';
    $('over-stars').textContent = '★ ' + G.starsGot;
    $('over-best').textContent = G.best;
    $('over-coins').textContent = earned || 0;
    $('over-wallet').textContent = '· cüzdan ' + coins;
    $('new-rec').classList.toggle('hidden', !isNew);
    $('over-title').textContent = isNew ? 'YENİ REKOR!' : 'DÜŞTÜN!';
    updateWalletUI();
  }

  function die() {
    if (G.mode !== 'play') return;
    var p = G.bird;

    /* tüy: ölümü bir kez iptal eder */
    if (G.feather > 0) {
      G.feather = 0;
      G.invuln = 1.6;
      p.vy = -JUMP;
      p.y = G.camY + H * 0.5;
      p.tilt = 0;
      p.squash = 0;

      /* yakındaki testereleri temizle */
      for (var t = G.traps.length - 1; t >= 0; t--) {
        var tr = G.traps[t];
        var tdx = tr.x - p.x, tdy = tr.y - p.y;
        if (tdx * tdx + tdy * tdy < 170 * 170) {
          burst(tr.x, tr.y, 16, '#9fe8ff', 1.2);
          G.traps.splice(t, 1);
        }
      }

      burst(p.x, p.y, 30, '#ffffff', 1.5);
      burst(p.x, p.y, 18, '#bfefff', 1.2);
      floater(p.x, p.y - 20, '2. ŞANS!', '#ffffff');
      sfx('revive');
      G.shake = Math.max(G.shake, 10);
      G.flash = Math.max(G.flash, 0.34);
      G.hp = 1;
      G.bossShots.length = 0;
      updatePowersHud(true);
      syncPlayerHud(true);
      return;
    }

    G.shake = 16;
    G.flash = 0.55;
    burst(p.x, p.y, 30, '#00e5ff', 1.5);
    burst(p.x, p.y, 14, '#ff2d95', 1.2);
    sfx('die');

    var isNew = G.score > G.best;
    if (isNew) {
      G.best = G.score;
      try { store('wb_best', String(G.best)); } catch (e) { }
    }
    var earned = G.coinsEarned + (isNew ? 50 : 0);
    if (earned > 0) {
      coins += earned;
      saveProgress();
    }
    showOver(isNew, earned);
  }

  /* ---------------- güncelleme ---------------- */

  function update(dt) {
    G.time += dt;
    G.shake = Math.max(0, G.shake - dt * 34);
    G.flash = Math.max(0, G.flash - dt * 1.8);
    updateParticles(dt);

    if (G.mode === 'play') {
      updatePlay(dt);
    } else if (G.mode === 'over') {
      updateOver(dt);
    } else if (G.mode === 'menu') {
      updateMenu(dt);
    }
    updateClouds(dt);
  }

  function updateMenu(dt) {
    G.bird.rotor += dt;
    if (!G.player) { /* noop */ }
  }

  function updateOver(dt) {
    // dünya donuk; sadece parçacıklar ve yazılar akar
    G.bird.rotor += dt * 0.2;
  }

  function updateParticles(dt) {
    for (var i = G.particles.length - 1; i >= 0; i--) {
      var pt = G.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) { G.particles.splice(i, 1); continue; }
      pt.vy += (pt.grav || 0) * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
    for (var j = G.floaters.length - 1; j >= 0; j--) {
      var fl = G.floaters[j];
      fl.life -= dt * 1.1;
      fl.y -= 34 * dt;
      if (fl.life <= 0) G.floaters.splice(j, 1);
    }
  }

  function updateClouds(dt) {
    for (var i = 0; i < G.clouds.length; i++) {
      var c = G.clouds[i];
      c.x += c.drift * dt;
      if (c.x < -120) c.x = W + 120;
      if (c.x > W + 120) c.x = -120;
    }
  }

  function updatePlay(dt) {
    var p = G.bird;

    /* --- yatay hareket --- */
    var ax = 0;
    if (G.keys.left) ax -= MOVE_ACC;
    if (G.keys.right) ax += MOVE_ACC;
    if (ax === 0 && inputMode === 'touch') {
      /* ekranın sol yarısı -> sol, sağ yarısı -> sağ */
      if (G.touch.active && G.touch.side !== 0) ax = G.touch.side * MOVE_ACC;
    } else if (ax === 0 && G.pointer.active && G.pointer.x !== null) {
      /* bilgisayarda fareyi basılı tutup sürükleme */
      var d = G.pointer.x - p.x;
      if (Math.abs(d) > 5) ax = clamp(d * 17, -MOVE_ACC, MOVE_ACC);
    }

    if (ax !== 0) {
      p.vx += ax * dt;
      p.face = ax > 0 ? 1 : -1;
    } else {
      p.vx *= Math.pow(0.0016, dt);
      if (Math.abs(p.vx) < 3) p.vx = 0;
    }
    p.vx = clamp(p.vx, -MAX_VX, MAX_VX);
    p.x += p.vx * dt;

    if (p.x < -p.r) p.x = W + p.r;
    else if (p.x > W + p.r) p.x = -p.r;

    /* --- dikey hareket --- */
    var prevBottom = p.y + p.r;

    if (G.invuln > 0) G.invuln = Math.max(0, G.invuln - dt);
    if (G.magnet > 0) G.magnet = Math.max(0, G.magnet - dt);
    if (G.double > 0) G.double = Math.max(0, G.double - dt);
    if (G.freeze > 0) G.freeze = Math.max(0, G.freeze - dt);

    if (G.jet > 0) {
      /* jetpack: sabit hızlı yükseliş, alev izi */
      G.jet = Math.max(0, G.jet - dt);
      p.vy = -940;
      if (Math.random() < 0.85) {
        G.particles.push({
          x: p.x + rand(-4, 4),
          y: p.y + 15,
          vx: rand(-40, 40),
          vy: rand(120, 300),
          life: rand(0.18, 0.34), max: 0.34,
          size: rand(2.5, 5),
          color: Math.random() < 0.5 ? 'rgba(255,176,32,0.9)' : 'rgba(255,72,90,0.85)',
          grav: 260
        });
      }
      if (G.jet === 0) {
        p.vy = -JUMP * 0.55;
        burst(p.x, p.y + 10, 14, '#ffb020', 1.1);
      }
    } else {
      p.vy = Math.min(p.vy + GRAV * dt, 1650);
    }
    p.y += p.vy * dt;

    p.tilt = clamp(p.vx / 1100, -0.26, 0.26);
    p.squash = Math.max(0, p.squash - dt * 4.5);
    p.rotor += dt * (p.vy < 0 ? 2.6 : 1.1);

    /* --- platforma çarpma --- */
    if (p.vy > 0) {
      var bottom = p.y + p.r;
      for (var i = 0; i < G.platforms.length; i++) {
        var pl = G.platforms[i];
        if (pl.dead) continue;
        if (p.x + 9 < pl.x || p.x - 9 > pl.x + pl.w) continue;
        if (prevBottom <= pl.y + 2 && bottom >= pl.y) {
          bounce(pl);
          break;
        }
      }
    }

    /* --- kamera --- */
    var camTarget = p.y - H * 0.46;
    if (camTarget < G.camY) {
      G.camY += (camTarget - G.camY) * Math.min(1, dt * 11);
    }

    /* --- skor --- */
    if (-p.y > G.maxUp) G.maxUp = -p.y;
    G.meters = Math.max(0, Math.floor((G.maxUp - APEX) / 4));
    G.score = G.meters + G.starsGot * 16 + G.bonus;
    G.coinsEarned = runCoins();

    /* bölge değişimi */
    var thNow = themeFor(G.meters);
    if (thNow.index !== G.themeIndex) {
      G.themeIndex = thNow.index;
      floater(W / 2, G.camY + 156, 'BÖLGE ' + (thNow.index + 1) + ' · ' + thNow.name, thNow.glow);
      sfx('zone');
    }

    /* uzun hayatta kalma -> boss */
    if (!G.bossTriggered && G.meters >= BOSS_AT) startBoss();

    var mileNow = Math.floor(G.meters / 250) * 250;
    if (mileNow > G.mile && mileNow >= 250) {
      G.mile = mileNow;
      floater(W / 2, G.camY + 190, mileNow + ' m!', '#7df9ff');
      sfx('mile');
    }
    updateHud();
    updatePowersHud();
    syncPlayerHud();

    /* --- iz (kuşanılan iz kozmetiği) --- */
    if (Math.abs(p.vx) > 230 || p.vy < -400) {
      G.trailTimer -= dt;
      if (G.trailTimer <= 0) {
        var trl = equippedTrail;
        var tcol = trl.rainbow
          ? trl.colors[Math.floor(G.time * 9) % trl.colors.length]
          : trl.colors[Math.floor(Math.random() * trl.colors.length)];
        G.trailTimer = trl.rate;
        G.particles.push({
          x: p.x - p.face * 14 + rand(-4, 4),
          y: p.y + rand(-2, 8),
          vx: -p.vx * 0.15 + rand(-14, 14),
          vy: rand(-16, 16) - 20,
          life: rand(0.25, 0.45), max: 0.45,
          size: rand(trl.size[0], trl.size[1]),
          color: rgba(tcol, 0.78),
          grav: -20
        });
      }
    }

    /* --- platformlar, yıldızlar, tuzaklar --- */
    for (var k = 0; k < G.platforms.length; k++) {
      var pf = G.platforms[k];
      if (pf.type === 'moving' && !pf.dead) {
        pf.phase += dt * pf.speed;
        pf.x = pf.baseX + Math.sin(pf.phase) * pf.range;
        if (pf.x < 8) { pf.x = 8; pf.baseX = 8; pf.range = -pf.range; }
        if (pf.x + pf.w > W - 8) { pf.x = W - 8 - pf.w; pf.baseX = pf.x; pf.range = -pf.range; }
      }
      if (pf.dead) pf.fade -= dt * 3.2;
    }

    for (var s = 0; s < G.stars.length; s++) {
      var st = G.stars[s];
      if (st.got) continue;
      st.phase += dt * 3;
      if (st.plat && !st.pull) {
        st.x = st.plat.x + st.plat.w / 2;
        st.y = st.plat.y - 36;
      }
      var dx = p.x - st.x, dy = p.y - st.y;
      var sd = Math.sqrt(dx * dx + dy * dy) || 1;

      /* mıknatıs: yakındaki shard'ları oyuncuya çeker */
      if (G.magnet > 0 && sd < 230) {
        st.pull = true;
        var sp = 300 + (230 - sd) * 2.2;
        st.x += (dx / sd) * sp * dt;
        st.y += (dy / sd) * sp * dt;
        if (!st.sparkT || st.sparkT <= 0) {
          st.sparkT = 0.06;
          G.particles.push({
            x: st.x, y: st.y, vx: rand(-20, 20), vy: rand(-20, 20),
            life: 0.2, max: 0.2, size: rand(1.4, 2.6),
            color: 'rgba(255,45,149,0.8)', grav: 0
          });
        }
      }
      if (st.sparkT > 0) st.sparkT -= dt;

      if (sd < p.r + st.r + 6) {
        st.got = true;
        G.starsGot++;
        var x2 = G.double > 0;
        if (x2) G.bonus += 16;
        sfx('star');
        burst(st.x, st.y, 12, x2 ? '#ffd166' : '#00e5ff', 1.1);
        floater(st.x, st.y - 6, x2 ? '+2 ★' : '+1 ★', x2 ? '#ffe6a3' : '#7df9ff');
        G.flash = Math.max(G.flash, 0.18);
      }
    }

    /* --- eşyalar (kalkan / mıknatıs / jetpack) --- */
    for (var it = 0; it < G.items.length; it++) {
      var item = G.items[it];
      if (item.got) continue;
      item.phase += dt * 2.2;
      if (item.plat && !item.plat.dead) {
        item.x = item.plat.x + item.plat.w / 2;
        item.y = item.plat.y - 32;
      }
      var idx = p.x - item.x, idy = p.y - item.y;
      if (idx * idx + idy * idy < (p.r + item.r + 8) * (p.r + item.r + 8)) {
        collectItem(item);
      }
    }

    var frozen = G.freeze > 0;
    for (var t = 0; t < G.traps.length; t++) {
      var tr = G.traps[t];
      if (!frozen) {
        tr.phase += dt * tr.speed;
        tr.x = tr.baseX + Math.sin(tr.phase) * tr.range;
        if (tr.x < 26) { tr.x = 26; tr.baseX = 26; tr.range = -tr.range; }
        if (tr.x > W - 26) { tr.x = W - 26; tr.baseX = tr.x; tr.range = -tr.range; }
        tr.angle += dt * 7;
      }
      if (G.jet > 0 || G.invuln > 0) continue;
      var tdx = p.x - tr.x, tdy = p.y - tr.y;
      if (tdx * tdx + tdy * tdy < (p.r + tr.r * 0.82) * (p.r + tr.r * 0.82)) {
        if (G.shield) {
          /* kalkan bir testereyi parçalar */
          G.shield = false;
          G.invuln = 0.9;
          G.shake = 12;
          G.flash = Math.max(G.flash, 0.3);
          burst(tr.x, tr.y, 26, '#00e5ff', 1.5);
          burst(tr.x, tr.y, 14, '#ffffff', 1.1);
          floater(tr.x, tr.y - 10, 'KALKAN KIRILDI', '#7df9ff');
          G.traps.splice(t, 1);
          t--;
          sfx('shieldBreak');
          continue;
        }
        die();
        return;
      }
    }

    /* --- boss --- */
    if (G.boss) updateBoss(dt);

    /* --- dünyayı besle / temizle --- */
    while (G.highestY > G.camY - 320) spawnPlatform();
    var below = G.camY + H + 160;
    G.platforms = G.platforms.filter(function (x) { return x.y < below && !(x.dead && x.fade <= 0); });
    G.stars = G.stars.filter(function (x) { return !x.got && x.y < below; });
    G.traps = G.traps.filter(function (x) { return x.y < below; });
    G.items = G.items.filter(function (x) { return !x.got && x.y < below; });

    /* --- düşme --- */
    if (p.y - G.camY > H + 140) {
      die();
    }
  }

  function collectItem(item) {
    item.got = true;
    var p = G.bird;

    if (item.type === 'shield') {
      G.shield = true;
      sfx('shield');
      burst(item.x, item.y, 18, '#00e5ff', 1.2);
      floater(item.x, item.y - 10, 'KALKAN', '#7df9ff');
      G.flash = Math.max(G.flash, 0.16);
    } else if (item.type === 'magnet') {
      G.magnet = 8;
      sfx('magnet');
      burst(item.x, item.y, 18, '#ff2d95', 1.2);
      floater(item.x, item.y - 10, 'MIKNATIS 8s', '#ffb3d8');
    } else if (item.type === 'jet') {
      G.jet = 1.8;
      p.vy = -940;
      sfx('jet');
      burst(item.x, item.y, 22, '#ffb020', 1.4);
      floater(item.x, item.y - 10, 'JETPACK', '#ffd08a');
      G.shake = Math.max(G.shake, 6);
      G.flash = Math.max(G.flash, 0.2);
    } else if (item.type === 'crystal') {
      var pts = G.double > 0 ? 300 : 150;
      G.bonus += pts;
      G.crystals++;
      sfx('crystal');
      burst(item.x, item.y, 24, '#a96bff', 1.5);
      burst(item.x, item.y, 10, '#ffffff', 1.1);
      floater(item.x, item.y - 10, '+' + pts, '#d9b3ff');
      G.flash = Math.max(G.flash, 0.22);
      G.shake = Math.max(G.shake, 5);
    } else if (item.type === 'double') {
      G.double = 10;
      sfx('double');
      burst(item.x, item.y, 20, '#ffd166', 1.3);
      floater(item.x, item.y - 10, '2× PUAN 10s', '#ffe6a3');
      G.flash = Math.max(G.flash, 0.16);
    } else if (item.type === 'freeze') {
      G.freeze = 5;
      sfx('freeze');
      burst(item.x, item.y, 22, '#9fe8ff', 1.3);
      floater(item.x, item.y - 10, 'DONMA 5s', '#cdefff');
      G.flash = Math.max(G.flash, 0.16);
    } else if (item.type === 'feather') {
      G.feather = 1;
      sfx('feather');
      burst(item.x, item.y, 22, '#ffffff', 1.3);
      floater(item.x, item.y - 10, '2. ŞANS', '#ffffff');
      G.flash = Math.max(G.flash, 0.16);
    }
    updatePowersHud();
  }

  function bounce(pl) {
    var p = G.bird;
    p.y = pl.y - p.r;
    var spring = !!pl.spring && pl.type === 'normal';
    p.vy = -JUMP * (spring ? SPRING_MULT : 1);
    p.squash = spring ? 0.42 : 0.26;

    if (pl.type === 'break') {
      pl.dead = true;
      pl.fade = 1;
      burst(pl.x + pl.w / 2, pl.y + 4, 14, '#ffb020', 1.1);
      sfx('break');
    } else if (pl.type === 'cloud') {
      pl.dead = true;
      pl.fade = 1;
      puff(pl.x + pl.w / 2, pl.y, 12);
      sfx('cloud');
    } else if (spring) {
      sfx('spring');
      burst(pl.x + pl.w / 2, pl.y, 10, '#9ff0a8', 1.1);
      G.shake = Math.max(G.shake, 5);
    } else {
      sfx('jump');
      burst(p.x, p.y + 14, 5, 'rgba(255,255,255,0.8)', 0.55);
    }

    G.shake = Math.max(G.shake, spring ? 5 : 1.7);
  }

  /* =========================================================
     BOSS — GÖKYÜZÜ BEKÇİSİ
     Uzun süre hayatta kalınca gelir. Çekirdeklerini toplayarak
     üç vuruşta indirilir.
     ========================================================= */

  var bossWarnTimer = null;

  function showBossWarn(win, name) {
    var el = $('boss-warn');
    if (!el) return;
    el.classList.toggle('win', !!win);
    $('bw-kicker').textContent = win ? '✓ TEMİZLENDİ ✓' : '⚠ BOSS GELİYOR ⚠';
    $('bw-title').textContent = win ? 'BOSS YENİLDİ' : (name || 'GÖKYÜZÜ BEKÇİSİ');
    $('bw-sub').textContent = win
      ? 'CAN DOLDU · +60 NEON'
      : '6 ÇEKİRDEK TOPLA · CANINI KORU';
    el.classList.add('show');
    clearTimeout(bossWarnTimer);
    bossWarnTimer = setTimeout(function () { el.classList.remove('show'); }, win ? 2800 : 2600);
  }

  function syncBossHud() {
    var bar = $('boss-bar');
    if (!bar) return;
    if (!G.boss) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    var pips = bar.querySelectorAll('#boss-pips i');
    for (var i = 0; i < pips.length; i++) {
      pips[i].classList.toggle('lost', i >= G.boss.hp);
    }
    bar.classList.toggle('low', G.boss.hp <= 2);
  }

  function pulseBossBar() {
    var bar = $('boss-bar');
    if (!bar) return;
    bar.classList.remove('hit');
    void bar.offsetWidth;
    bar.classList.add('hit');
  }

  function startBoss() {
    if (G.boss || G.bossTriggered) return;
    G.bossTriggered = true;
    var ty = pickBossType();
    G.boss = {
      state: 'intro', hp: BOSS_HP, maxHp: BOSS_HP, type: ty,
      x: W / 2, sy: -190, t: 0, intro: 0,
      phase: rand(0, 6.28), angle: 0, flash: 0, charge: 0,
      coreTimer: 2.2, shotTimer: 2.8, deathT: 0, burstT: 0
    };
    G.bossShots.length = 0;
    G.bossCore = null;
    G.invuln = Math.max(G.invuln, BOSS_INTRO + 0.6);
    G.shake = Math.max(G.shake, 14);
    G.flash = Math.max(G.flash, 0.22);
    sfx('bossWarn');

    /* boss rengini HUD'a ve uyarı bandına taşı */
    document.body.style.setProperty('--bc1', ty.c1);
    document.body.style.setProperty('--bc2', ty.c2);

    var bar = $('boss-bar');
    if (bar) bar.classList.remove('hit');
    var nameEl = $('boss-name');
    if (nameEl) nameEl.textContent = ty.name;

    syncBossHud();
    showBossWarn(false, ty.name);
    floater(W / 2, G.camY + 250, '6 ÇEKİRDEK TOPLA', '#ffd6e0');
  }

  function updateBoss(dt) {
    var b = G.boss;
    if (!b) return;

    b.t += dt;
    b.flash = Math.max(0, b.flash - dt * 4);
    b.angle += dt * 0.85;

    if (b.state === 'intro') {
      b.intro += dt;
      var k = clamp(b.intro / BOSS_INTRO, 0, 1);
      var e = 1 - Math.pow(1 - k, 3);
      b.sy = lerp(-190, 128, e);
      b.x = W / 2 + Math.sin(b.intro * 2.1) * 34 * e;
      if (k >= 1) {
        b.state = 'active';
        b.coreTimer = 2.2;
        b.shotTimer = 2.8;
        syncBossHud();
        floater(W / 2, G.camY + 168, 'ÇEKİRDEĞİ YAKALA!', '#ffe6a3');
      }
      return;
    }

    if (b.state === 'active') {
      var ty = b.type || BOSS_TYPES[0];
      b.sy = 128 + Math.sin(b.t * 1.5) * 7;
      var targetX = W / 2 + Math.sin(b.t * 0.55) * ty.amp;
      b.x += (targetX - b.x) * Math.min(1, dt * (1.2 + ty.mov * 2));

      /* çekirdek üretimi */
      if (!G.bossCore) {
        b.coreTimer -= dt;
        if (b.coreTimer <= 0) {
          b.coreTimer = BOSS_CORE_TIME;
          spawnBossCore();
        }
      }

      /* ateşleme: önce göz şarj olur (telegraf), sonra fan */
      if (b.charge > 0) {
        b.charge -= dt;
        if (Math.random() < 0.45) {
          G.particles.push({
            x: b.x + rand(-16, 16), y: G.camY + b.sy + rand(-10, 16),
            vx: rand(-30, 30), vy: rand(-10, 40),
            life: 0.24, max: 0.24, size: rand(1.5, 3),
            color: rgba(ty.c1, 0.75), grav: 0
          });
        }
        if (b.charge <= 0) fireBossShots();
      } else {
        b.shotTimer -= dt;
        if (b.shotTimer <= 0) {
          b.shotTimer = rand(3.0, 4.2);
          b.charge = 0.7;
        }
      }

      /* gövdesine çarparsan ölmezsin, geri savrulursun */
      var bdx = G.bird.x - b.x;
      var bdy = G.bird.y - (G.camY + b.sy);
      var bd2 = bdx * bdx + bdy * bdy;
      if (bd2 < 52 * 52) {
        var bd = Math.sqrt(bd2) || 1;
        G.bird.x = clamp(G.bird.x + (bdx / bd) * 5, -20, W + 20);
        G.bird.vy = Math.max(G.bird.vy, 430);
        G.shake = Math.max(G.shake, 9);
        if (G.invuln <= 0) {
          G.invuln = 0.8;
          floater(G.bird.x, G.bird.y - 16, 'GERİ ÇEKİL!', b.type ? b.type.c2 : '#ff8aa8');
        }
      }
    } else if (b.state === 'dying') {
      b.deathT += dt;
      b.burstT -= dt;
      b.sy += dt * 30;
      b.x += Math.sin(b.deathT * 24) * 1.7;
      if (b.burstT <= 0) {
        b.burstT = 0.13;
        burst(b.x + rand(-36, 36), G.camY + b.sy + rand(-28, 28), 12,
          Math.random() < 0.5 ? (b.type ? b.type.c1 : '#ff2d6e') : '#ffd166', 1.4);
        G.shake = Math.max(G.shake, 8);
      }
      if (b.deathT >= 1.4) {
        G.boss = null;
        syncBossHud();
      }
    }

    updateBossShots(dt);
    updateBossCore(dt);
  }

  function spawnBossCore() {
    var b = G.boss;
    if (!b || b.state !== 'active' || G.bossCore) return;
    var ty = b.type || BOSS_TYPES[0];
    var p = G.bird;
    var cx = clamp(p.x + rand(-80, 80), 52, W - 52);
    var cy = G.camY + 190;
    G.bossCore = {
      x: cx, baseX: cx, y: cy, vy: ty.coreSpd,
      phase: rand(0, 6.28), r: 17, t: 0, spark: 0
    };
    burst(cx, cy, 14, '#ffd166', 1.1);
    burst(cx, cy, 10, ty.c1, 1.0);
    sfx('core');
    floater(cx, cy - 30, 'ÇEKİRDEK', '#ffe6a3');
  }

  function updateBossCore(dt) {
    var c = G.bossCore;
    if (!c) return;
    var p = G.bird;
    c.t += dt;
    c.phase += dt * 2.4;
    c.y += c.vy * dt;
    c.baseX += Math.sin(c.phase * 0.7) * 12 * dt;

    /* mıknatıs çekirdeği de çeker */
    if (G.magnet > 0) {
      var mdx = p.x - c.x, mdy = p.y - c.y;
      var md = Math.sqrt(mdx * mdx + mdy * mdy) || 1;
      if (md < 240) {
        c.baseX += (mdx / md) * 110 * dt;
        c.y += (mdy / md) * 160 * dt;
      }
    }

    c.x = clamp(c.baseX + Math.sin(c.phase * 0.9) * 24, 30, W - 30);
    c.spark -= dt;
    if (c.spark <= 0) {
      c.spark = 0.07;
      G.particles.push({
        x: c.x + rand(-12, 12), y: c.y + rand(-12, 12),
        vx: rand(-16, 16), vy: rand(20, 60),
        life: 0.3, max: 0.3, size: rand(1.4, 2.8),
        color: Math.random() < 0.5 ? 'rgba(255,209,102,0.8)' : rgba(ty.c1, 0.7),
        grav: 40
      });
    }

    var dx = p.x - c.x, dy = p.y - c.y;
    if (dx * dx + dy * dy < (p.r + c.r + 10) * (p.r + c.r + 10)) {
      collectBossCore();
      return;
    }
    if (c.y > G.camY + H + 80) {
      G.bossCore = null;
      if (G.boss) G.boss.coreTimer = BOSS_CORE_TIME;
      floater(W / 2, G.camY + H - 46, 'ÇEKİRDEK KAÇTI', '#ff8aa8');
    }
  }

  function collectBossCore() {
    var b = G.boss, c = G.bossCore;
    G.bossCore = null;
    if (!b || b.state !== 'active' || !c) return;

    b.hp = Math.max(0, b.hp - 1);
    b.flash = 1;
    G.shake = Math.max(G.shake, 13);
    G.flash = Math.max(G.flash, 0.3);
    G.invuln = Math.max(G.invuln, 0.9);
    G.bossShots.length = 0;

    burst(c.x, c.y, 26, '#ffd166', 1.6);
    burst(c.x, c.y, 18, b.type ? b.type.c1 : '#ff2d6e', 1.3);
    floater(c.x, c.y - 18, 'VURUŞ ' + (b.maxHp - b.hp) + '/' + b.maxHp, '#ffe6a3');
    sfx('bossHit');
    syncBossHud();
    pulseBossBar();

    if (b.hp <= 0) {
      killBoss();
    } else {
      b.coreTimer = BOSS_CORE_TIME;
    }
  }

  function fireBossShots() {
    var b = G.boss;
    if (!b || b.state !== 'active') return;
    var ty = b.type || BOSS_TYPES[0];
    var p = G.bird;
    var ox = b.x;
    var oy = G.camY + b.sy + 26;
    var prog = 1 - b.hp / b.maxHp;
    var count, spread = ty.spread;

    if (ty.pattern === 'spiral') {
      count = ty.base + Math.round(prog * 3);
      var off = b.t * 0.9;
      for (var i = 0; i < count; i++) {
        var a = off + i * (Math.PI * 2 / count);
        pushBossShot(ox, oy, a, rand(ty.spd[0], ty.spd[1]), ty);
      }
    } else {
      if (ty.pattern === 'snipe') count = ty.base + (prog > 0.55 ? 1 : 0);
      else if (ty.pattern === 'wide') count = ty.base + 1 + Math.round(prog * 2);
      else count = ty.base + Math.round(prog * 2);

      var base = Math.atan2(p.y - oy, p.x - ox);
      for (var j = 0; j < count; j++) {
        var ang = base + (j - (count - 1) / 2) * spread;
        pushBossShot(ox, oy, ang, rand(ty.spd[0], ty.spd[1]), ty);
      }
    }
    while (G.bossShots.length > BOSS_SHOT_MAX) G.bossShots.shift();

    burst(ox, oy, 14, ty.c1, 1.1);
    G.shake = Math.max(G.shake, 4);
    b.flash = Math.max(b.flash, 0.25);
    sfx('bossShot');
  }

  function pushBossShot(ox, oy, ang, sp, ty) {
    G.bossShots.push({
      x: ox + Math.cos(ang) * 30,
      y: oy + Math.sin(ang) * 30,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      r: ty.pattern === 'snipe' ? 6 : 7,
      angle: rand(0, 6.28),
      life: 5.5,
      color: ty.shot,
      glow: ty.c1
    });
  }

  function updateBossShots(dt) {
    var p = G.bird;
    for (var i = G.bossShots.length - 1; i >= 0; i--) {
      var s = G.bossShots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.angle += dt * 9;
      s.life -= dt;

      if (s.life <= 0 || s.y > G.camY + H + 90 || s.x < -50 || s.x > W + 50) {
        G.bossShots.splice(i, 1);
        continue;
      }
      if (Math.random() < 0.22) {
        G.particles.push({
          x: s.x, y: s.y, vx: rand(-10, 10), vy: rand(-10, 10),
          life: 0.2, max: 0.2, size: rand(1.4, 2.8),
          color: rgba(s.color || '#ff2d6e', 0.55), grav: 0
        });
      }
      if (G.jet > 0 || G.invuln > 0) continue;

      var dx = p.x - s.x, dy = p.y - s.y;
      if (dx * dx + dy * dy < (p.r + s.r + 3) * (p.r + s.r + 3)) {
        if (G.shield) {
          G.shield = false;
          G.invuln = 0.9;
          G.shake = 10;
          G.flash = Math.max(G.flash, 0.25);
          burst(s.x, s.y, 18, '#00e5ff', 1.2);
          floater(s.x, s.y - 8, 'KALKAN KIRILDI', '#7df9ff');
          sfx('shieldBreak');
          G.bossShots.splice(i, 1);
          continue;
        }
        G.bossShots.splice(i, 1);
        damagePlayer(1, s.x, s.y);
        return;
      }
    }
  }

  function damagePlayer(amount, sx, sy) {
    if (G.mode !== 'play' || G.hp <= 0) return;

    G.hp = Math.max(0, G.hp - amount);
    G.invuln = Math.max(G.invuln, 1.4);
    G.shake = Math.max(G.shake, 16);
    G.flash = Math.max(G.flash, 0.38);

    var ty = G.boss && G.boss.type ? G.boss.type : BOSS_TYPES[0];
    burst(sx || G.bird.x, sy || G.bird.y, 26, ty.c1, 1.5);
    burst(sx || G.bird.x, sy || G.bird.y, 14, '#ffffff', 1.1);
    floater(G.bird.x, G.bird.y - 22, '−1 CAN', '#ff8aa8');
    sfx('playerHit');
    syncPlayerHud(true);
    pulsePlayerHp();

    if (G.hp <= 0) die();
  }

  function killBoss() {
    var b = G.boss;
    if (!b || b.state === 'dying') return;
    var ty = b.type || BOSS_TYPES[0];
    b.state = 'dying';
    b.deathT = 0;
    b.burstT = 0;
    G.bossShots.length = 0;
    G.bossCore = null;
    G.bonus += 300;
    G.bossCoins += 60;
    G.flash = Math.max(G.flash, 0.7);
    G.shake = Math.max(G.shake, 24);
    G.invuln = Math.max(G.invuln, 2.4);
    G.shield = true;
    G.hp = G.maxHp;
    syncPlayerHud(true);
    sfx('bossDie');
    showBossWarn(true);
    floater(W / 2, G.camY + 240, '+300 PUAN · +60 NEON', '#ffe6a3');
    floater(W / 2, G.camY + 300, 'CAN DOLDU', '#39ff88');
    burst(b.x, G.camY + b.sy, 40, ty.c1, 1.8);
    burst(b.x, G.camY + b.sy, 30, ty.c2, 1.5);
    burst(b.x, G.camY + b.sy, 18, '#ffffff', 1.2);
    pulseBossBar();
  }

  /* ---------------- HUD ---------------- */

  var lastHudKey = '';
  function updateHud(force) {
    var key = G.meters + '|' + G.starsGot + '|' + G.best + '|' + G.coinsEarned;
    if (!force && key === lastHudKey) return;
    lastHudKey = key;
    $('hud-meters').textContent = G.meters;
    $('hud-stars').textContent = G.starsGot;
    $('hud-best').textContent = G.best;
    $('hud-coins').textContent = G.coinsEarned;
  }

  var lastPowersKey = '';
  function updatePowersHud(force) {
    var key = (G.shield ? 1 : 0) + '|' + Math.ceil(G.magnet) + '|' + Math.ceil(G.jet * 10)
      + '|' + Math.ceil(G.double) + '|' + Math.ceil(G.freeze) + '|' + (G.feather > 0 ? 1 : 0);
    if (!force && key === lastPowersKey) return;
    lastPowersKey = key;
    $('pw-shield').classList.toggle('hidden', !G.shield);
    $('pw-magnet').classList.toggle('hidden', G.magnet <= 0);
    $('pw-jet').classList.toggle('hidden', G.jet <= 0);
    $('pw-double').classList.toggle('hidden', G.double <= 0);
    $('pw-freeze').classList.toggle('hidden', G.freeze <= 0);
    $('pw-feather').classList.toggle('hidden', G.feather <= 0);
    $('pw-magnet-t').textContent = Math.ceil(G.magnet);
    $('pw-jet-t').textContent = (Math.ceil(G.jet * 10) / 10).toFixed(1);
    $('pw-double-t').textContent = Math.ceil(G.double);
    $('pw-freeze-t').textContent = Math.ceil(G.freeze);
  }

  var lastHpKey = '';
  function syncPlayerHud(force) {
    var key = G.hp + '|' + G.maxHp;
    if (!force && key === lastHpKey) return;
    lastHpKey = key;
    var wrap = $('hp-wrap');
    var row = $('hud-hp');
    if (!wrap || !row) return;
    var pips = row.children;
    for (var i = 0; i < pips.length; i++) {
      pips[i].classList.toggle('lost', i >= G.hp);
    }
    wrap.classList.toggle('low', G.hp <= 1);
  }

  function pulsePlayerHp() {
    var wrap = $('hp-wrap');
    if (!wrap) return;
    wrap.classList.remove('hit');
    void wrap.offsetWidth;
    wrap.classList.add('hit');
  }

  /* ---------------- çizim ---------------- */

  /* ---------------- arka plan önbelleği ----------------
     Gökyüzü + küre her karede yeniden çizilmez; tema değişince
     bir kez hazırlanıp kopyalanır. */

  var bgCanvas = document.createElement('canvas');
  var bgCtx = bgCanvas.getContext('2d', { alpha: false });
  var bgKey = '';

  function drawSkyAndOrb(th) {
    var wpx = Math.max(1, Math.round(W * DPR));
    var hpx = Math.max(1, Math.round(H * DPR));
    var key = th.index + '|' + th.prog + '|' + wpx;

    if (bgCanvas.width !== wpx || bgCanvas.height !== hpx) {
      bgCanvas.width = wpx;
      bgCanvas.height = hpx;
      bgKey = '';
    }

    if (bgKey !== key) {
      bgKey = key;
      var b = bgCtx;
      b.setTransform(DPR, 0, 0, DPR, 0, 0);
      var sky = b.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, th.skyTop);
      sky.addColorStop(1, th.skyBottom);
      b.fillStyle = sky;
      b.fillRect(0, 0, W, H);
      drawNebula(b, th);
      drawSkyline(b, th);
      drawOrb(b, th);
    }

    ctx.drawImage(bgCanvas, 0, 0, W, H);
  }

  function draw() {
    var menuMode = G.mode === 'menu';
    var th = themeFor(menuMode ? Math.min(7000, G.best * 2) : G.meters);

    drawSkyAndOrb(th);

    /* atmosfer katmanları */
    drawAurora(th);
    if (th.star > 0.02) drawBgStars(th.star);
    drawMeteors(th);
    drawParallaxShards(th);

    /* perspektif ızgara */
    drawNeonGrid(th);

    /* neon sis */
    drawClouds(th);
    drawMotes(th);

    /* dünya */
    if (menuMode) {
      drawMenuScene(th);
    } else {
      ctx.save();
      if (G.shake > 0.25 && shakeOn) {
        ctx.translate(rand(-G.shake, G.shake), rand(-G.shake, G.shake));
      }
      ctx.translate(0, -G.camY);

      drawPlatforms(th);
      drawStarPickups();
      drawItems();
      drawTraps();
      drawBossShots();
      drawBossCore();
      drawBoss();
      drawBird(G.bird.x, G.bird.y, G.time);
      drawParticles();
      drawFloaters();

      ctx.restore();
    }

    /* dokunmatik yön göstergesi */
    if (G.mode === 'play' && inputMode === 'touch' && G.touch.active && G.touch.side !== 0) {
      drawTouchZone(G.touch.side, th);
    }

    if (G.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (G.flash * 0.55) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawTouchZone(side, th) {
    var half = W / 2;
    var x0 = side > 0 ? half : 0;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    /* basılan yarıyı hafifçe aydınlat */
    var g = ctx.createLinearGradient(side > 0 ? W : 0, 0, half, 0);
    g.addColorStop(0, 'rgba(0,229,255,0.12)');
    g.addColorStop(1, 'rgba(0,229,255,0.02)');
    ctx.fillStyle = g;
    ctx.fillRect(x0, 0, half, H);

    /* kenar çizgisi */
    ctx.strokeStyle = 'rgba(120,245,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(side > 0 ? W - 3 : 3, 0);
    ctx.lineTo(side > 0 ? W - 3 : 3, H);
    ctx.stroke();
    ctx.restore();

    /* yön oku */
    var ay = H * 0.5;
    var ax = side > 0 ? W - 34 : 34;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = 'rgba(210,252,255,0.95)';
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    glowOn('#00e5ff', 22);
    ctx.beginPath();
    ctx.moveTo(ax - 8 * side, ay - 12);
    ctx.lineTo(ax + 7 * side, ay);
    ctx.lineTo(ax - 8 * side, ay + 12);
    ctx.stroke();
    ctx.restore();
  }

  function drawMenuScene(th) {
    // menüde arka planda süzülen kuş ve birkaç platform
    var t = G.time;
    var by = H - 92 + Math.sin(t * 1.8) * 7;
    drawPlatform(W / 2 - 70, H - 58, 140, 'normal', th);
    drawBird(W / 2, by, t, 0.06);
  }

  function drawClouds(th) {
    for (var i = 0; i < G.clouds.length; i++) {
      var c = G.clouds[i];
      var sy = c.y - G.camY * 0.55;
      var span = 1500;
      sy = ((sy % span) + span) % span - 340;
      if (sy < -180 || sy > H + 180) continue;
      var alpha = c.a * th.cloud * 0.30;
      if (alpha <= 0.01) continue;
      var r = 92 * c.s;
      var g = ctx.createRadialGradient(c.x, sy, 0, c.x, sy, r);
      g.addColorStop(0, 'rgba(' + c.tint + ',' + alpha + ')');
      g.addColorStop(0.55, 'rgba(' + c.tint + ',' + (alpha * 0.45) + ')');
      g.addColorStop(1, 'rgba(' + c.tint + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(c.x - r, sy - r, r * 2, r * 2);
    }
  }

  function hash01(n) {
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function drawNebula(b, th) {
    var blobs = [
      { x: 70, y: 150, r: 210, c: th.nebula, a: 0.17 },
      { x: 362, y: 300, r: 240, c: th.aurora, a: 0.13 },
      { x: 110, y: 520, r: 250, c: th.nebula, a: 0.11 },
      { x: 300, y: 650, r: 220, c: th.glow, a: 0.09 }
    ];
    var n = qLevel >= 1 ? 2 : 4;
    b.save();
    for (var i = 0; i < n; i++) {
      var o = blobs[i];
      var g = b.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
      g.addColorStop(0, o.c);
      g.addColorStop(0.55, o.c);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      b.globalAlpha = o.a;
      b.fillStyle = g;
      b.fillRect(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
    }
    b.restore();
  }

  function drawSkyline(b, th) {
    var density = th.skyline;
    if (density <= 0.04) return;
    var horizon = H * 0.62;
    var layers = [
      { a: 0.52, hMin: 20, hMax: 74, wMin: 20, wMax: 44, seed: 1.7 },
      { a: 0.95, hMin: 32, hMax: 124, wMin: 13, wMax: 30, seed: 9.3 }
    ];

    b.save();
    for (var L = 0; L < 2; L++) {
      var ly = layers[L];
      b.globalAlpha = density * ly.a * 0.62;
      b.fillStyle = '#03020a';
      var x = -12;
      var i = 0;
      while (x < W + 12 && i < 40) {
        var w = ly.wMin + hash01(i * 7.13 + ly.seed) * (ly.wMax - ly.wMin);
        var h = ly.hMin + hash01(i * 3.71 + ly.seed * 2) * (ly.hMax - ly.hMin);
        b.fillRect(x, horizon - h, w, h);

        b.globalAlpha = density * ly.a * 0.18;
        b.fillStyle = th.glow;
        b.fillRect(x, horizon - h, w, 1);

        if (L === 1 && i % 2 === 0) {
          b.globalAlpha = density * 0.3;
          var wx = x + 3 + hash01(i * 5.17) * Math.max(2, w - 6);
          var wy = horizon - h + 8 + hash01(i * 8.41) * Math.max(2, h - 14);
          b.fillRect(wx, wy, 1.4, 1.4);
        }

        b.globalAlpha = density * ly.a * 0.62;
        b.fillStyle = '#03020a';
        x += w + 2 + hash01(i * 1.31 + ly.seed) * 4;
        i++;
      }
    }
    b.restore();
  }

  function drawAurora(th) {
    if (qLevel >= 2) return;
    var t = G.time;
    var bands = qLevel === 0 ? 3 : 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var band = 0; band < bands; band++) {
      var y0 = 46 + band * 64;
      var grad = ctx.createLinearGradient(0, y0 - 34, 0, y0 + 104);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.32, th.aurora);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 30 - band * 5;
      ctx.lineCap = 'round';
      ctx.globalAlpha = (0.055 + band * 0.012) * th.auroraA;
      ctx.beginPath();
      for (var x = -20; x <= W + 20; x += 24) {
        var y = y0
          + Math.sin(x * 0.011 + t * 0.42 + band * 1.9) * 24
          + Math.sin(x * 0.031 - t * 0.75 + band * 0.7) * 9;
        if (x <= -20) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMeteors(th) {
    if (qLevel >= 2 || th.meteor <= 0.05) return;
    var t = G.time;
    var periods = [9, 14, 21];
    var n = qLevel === 0 ? 3 : 2;
    ctx.save();
    for (var i = 0; i < n; i++) {
      var ph = (t + i * 4.7) % periods[i];
      if (ph > 0.85) continue;
      var k = ph / 0.85;
      var sx = 70 + i * 150 + k * 170;
      var sy = 40 + i * 90 + k * 110;
      var len = 96 * (1 - k * 0.45);
      var a = th.meteor * 0.55 * Math.sin(k * Math.PI);
      var grad = ctx.createLinearGradient(sx, sy, sx - len, sy - len * 0.55);
      grad.addColorStop(0, 'rgba(255,255,255,' + a + ')');
      grad.addColorStop(0.4, 'rgba(180,230,255,' + (a * 0.5) + ')');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - len, sy - len * 0.55);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParallaxShards(th) {
    if (qLevel >= 2) return;
    var n = qLevel === 0 ? 7 : 4;
    var span = H + 260;
    ctx.save();
    for (var i = 0; i < n; i++) {
      var sy = ((i * 211 - G.camY * 0.5) % span + span) % span - 130;
      var x = ((i * 143 + 37) % (W - 60)) + 30 + Math.sin(G.time * 0.4 + i) * 8;
      var rot = G.time * 0.15 + i * 1.3;
      var s = 5 + (i % 3) * 3.5;
      ctx.save();
      ctx.translate(x, sy);
      ctx.rotate(rot);
      ctx.globalAlpha = 0.12 + (i % 4) * 0.05;
      ctx.strokeStyle = th.platTop;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.7, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.7, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha *= 0.8;
      ctx.fillStyle = th.glow;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawMotes(th) {
    if (qLevel >= 2) return;
    var n = qLevel === 0 ? 20 : 10;
    var span = H + 80;
    ctx.save();
    ctx.fillStyle = th.glow;
    for (var i = 0; i < n; i++) {
      var sy = ((i * 97 - G.camY * 0.9 + G.time * (6 + i % 5)) % span + span) % span - 40;
      var x = ((i * 173 + 53) % W) + Math.sin(G.time * 0.7 + i) * 10;
      ctx.globalAlpha = 0.08 + (i % 3) * 0.04;
      var r = 0.9 + (i % 4) * 0.35;
      ctx.beginPath();
      ctx.arc(x, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawOrb(c, th) {
    var x = 322, y = 126;
    var style = th.orbStyle || 'ring';

    /* dış hale */
    var rg = c.createRadialGradient(x, y, 4, x, y, 160);
    rg.addColorStop(0, th.glow);
    rg.addColorStop(0.32, 'rgba(255,255,255,0.1)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    c.save();
    c.globalAlpha = 0.5;
    c.fillStyle = rg;
    c.fillRect(0, 0, W, 400);
    c.restore();

    c.save();
    if (GLOW > 0) {
      c.shadowColor = th.glow;
      c.shadowBlur = 34 * GLOW;
    }

    if (style === 'planet') {
      var pg = c.createRadialGradient(x - 11, y - 13, 3, x, y, 38);
      pg.addColorStop(0, '#ffffff');
      pg.addColorStop(0.3, th.glow);
      pg.addColorStop(0.72, 'rgba(10,6,24,0.9)');
      pg.addColorStop(1, '#05030c');
      c.fillStyle = pg;
      c.beginPath();
      c.arc(x, y, 35, 0, Math.PI * 2);
      c.fill();

      c.save();
      c.translate(x, y);
      c.rotate(-0.42);
      c.globalAlpha = 0.72;
      c.strokeStyle = th.glow;
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(0, 0, 55, 15, 0, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 0.22;
      c.lineWidth = 5;
      c.beginPath();
      c.ellipse(0, 0, 55, 15, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    } else if (style === 'eclipse') {
      c.fillStyle = '#030208';
      c.beginPath();
      c.arc(x, y, 28, 0, Math.PI * 2);
      c.fill();

      c.strokeStyle = th.glow;
      c.lineWidth = 2;
      c.globalAlpha = 0.92;
      c.beginPath();
      c.arc(x, y, 30, 0, Math.PI * 2);
      c.stroke();

      c.globalAlpha = 0.55;
      c.lineWidth = 1.3;
      for (var i = 0; i < 18; i++) {
        var a = i * Math.PI / 9 + G.time * 0.05;
        var r0 = 32 + (i % 3) * 2;
        var r1 = r0 + 5 + (i % 4) * 3;
        c.beginPath();
        c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
        c.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
        c.stroke();
      }
    } else if (style === 'eye') {
      c.strokeStyle = th.glow;
      c.lineWidth = 2;
      c.globalAlpha = 0.85;
      c.beginPath();
      c.ellipse(x, y, 44, 24, 0, 0, Math.PI * 2);
      c.stroke();

      c.globalAlpha = 0.16;
      c.fillStyle = th.glow;
      c.fill();

      c.globalAlpha = 0.9;
      c.fillStyle = '#05030c';
      c.beginPath();
      c.ellipse(x, y, 20, 15, 0, 0, Math.PI * 2);
      c.fill();

      c.fillStyle = th.glow;
      c.beginPath();
      c.ellipse(x, y, 4.5, 12, 0, 0, Math.PI * 2);
      c.fill();
    } else {
      c.strokeStyle = th.glow;
      c.lineWidth = 2;
      c.globalAlpha = 0.9;
      c.beginPath();
      c.arc(x, y, 30, 0, Math.PI * 2);
      c.stroke();

      c.globalAlpha = 0.14;
      c.fillStyle = th.glow;
      c.fill();

      c.globalAlpha = 0.6;
      c.lineWidth = 1.2;
      c.beginPath();
      c.ellipse(x, y, 46, 12, -0.42, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();

    c.save();
    c.globalAlpha = 0.85;
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(x - 5, y - 7, 6.5, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  function drawNeonGrid(th) {
    var a = th.grid;
    if (a < 0.04) return;
    var horizon = H * 0.62;
    var phase = ((-G.camY * 0.45) % 76) / 76;

    ctx.save();
    ctx.strokeStyle = th.glow;
    ctx.lineWidth = 1;

    /* ufka yaklaşan dikey çizgiler */
    var vStep = Q.grid < 0.7 ? 2 : 1;
    ctx.globalAlpha = 0.30 * a;
    for (var i = -9; i <= 9; i += vStep) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + i * 15, horizon);
      ctx.lineTo(W / 2 + i * 155, H + 40);
      ctx.stroke();
    }

    /* yatay çizgiler */
    var hStep = Q.grid < 0.7 ? 2 : 1;
    for (var k = 0; k < 12; k += hStep) {
      var t = (k + phase) / 12;
      var y = horizon + Math.pow(t, 2.2) * (H - horizon + 50);
      ctx.globalAlpha = 0.34 * a * (1 - t * 0.8);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    /* ufuk parlaması */
    ctx.globalAlpha = 0.75 * a;
    glowOn(th.glow, 20);
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(W, horizon);
    ctx.stroke();
    ctx.restore();
  }

  function drawBgStars(alpha) {
    var n = Math.max(16, Math.round(80 * Q.stars));
    ctx.save();
    ctx.globalAlpha = alpha;
    for (var i = 0; i < n; i++) {
      var x = (i * 137.5) % W;
      var y = ((i * 251.7 - G.camY * 0.16) % H + H) % H;
      var tw = 0.45 + 0.55 * Math.abs(Math.sin(G.time * 1.3 + i));
      var big = (i % 11 === 0);
      var sz = big ? 1.9 : 1.1;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.55 * tw) + ')';
      ctx.beginPath();
      ctx.arc(x, y, sz, 0, Math.PI * 2);
      ctx.fill();

      if (big) {
        ctx.globalAlpha = alpha * 0.28 * tw;
        ctx.strokeStyle = 'rgba(190,245,255,0.9)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 5, y);
        ctx.lineTo(x + 5, y);
        ctx.moveTo(x, y - 5);
        ctx.lineTo(x, y + 5);
        ctx.stroke();
        ctx.globalAlpha = alpha;
      }
    }
    ctx.restore();
  }

  function drawPlatforms(th) {
    for (var i = 0; i < G.platforms.length; i++) {
      var pl = G.platforms[i];
      var sy = pl.y - G.camY;
      if (sy < -80 || sy > H + 80) continue;

      ctx.save();
      ctx.globalAlpha = pl.dead ? Math.max(0, pl.fade) : 1;
      if (pl.type === 'cloud') drawCloudPlatform(pl);
      else drawPlatform(pl.x, pl.y, pl.w, pl.type, th);

      if (pl.spring) drawSpring(pl.x + pl.w / 2, pl.y);
      ctx.restore();
    }
  }

  function drawPlatform(x, y, w, type, th) {
    th = th || themeFor(G.meters);
    var accent = (type === 'break') ? '#ffb020' : th.platTop;

    /* zemine düşen yumuşak gölge */
    ctx.save();
    ctx.globalAlpha = 0.38;
    ctx.fillStyle = '#000000';
    rr(x + 6, y + 12, Math.max(4, w - 12), 5, 3);
    ctx.fill();
    ctx.restore();

    ctx.save();
    glowOn(accent, 14);
    ctx.fillStyle = 'rgba(7,10,20,0.92)';
    rr(x, y, w, 13, 6);
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.95;
    rr(x + 0.8, y + 0.8, w - 1.6, 11.4, 5.4);
    ctx.stroke();
    ctx.restore();

    /* alt enerji çizgisi + uç noktaları */
    var pulse = 0.7 + 0.3 * Math.sin(G.time * 2.1 + x * 0.055);
    ctx.save();
    ctx.globalAlpha = 0.42 * pulse;
    glowOn(accent, 10);
    ctx.fillStyle = accent;
    rr(x + 5, y + 11, Math.max(2, w - 10), 3, 1.5);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.fillRect(x + 1.5, y + 1.5, 2, 2);
    ctx.fillRect(x + w - 3.5, y + 1.5, 2, 2);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.8 * pulse;
    ctx.fillStyle = accent;
    rr(x + 8, y + 3, Math.max(2, w - 16), 2, 1);
    ctx.fill();
    ctx.restore();

    if (type === 'moving') {
      ctx.save();
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.9;
      ctx.font = 'bold 10px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('◄ ►', x + w / 2, y + 7.6);
      ctx.restore();
    } else if (type === 'break') {
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      var cx = x + w * 0.38;
      ctx.beginPath();
      ctx.moveTo(cx, y + 2);
      ctx.lineTo(cx + 5, y + 6.5);
      ctx.lineTo(cx - 1, y + 11);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawCloudPlatform(pl) {
    ctx.save();
    glowOn('#66f6ff', 18);
    ctx.strokeStyle = 'rgba(130,245,255,0.85)';
    ctx.lineWidth = 1.6;
    ctx.fillStyle = 'rgba(80,225,255,0.10)';
    rr(pl.x, pl.y + 1, pl.w, 11, 5.5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#bffcff';
    rr(pl.x + 9, pl.y + 4, pl.w - 18, 2, 1);
    ctx.fill();
    ctx.restore();
  }

  function drawSpring(cx, py) {
    ctx.save();
    glowOn('#39ff88', 14);
    ctx.strokeStyle = '#7bff9a';
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    for (var i = 0; i < 2; i++) {
      var yy = py - 5 - i * 6;
      ctx.beginPath();
      ctx.moveTo(cx - 7, yy);
      ctx.lineTo(cx, yy - 6);
      ctx.lineTo(cx + 7, yy);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(57,255,136,0.9)';
    ctx.fillRect(cx - 9, py - 2, 18, 2);
  }

  function drawStarPickups() {
    for (var i = 0; i < G.stars.length; i++) {
      var st = G.stars[i];
      if (st.got) continue;
      var sy = st.y - G.camY;
      if (sy < -60 || sy > H + 60) continue;
      var yy = st.y + Math.sin(st.phase) * 4;
      ctx.save();
      ctx.translate(st.x, yy);
      ctx.rotate(Math.sin(st.phase * 0.6) * 0.25);
      glowOn('rgba(0,229,255,0.95)', 20);
      ctx.fillStyle = '#bffcff';
      starPath(0, 0, st.r + 2, 4, 0.3);
      ctx.fill();
      ctx.fillStyle = '#00e5ff';
      starPath(0, 0, st.r * 0.58, 4, 0.32);
      ctx.fill();
      glowOff();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ---------------- eşyalar: kalkan / mıknatıs / jetpack / kristal / 2× / donma / tüy ---------------- */

  var ITEM_RGB = {
    shield: '0,229,255',
    magnet: '255,45,149',
    jet: '255,176,32',
    crystal: '169,107,255',
    double: '255,209,102',
    freeze: '159,232,255',
    feather: '232,251,255'
  };

  function drawItems() {
    for (var i = 0; i < G.items.length; i++) {
      var it = G.items[i];
      if (it.got) continue;
      var sy = it.y - G.camY;
      if (sy < -70 || sy > H + 70) continue;

      var rgb = ITEM_RGB[it.type] || '255,255,255';
      var bob = Math.sin(it.phase) * 4;

      ctx.save();
      ctx.translate(it.x, it.y + bob);
      ctx.scale(1.12, 1.12);

      /* hale */
      var halo = ctx.createRadialGradient(0, 0, 2, 0, 0, 28);
      halo.addColorStop(0, 'rgba(' + rgb + ',0.40)');
      halo.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.fill();

      glowOn('rgba(' + rgb + ',0.95)', 16);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgb(' + rgb + ')';
      ctx.fillStyle = 'rgba(' + rgb + ',0.18)';

      if (it.type === 'shield') drawShieldIcon();
      else if (it.type === 'magnet') drawMagnetIcon();
      else if (it.type === 'jet') drawJetIcon();
      else if (it.type === 'crystal') drawCrystalIcon();
      else if (it.type === 'double') drawDoubleIcon();
      else if (it.type === 'freeze') drawFreezeIcon();
      else drawFeatherIcon();

      ctx.restore();
    }
  }

  function drawShieldIcon() {
    ctx.beginPath();
    for (var k = 0; k < 6; k++) {
      var a = -Math.PI / 2 + k * Math.PI / 3;
      var px = Math.cos(a) * 11;
      var py = Math.sin(a) * 12;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    glowOff();
    ctx.strokeStyle = 'rgba(235,255,255,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4.5, 0);
    ctx.lineTo(-1, 4);
    ctx.lineTo(5, -4);
    ctx.stroke();
  }

  function drawMagnetIcon() {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, -1, 8, Math.PI, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-8, -1);
    ctx.lineTo(-8, 7);
    ctx.moveTo(8, -1);
    ctx.lineTo(8, 7);
    ctx.stroke();

    glowOn('rgba(125,249,255,0.95)', 16);
    ctx.strokeStyle = '#7df9ff';
    ctx.beginPath();
    ctx.moveTo(-8, 5);
    ctx.lineTo(-8, 9);
    ctx.moveTo(8, 5);
    ctx.lineTo(8, 9);
    ctx.stroke();
  }

  function drawJetIcon() {
    ctx.fillStyle = 'rgba(255,176,32,0.9)';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.quadraticCurveTo(7.5, -3, 6, 8);
    ctx.lineTo(-6, 8);
    ctx.quadraticCurveTo(-7.5, -3, 0, -12);
    ctx.closePath();
    ctx.fill();

    /* kanatlar */
    ctx.fillStyle = 'rgba(255,120,60,0.95)';
    ctx.beginPath();
    ctx.moveTo(-5, 5);
    ctx.lineTo(-10, 11);
    ctx.lineTo(-4, 9);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(5, 5);
    ctx.lineTo(10, 11);
    ctx.lineTo(4, 9);
    ctx.closePath();
    ctx.fill();

    /* pencere */
    ctx.save();
    glowOff();
    ctx.fillStyle = '#0a0d16';
    ctx.beginPath();
    ctx.arc(0, -1.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* alev */
    var fl = 0.6 + 0.4 * Math.sin(G.time * 18);
    ctx.save();
    glowOff();
    ctx.fillStyle = 'rgba(255,230,140,' + (0.65 + 0.3 * fl) + ')';
    ctx.beginPath();
    ctx.moveTo(-3.5, 8);
    ctx.lineTo(0, 8 + 9 * fl);
    ctx.lineTo(3.5, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawCrystalIcon() {
    /* kristal */
    var cg = ctx.createLinearGradient(0, -12, 0, 11);
    cg.addColorStop(0, 'rgba(244,234,255,0.95)');
    cg.addColorStop(0.55, 'rgba(184,137,255,0.8)');
    cg.addColorStop(1, 'rgba(126,64,224,0.62)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(9, -2);
    ctx.lineTo(4.5, 11);
    ctx.lineTo(-4.5, 11);
    ctx.lineTo(-9, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    /* iç yüzeyler */
    glowOff();
    ctx.strokeStyle = 'rgba(238,228,255,0.9)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(0, 11);
    ctx.moveTo(-9, -2);
    ctx.lineTo(9, -2);
    ctx.stroke();

    /* parıltı */
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(-3, -5, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDoubleIcon() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 16px "Trebuchet MS", sans-serif';
    ctx.fillStyle = 'rgba(255,240,190,0.98)';
    ctx.fillText('2×', 0, 1);
  }

  function drawFreezeIcon() {
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(224,250,255,0.95)';
    for (var k = 0; k < 6; k++) {
      ctx.save();
      ctx.rotate(k * Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -11);
      ctx.moveTo(0, -6);
      ctx.lineTo(-3.4, -9.2);
      ctx.moveTo(0, -6);
      ctx.lineTo(3.4, -9.2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#eafcff';
    ctx.beginPath();
    ctx.arc(0, 0, 1.9, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFeatherIcon() {
    ctx.save();
    ctx.rotate(-0.36);

    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.quadraticCurveTo(9.5, -4, 3.2, 9);
    ctx.quadraticCurveTo(-1.8, 10.5, -3.4, 6);
    ctx.quadraticCurveTo(-8.5, -4, 0, -13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    glowOff();
    ctx.strokeStyle = 'rgba(214,238,255,0.95)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(0.6, 12.5);
    for (var k = -2; k <= 2; k++) {
      var yy = -5.5 + k * 3.4;
      ctx.moveTo(0.4, yy);
      ctx.lineTo(5.2 - k * 0.5, yy + 2.6);
      ctx.moveTo(0.4, yy);
      ctx.lineTo(-3.8 - k * 0.4, yy + 2.6);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawTraps() {
    var frozen = G.freeze > 0;
    for (var i = 0; i < G.traps.length; i++) {
      var tr = G.traps[i];
      var sy = tr.y - G.camY;
      if (sy < -60 || sy > H + 60) continue;
      ctx.save();
      ctx.translate(tr.x, tr.y);
      ctx.rotate(tr.angle);

      // neon testere dişleri (donmuşken buz mavisi)
      glowOn(frozen ? '#9fe8ff' : '#ff2d6e', 12);
      ctx.fillStyle = frozen ? '#bfeeff' : '#ff5c8a';
      for (var k = 0; k < 10; k++) {
        ctx.save();
        ctx.rotate((Math.PI * 2 / 10) * k);
        ctx.beginPath();
        ctx.moveTo(tr.r - 3, -4.5);
        ctx.lineTo(tr.r + 5, 0);
        ctx.lineTo(tr.r - 3, 4.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      glowOff();

      var sg = ctx.createRadialGradient(-3, -3, 2, 0, 0, tr.r);
      sg.addColorStop(0, '#2b3244');
      sg.addColorStop(1, '#0a0d16');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(0, 0, tr.r - 1, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = frozen ? 'rgba(180,236,255,0.9)' : 'rgba(255,90,140,0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, tr.r - 4, 0, Math.PI * 2);
      ctx.stroke();

      /* buz halkası */
      if (frozen) {
        ctx.save();
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = 'rgba(200,245,255,0.7)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, tr.r + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = frozen ? '#eafcff' : '#7df9ff';
      glowOn(frozen ? '#d8f7ff' : '#00e5ff', 10);
      ctx.beginPath();
      ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // tehlike halesi (nabız)
      var pulse = 0.12 + 0.10 * Math.sin(G.time * 5 + tr.phase);
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = frozen ? '#9fe8ff' : '#ff2d6e';
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, tr.r + 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < G.particles.length; i++) {
      var pt = G.particles[i];
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFloaters() {
    for (var i = 0; i < G.floaters.length; i++) {
      var f = G.floaters[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillStyle = f.color;
      ctx.font = '800 16px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      glowOn(f.color, 14);
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }

  /* ---------------- boss çizimi ---------------- */

  function drawBossShots() {
    for (var i = 0; i < G.bossShots.length; i++) {
      var s = G.bossShots[i];
      var col = s.color || '#ff2d6e';
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);

      var halo = ctx.createRadialGradient(0, 0, 1, 0, 0, 22);
      halo.addColorStop(0, rgba(col, 0.5));
      halo.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();

      glowOn(s.glow || col, 12);
      ctx.fillStyle = col;
      ctx.beginPath();
      for (var k = 0; k < 8; k++) {
        var a = k * Math.PI / 4;
        var rr2 = (k % 2) ? 3.2 : 8.4;
        var px = Math.cos(a) * rr2;
        var py = Math.sin(a) * rr2;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1;
      ctx.stroke();
      glowOff();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBossCore() {
    var c = G.bossCore;
    if (!c) return;
    if (c.y - G.camY < -70 || c.y - G.camY > H + 70) return;
    var b = G.boss;
    var ty = b && b.type ? b.type : BOSS_TYPES[0];

    /* boss'a bağlı enerji teli */
    if (b) {
      var bs = G.camY + b.sy;
      ctx.save();
      ctx.strokeStyle = rgba(ty.c1, 0.22);
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 8]);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(b.x, bs + 20);
      ctx.stroke();
      ctx.restore();
    }

    var bob = Math.sin(c.t * 3) * 2.5;
    ctx.save();
    ctx.translate(c.x, c.y + bob);

    var halo = ctx.createRadialGradient(0, 0, 2, 0, 0, 46);
    halo.addColorStop(0, 'rgba(255,209,102,0.42)');
    halo.addColorStop(0.55, 'rgba(255,45,110,0.16)');
    halo.addColorStop(1, 'rgba(255,45,110,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 46, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.rotate(c.t * 1.7);
    glowOn('#ffd166', 18);
    ctx.strokeStyle = 'rgba(255,230,163,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(14, 0);
    ctx.lineTo(0, 20);
    ctx.lineTo(-14, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, -25);
    ctx.lineTo(17, 0);
    ctx.lineTo(0, 25);
    ctx.lineTo(-17, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.rotate(-c.t * 1.1);
    var dg = ctx.createLinearGradient(0, -13, 0, 13);
    dg.addColorStop(0, '#ffffff');
    dg.addColorStop(0.45, '#ffd166');
    dg.addColorStop(1, '#ff2d6e');
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(9, 0);
    ctx.lineTo(0, 13);
    ctx.lineTo(-9, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    glowOn('#ffffff', 14);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    glowOff();
    ctx.restore();

    ctx.save();
    ctx.font = '800 8px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,230,163,0.9)';
    glowOn('#ffd166', 10);
    ctx.fillText('ÇEKİRDEK', c.x, c.y + 38);
    ctx.restore();
  }

  function drawBoss() {
    var b = G.boss;
    if (!b) return;
    var ty = b.type || BOSS_TYPES[0];
    var c1 = ty.c1, c2 = ty.c2, form = ty.form;
    var sy = G.camY + b.sy;
    var dying = b.state === 'dying';
    var alpha = dying ? Math.max(0, 1 - b.deathT / 1.4) : 1;
    if (dying && Math.sin(b.deathT * 38) > 0.3) alpha *= 0.35;
    if (alpha <= 0.02) return;

    var p = G.bird;
    var eyeA = Math.atan2(p.y - sy, p.x - b.x);
    var chargeK = b.charge > 0 ? 1 - b.charge / 0.7 : 0;
    var now = G.time;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(b.x, sy);

    /* hale */
    var halo = ctx.createRadialGradient(0, 0, 18, 0, 0, 118);
    halo.addColorStop(0, rgba(c1, 0.3));
    halo.addColorStop(0.55, rgba(c1, 0.1));
    halo.addColorStop(1, rgba(c1, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 118, 0, Math.PI * 2);
    ctx.fill();

    /* dönen dış halka + dişler */
    ctx.save();
    ctx.rotate(b.angle);
    glowOn(c1, 16);
    ctx.strokeStyle = rgba(c1, 0.8);
    ctx.lineWidth = 2;
    ctx.setLineDash([9, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = rgba(c1, 0.9);
    ctx.lineWidth = 3;
    for (var i = 0; i < 10; i++) {
      var a = i * Math.PI / 5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 54, Math.sin(a) * 54);
      ctx.lineTo(Math.cos(a) * 63, Math.sin(a) * 63);
      ctx.stroke();
    }
    ctx.restore();

    /* forma özel arka katman */
    if (form === 'crown') {
      ctx.save();
      glowOn(c1, 10);
      ctx.fillStyle = rgba(c1, 0.22);
      ctx.strokeStyle = rgba(c1, 0.75);
      ctx.lineWidth = 1.4;
      for (var i2 = 0; i2 < 9; i2++) {
        var a2 = i2 * Math.PI * 2 / 9 + 0.18;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a2 - 0.13) * 38, Math.sin(a2 - 0.13) * 38);
        ctx.lineTo(Math.cos(a2) * 57, Math.sin(a2) * 57);
        ctx.lineTo(Math.cos(a2 + 0.13) * 38, Math.sin(a2 + 0.13) * 38);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    } else if (form === 'ring') {
      ctx.save();
      ctx.rotate(-b.angle * 1.35);
      glowOn(c2, 10);
      ctx.strokeStyle = rgba(c2, 0.55);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.6;
      ctx.setLineDash([4, 7]);
      ctx.beginPath();
      ctx.arc(0, 0, 47, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (form === 'crystal') {
      ctx.save();
      ctx.rotate(-b.angle * 0.8);
      glowOn(c2, 10);
      ctx.fillStyle = rgba(c2, 0.75);
      for (var k = 0; k < 6; k++) {
        var ka = k * Math.PI / 3;
        var kx = Math.cos(ka) * 48, ky = Math.sin(ka) * 48;
        ctx.beginPath();
        ctx.moveTo(kx, ky - 5);
        ctx.lineTo(kx + 4, ky);
        ctx.lineTo(kx, ky + 5);
        ctx.lineTo(kx - 4, ky);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    } else if (form === 'void') {
      ctx.save();
      ctx.rotate(b.angle * 0.5);
      glowOn(c1, 14);
      ctx.strokeStyle = rgba(c1, 0.6);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 58, 17, 0.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.4;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(0, 0, 58, 17, 0.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    /* alt dokunaçlar */
    if (form !== 'crystal') {
      ctx.save();
      ctx.strokeStyle = rgba(c2, 0.6);
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      for (var j = -1; j <= 1; j++) {
        ctx.beginPath();
        ctx.moveTo(j * 15, 28);
        ctx.quadraticCurveTo(j * 28, 44, j * 22 + Math.sin(now * 3 + j) * 6, 58);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* yan podlar + alev */
    if (form === 'eye' || form === 'ring' || form === 'crown') {
      for (var s = -1; s <= 1; s += 2) {
        ctx.save();
        ctx.translate(s * 44, 9);
        glowOn(c1, 14);
        ctx.fillStyle = mix('#08020a', c1, 0.18);
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = rgba(c1, 0.85);
        ctx.lineWidth = 1.4;
        ctx.stroke();
        glowOff();
        var fl = 0.6 + 0.4 * Math.sin(now * 16 + s);
        ctx.fillStyle = rgba(c2, 0.85);
        ctx.beginPath();
        ctx.moveTo(-3, 10);
        ctx.lineTo(0, 10 + 12 * fl);
        ctx.lineTo(3, 10);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    /* gövde */
    if (form === 'crystal') {
      var cg = ctx.createLinearGradient(0, -46, 0, 46);
      cg.addColorStop(0, mix('#ffffff', c1, 0.35));
      cg.addColorStop(0.42, mix('#08020a', c1, 0.5));
      cg.addColorStop(1, '#050208');
      ctx.save();
      glowOn(c1, 18);
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(0, -46);
      ctx.lineTo(34, 0);
      ctx.lineTo(0, 46);
      ctx.lineTo(-34, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba(c1, 0.95);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = rgba(c2, 0.35);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -46); ctx.lineTo(0, 46);
      ctx.moveTo(-34, 0); ctx.lineTo(34, 0);
      ctx.moveTo(0, 0); ctx.lineTo(17, -23);
      ctx.moveTo(0, 0); ctx.lineTo(-17, -23);
      ctx.moveTo(0, 0); ctx.lineTo(17, 23);
      ctx.moveTo(0, 0); ctx.lineTo(-17, 23);
      ctx.stroke();
      ctx.restore();
    } else if (form === 'void') {
      var vg = ctx.createRadialGradient(0, 0, 2, 0, 0, 44);
      vg.addColorStop(0, '#000000');
      vg.addColorStop(0.62, mix('#020108', c1, 0.1));
      vg.addColorStop(1, rgba(c1, 0.35));
      ctx.fillStyle = vg;
      ctx.beginPath();
      ctx.ellipse(0, 0, 41, 39, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(c1, 0.85);
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      var bw2 = form === 'ring' ? 35 : 40;
      var bh2 = form === 'ring' ? 32 : 36;
      var bg = ctx.createRadialGradient(-9, -13, 4, 0, 0, 44);
      bg.addColorStop(0, mix('#08020a', c1, 0.34));
      bg.addColorStop(0.55, mix('#0a0309', c1, 0.14));
      bg.addColorStop(1, '#050208');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.ellipse(0, 0, bw2, bh2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(c1, 0.9);
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.strokeStyle = rgba(c2, 0.32);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, form === 'ring' ? 26 : 30, -2.5, -0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, form === 'ring' ? 26 : 30, 0.6, 2.2);
      ctx.stroke();
      ctx.restore();
    }

    /* yüz / çekirdek */
    if (form === 'crystal') {
      var gemR = 12 + chargeK * 5;
      var gg = ctx.createRadialGradient(0, 0, 1, 0, 0, gemR + 16);
      gg.addColorStop(0, '#ffffff');
      gg.addColorStop(0.35, chargeK > 0 ? '#ffffff' : c1);
      gg.addColorStop(1, rgba(c1, 0));
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(0, 0, gemR + 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.rotate(b.angle * 1.6);
      glowOn(chargeK > 0 ? '#ffffff' : c1, 16);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -gemR);
      ctx.lineTo(gemR * 0.62, 0);
      ctx.lineTo(0, gemR);
      ctx.lineTo(-gemR * 0.62, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba(c2, 0.9);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = rgba(c2, 0.35);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, gemR + 6, 0, Math.PI * 2);
      ctx.stroke();
    } else if (form === 'void') {
      var vr = 7 + chargeK * 3;
      var vgg = ctx.createRadialGradient(0, 0, 1, 0, 0, vr + 22);
      vgg.addColorStop(0, chargeK > 0 ? '#ffffff' : rgba(c1, 0.95));
      vgg.addColorStop(0.45, rgba(c1, 0.35));
      vgg.addColorStop(1, rgba(c1, 0));
      ctx.fillStyle = vgg;
      ctx.beginPath();
      ctx.arc(0, 0, vr + 20, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(0, 0, vr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(c1, 0.95);
      ctx.lineWidth = 2;
      ctx.stroke();

      glowOn(chargeK > 0 ? '#ffffff' : c2, 14);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 2.6 + chargeK * 1.8, 0, Math.PI * 2);
      ctx.fill();
      glowOff();

      ctx.save();
      ctx.rotate(-b.angle * 2);
      ctx.strokeStyle = rgba(c2, 0.5);
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, vr + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else {
      var eyeR = (form === 'ring' ? 10 : 12) + chargeK * 4;
      var eg = ctx.createRadialGradient(0, 0, 1, 0, 0, eyeR + 14);
      eg.addColorStop(0, '#ffffff');
      eg.addColorStop(0.32, chargeK > 0 ? '#ffffff' : c1);
      eg.addColorStop(1, rgba(c1, 0));
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.arc(0, 0, eyeR + 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#12030a';
      ctx.beginPath();
      ctx.ellipse(0, 0, form === 'ring' ? 10 : 12, form === 'ring' ? 12 : 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(c2, 0.6);
      ctx.lineWidth = 1;
      ctx.stroke();

      var ix = Math.cos(eyeA) * 3;
      var iy = Math.sin(eyeA) * 3;
      ctx.fillStyle = chargeK > 0 ? '#ffffff' : c1;
      glowOn(chargeK > 0 ? '#ffffff' : c1, 12);
      ctx.beginPath();
      ctx.ellipse(ix, iy, 6.5, 8.5, 0, 0, Math.PI * 2);
      ctx.fill();
      glowOff();

      ctx.fillStyle = '#08030a';
      ctx.beginPath();
      ctx.ellipse(ix, iy, 2.2, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(ix - 2, iy - 3, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    /* hasar parlaması */
    if (b.flash > 0) {
      ctx.globalAlpha = alpha * b.flash * 0.55;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      if (form === 'crystal') {
        ctx.moveTo(0, -40);
        ctx.lineTo(30, 0);
        ctx.lineTo(0, 40);
        ctx.lineTo(-30, 0);
      } else {
        ctx.arc(0, 0, form === 'void' ? 44 : 40, 0, Math.PI * 2);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------------- kuş ---------------- */

  function drawBirdEmblem(kind, color) {
    if (!kind) return;
    ctx.save();
    ctx.translate(-4.5, 2.2);
    ctx.fillStyle = rgba(color, 0.92);
    ctx.strokeStyle = rgba(color, 0.92);
    glowOn(color, 8);
    if (kind === 'ring') {
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 3.3, 0, Math.PI * 2);
      ctx.stroke();
    } else if (kind === 'diamond') {
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.lineTo(3.6, 0);
      ctx.lineTo(0, 4);
      ctx.lineTo(-3.6, 0);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'star') {
      ctx.beginPath();
      for (var i = 0; i < 8; i++) {
        var a = -Math.PI / 2 + i * Math.PI / 4;
        var rad = (i % 2) ? 1.7 : 4.2;
        var ex = Math.cos(a) * rad, ey = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(ex, ey); else ctx.lineTo(ex, ey);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(1.4, -5);
      ctx.lineTo(-3.2, 0.6);
      ctx.lineTo(-0.4, 0.6);
      ctx.lineTo(-1.6, 5);
      ctx.lineTo(3.4, -0.8);
      ctx.lineTo(0.4, -0.8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBird(x, y, t, tiltOverride, skinOverride) {
    var p = G.bird;
    var sk = skinOverride || equippedSkin;
    var tilt = (tiltOverride !== undefined) ? tiltOverride : p.tilt;
    var squash = p.squash || 0;
    var rotorSpeed = G.mode === 'play' ? 22 : 9;
    var rotor = Math.cos(t * rotorSpeed);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.scale(p.face * (1 + squash * 0.45), 1 - squash * 0.55);

    /* arka itici parıltısı */
    var glow = ctx.createRadialGradient(-14, 10, 0, -14, 10, 30);
    glow.addColorStop(0, rgba(sk.thruster, 0.55));
    glow.addColorStop(1, rgba(sk.thruster, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(-50, -22, 70, 64);

    /* rotor */
    var rw = 13 + Math.abs(rotor) * 16;
    ctx.save();
    glowOn(sk.accent, 16);
    ctx.strokeStyle = rgba(sk.accent, 0.92);
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-rw, -25);
    ctx.lineTo(rw, -25);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = mix(sk.accent, '#ffffff', 0.55);
    ctx.beginPath();
    ctx.arc(0, -25, 2.6, 0, Math.PI * 2);
    ctx.fill();

    /* direk */
    ctx.strokeStyle = sk.metal;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(0, -24);
    ctx.stroke();

    /* kuyruk */
    ctx.beginPath();
    ctx.moveTo(-13, -3);
    ctx.lineTo(-31, -8);
    ctx.lineTo(-30, -2);
    ctx.lineTo(-13, 5);
    ctx.closePath();
    ctx.fillStyle = mix(sk.body[0], '#05070c', 0.55);
    ctx.fill();
    ctx.strokeStyle = rgba(sk.accent, 0.35);
    ctx.lineWidth = 1;
    ctx.stroke();

    /* kuyruk ışığı */
    ctx.save();
    glowOn(sk.light, 10);
    ctx.fillStyle = sk.light;
    ctx.beginPath();
    ctx.arc(-30, -5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* gövde */
    var bg = ctx.createLinearGradient(0, -13, 0, 14);
    bg.addColorStop(0, sk.body[0]);
    bg.addColorStop(0.5, sk.body[1]);
    bg.addColorStop(1, sk.body[2]);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 13.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(sk.accent, 0.55);
    ctx.lineWidth = 1.3;
    ctx.stroke();

    /* neon şerit */
    ctx.save();
    glowOn(sk.accent, 10);
    ctx.strokeStyle = rgba(sk.accent, 0.95);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-12, 6.5);
    ctx.lineTo(11, 7);
    ctx.stroke();
    ctx.restore();

    /* gövde amblemi */
    drawBirdEmblem(sk.emblem, sk.light);

    /* kokpit */
    var cg = ctx.createLinearGradient(2, -10, 14, 6);
    cg.addColorStop(0, sk.glass[0]);
    cg.addColorStop(1, sk.glass[1]);
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.ellipse(7, -2, 9.5, 7.4, 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(210,250,255,0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();

    /* cam parlaması */
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(4.5, -5.2, 3.4, 2, -0.4, 0, Math.PI * 2);
    ctx.fill();

    /* yan itici */
    ctx.save();
    glowOn(sk.thruster, 14);
    ctx.fillStyle = rgba(sk.thruster, 0.85);
    ctx.beginPath();
    ctx.ellipse(-14, 8, 5, 3, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* iniş takımları */
    ctx.strokeStyle = sk.metal;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, 12);
    ctx.lineTo(-8, 17);
    ctx.moveTo(8, 12);
    ctx.lineTo(8, 17);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-15, 17.5);
    ctx.lineTo(15, 17.5);
    ctx.stroke();

    /* yanıp sönen lamba */
    var blink = 0.5 + 0.5 * Math.sin(t * 6);
    ctx.save();
    glowOn(sk.light, 12);
    ctx.fillStyle = rgba(sk.light, 0.35 + blink * 0.65);
    ctx.beginPath();
    ctx.arc(15, 4, 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* kalkan halkası */
    if (G.shield) {
      ctx.save();
      ctx.rotate(-t * 1.1);
      ctx.strokeStyle = 'rgba(120,245,255,0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      glowOn('#00e5ff', 16);
      ctx.beginPath();
      ctx.arc(0, 0, 29, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  /* kozmetik kartı / sandık ödülü için küçük önizleme */
  function renderPreview(cv, item) {
    var c2 = cv.getContext('2d');
    var w = cv.width, h = cv.height;
    c2.setTransform(1, 0, 0, 1, 0, 0);
    c2.clearRect(0, 0, w, h);

    var old = ctx;
    ctx = c2;

    if (item.kind === 'skin') {
      var savedFace = G.bird.face, savedTilt = G.bird.tilt, savedSquash = G.bird.squash;
      var savedShield = G.shield, savedMode = G.mode;
      G.bird.face = 1;
      G.bird.tilt = 0;
      G.bird.squash = 0;
      G.shield = false;
      G.mode = 'menu';

      var s = w / 84;
      ctx.save();
      ctx.translate(w / 2, h / 2 + 6 * s);
      ctx.scale(s, s);
      drawBird(0, 0, 1.1, 0, item);
      ctx.restore();

      G.bird.face = savedFace;
      G.bird.tilt = savedTilt;
      G.bird.squash = savedSquash;
      G.shield = savedShield;
      G.mode = savedMode;
    } else {
      var n = 7;
      for (var i = 0; i < n; i++) {
        var tt = i / (n - 1);
        var x = w * (0.16 + tt * 0.68);
        var y = h * 0.62 - Math.sin(tt * Math.PI) * h * 0.24;
        var col = item.colors[i % item.colors.length];
        var rad = w * (0.032 + tt * 0.05);
        glowOn(col, 10);
        ctx.fillStyle = rgba(col, 0.85);
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      glowOff();
    }

    ctx = old;
  }

  /* ---------------- ana döngü ----------------

     Sabit adımlı simülasyon: oyun hızı kare hızına bağlı değildir.
     Yavaş cihazda kare atlanır ama oyun aynı hızda ilerler. */

  var STEP = 1 / 60;
  var acc = 0;
  var last = 0;
  var perfAcc = 0, perfN = 0, perfCool = 1.2;

  /* kare süresini ölç, sürekli yavaşsa kaliteyi düşür */
  function perfSample(ms) {
    /* arka plana atılmış / kısıtlanmış sekmede ölçüm yapma */
    if (document.hidden || ms > 100) { perfAcc = 0; perfN = 0; return; }
    if (perfCool > 0) { perfCool -= ms / 1000; return; }
    perfAcc += ms;
    perfN++;
    if (perfN < 40) return;
    var avg = perfAcc / perfN;
    perfAcc = 0;
    perfN = 0;
    if (avg > 22 && qualityMode === 'auto' && qLevel < QUALITY_LEVELS.length - 1) {
      setQuality(qLevel + 1);
      perfCool = 1.1;
    } else {
      perfCool = 0.3;
    }
  }

  function frame(ts) {
    if (!last) last = ts;
    var real = (ts - last) / 1000;
    last = ts;
    if (real > 0.25) real = 0.25;      /* sekme arkada kalınca sıçrama olmasın */

    perfSample(real * 1000);

    acc += real;
    var steps = 0;
    while (acc >= STEP && steps < 6) {
      update(STEP);
      acc -= STEP;
      steps++;
    }
    if (acc > STEP * 4) acc = 0;       /* aşırı birikimi at */

    draw();
    requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { acc = 0; last = 0; }
  });

  /* ---------------- giriş ---------------- */

  function toWorldX(clientX) {
    var rect = canvas.getBoundingClientRect();
    return (clientX - rect.left) / rect.width * W;
  }

  window.addEventListener('keydown', function (e) {
    var k = e.key.toLowerCase();
    if (anySheetOpen()) {
      if (k === 'escape') { e.preventDefault(); closeSheets(); }
      return;
    }
    if (k === 'arrowleft' || k === 'a' || k === 'left') {
      G.keys.left = true;
      e.preventDefault();
    } else if (k === 'arrowright' || k === 'd' || k === 'right') {
      G.keys.right = true;
      e.preventDefault();
    } else if (k === ' ' || k === 'enter') {
      e.preventDefault();
      if (G.mode === 'menu' || G.mode === 'over') startGame();
      else if (G.mode === 'paused') setMode('play');
    } else if (k === 'p' || k === 'escape') {
      e.preventDefault();
      if (G.mode === 'play') setMode('paused');
      else if (G.mode === 'paused') setMode('play');
    } else if (k === 'm') {
      toggleSound();
    }
  });

  window.addEventListener('keyup', function (e) {
    var k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a' || k === 'left') G.keys.left = false;
    if (k === 'arrowright' || k === 'd' || k === 'right') G.keys.right = false;
  });

  /* ---- dokunmatik / fare ---- */

  function halfOf(clientX) {
    return toWorldX(clientX) < W / 2 ? -1 : 1;
  }

  function startTouch(e) {
    G.touch.active = true;
    G.touch.id = e.pointerId;
    G.touch.side = halfOf(e.clientX);
    G.pointer.active = false;
    G.pointer.x = null;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
    hideTouchHint();
  }

  canvas.addEventListener('pointerdown', function (e) {
    if (G.mode !== 'play') return;
    if (inputMode === 'touch') {
      e.preventDefault();
      startTouch(e);
    } else {
      G.pointer.active = true;
      G.pointer.x = toWorldX(e.clientX);
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
    }
  });

  canvas.addEventListener('pointermove', function (e) {
    if (inputMode === 'touch') {
      if (!G.touch.active || e.pointerId !== G.touch.id) return;
      /* parmak basılıyken diğer yarıya kaydırırsan yön değişir */
      G.touch.side = halfOf(e.clientX);
      e.preventDefault();
      return;
    }
    if (!G.pointer.active) return;
    G.pointer.x = toWorldX(e.clientX);
  });

  function endPointer(e) {
    if (e && e.pointerId !== undefined && G.touch.active && e.pointerId !== G.touch.id) return;
    G.touch.active = false;
    G.touch.id = null;
    G.touch.side = 0;
    G.pointer.active = false;
    G.pointer.x = null;
  }
  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', endPointer);
  window.addEventListener('blur', function () { endPointer(); });

  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ---------------- butonlar ---------------- */

  document.querySelectorAll('.mode-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      applyInputMode(b.getAttribute('data-mode'));
      sfx('start');
    });
  });

  $('btn-start').addEventListener('click', startGame);
  $('btn-again').addEventListener('click', startGame);
  $('btn-menu').addEventListener('click', goMenu);
  $('btn-resume').addEventListener('click', function () { setMode('play'); });
  $('btn-pause-menu').addEventListener('click', goMenu);
  $('btn-pause').addEventListener('click', function () {
    if (G.mode === 'play') setMode('paused');
    else if (G.mode === 'paused') setMode('play');
  });

  function toggleSound() {
    soundOn = !soundOn;
    try { store('wb_sound', soundOn ? '1' : '0'); } catch (e) { }
    $('btn-sound').textContent = soundOn ? '🔊' : '🔇';
    if (document.getElementById('sw-sound')) syncSettings();
    if (soundOn) sfx('jump');
  }
  $('btn-sound').addEventListener('click', toggleSound);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && G.mode === 'play') setMode('paused');
  });

  /* ---------------- arayüz: sandık / kozmetik / ayarlar ---------------- */

  var crateToken = 0;
  var resetTimer = null;

  function anySheetOpen() {
    return !!document.querySelector('.sheet:not(.hidden)');
  }

  function closeSheets() {
    var list = document.querySelectorAll('.sheet');
    for (var i = 0; i < list.length; i++) list[i].classList.add('hidden');
  }

  function toast(msg) {
    var el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1900);
  }

  function updateWalletUI() {
    $('menu-coins').textContent = coins;
    $('crate-coins').textContent = coins;
    $('cos-coins').textContent = coins;
    $('menu-owned').textContent = countOwned() + ' / ' + COSMETICS.length;

    var btn = $('btn-open-crate');
    if (crateOpening) {
      btn.disabled = true;
      btn.textContent = 'AÇILIYOR…';
      return;
    }
    if (allOwned()) {
      btn.disabled = true;
      btn.textContent = 'KOLEKSİYON TAMAM';
      return;
    }
    btn.disabled = coins < CRATE_COST;
    btn.textContent = coins < CRATE_COST
      ? 'YETERSİZ NEON · ' + CRATE_COST + ' ⬢'
      : 'SANDIĞI AÇ · ' + CRATE_COST + ' ⬢';
  }

  function openSheet(id) {
    closeSheets();
    updateWalletUI();
    $(id).classList.remove('hidden');
    if (id === 'sheet-cos') renderCosmetics();
    if (id === 'sheet-set') syncSettings();
    if (id === 'sheet-crate') resetCrateUI();
    sfx('ui');
  }

  /* ---- sandık ---- */

  function resetCrateUI() {
    if (crateOpening) return;
    $('crate-result').classList.add('hidden');
    $('crate-intro').classList.remove('hidden');
    $('btn-crate-done').classList.add('hidden');
    $('btn-equip-reward').classList.add('hidden');
    $('crate').classList.remove('opening');
    $('crate-spark').classList.remove('burst');
    rewardItem = null;
    updateWalletUI();
  }

  function rollCrateItem() {
    var pool = [];
    var total = 0;
    for (var i = 0; i < COSMETICS.length; i++) {
      var c = COSMETICS[i];
      if (!owned[c.id]) {
        pool.push(c);
        total += RARITY[c.rarity].w;
      }
    }
    if (!pool.length) return null;

    var r = Math.random() * total;
    for (var j = 0; j < pool.length; j++) {
      r -= RARITY[pool[j].rarity].w;
      if (r <= 0) return pool[j];
    }
    return pool[pool.length - 1];
  }

  function showCrateReward(item) {
    if (!item) {
      coins += CRATE_COST;
      saveProgress();
      updateWalletUI();
      toast('Koleksiyon tamam! ' + CRATE_COST + ' NEON iade edildi');
      return;
    }

    owned[item.id] = 1;
    saveProgress();
    rewardItem = item;

    var r = RARITY[item.rarity];
    $('crate-result').setAttribute('data-rarity', item.rarity);
    $('rr-rar').textContent = r.name;
    $('rr-name').textContent = item.name.toUpperCase();
    $('rr-note').textContent = item.kind === 'skin'
      ? 'Yeni karakter açıldı!'
      : 'Yeni iz açıldı!';
    $('btn-equip-reward').textContent = 'HEMEN KUŞAN';
    $('btn-equip-reward').classList.remove('hidden');
    renderPreview($('rr-prev'), item);

    $('crate-result').classList.remove('hidden');
    $('crate-intro').classList.add('hidden');
    $('btn-crate-done').classList.remove('hidden');

    updateWalletUI();
    sfx('unlock');
  }

  function doOpenCrate() {
    if (crateOpening) return;
    if (allOwned()) { toast('Koleksiyon tamamlandı!'); return; }
    if (coins < CRATE_COST) { toast('Yetersiz NEON · biraz oyna ve dön'); return; }

    coins -= CRATE_COST;
    saveProgress();
    updateWalletUI();

    crateOpening = true;
    $('crate-result').classList.add('hidden');
    $('crate-intro').classList.add('hidden');
    $('btn-crate-done').classList.add('hidden');
    $('btn-equip-reward').classList.add('hidden');
    $('crate-spark').classList.remove('burst');
    $('crate').classList.add('opening');
    $('btn-open-crate').disabled = true;
    $('btn-open-crate').textContent = 'AÇILIYOR…';
    sfx('crate');

    var item = rollCrateItem();
    if (item) {
      owned[item.id] = 1;
      saveProgress();
    }
    var token = ++crateToken;
    setTimeout(function () {
      if (token !== crateToken) return;
      crateOpening = false;
      $('crate').classList.remove('opening');
      $('crate-spark').classList.add('burst');
      showCrateReward(item);
    }, 1100);
  }

  /* ---- kozmetik ---- */

  function equipItem(item) {
    if (!item || !owned[item.id]) return;
    if (item.kind === 'skin') equippedSkin = item;
    else equippedTrail = item;
    saveProgress();
    updateWalletUI();
    sfx('equip');
    toast(item.name + ' kuşanıldı');
  }

  function setCosTab(tab) {
    cosTab = tab === 'trail' ? 'trail' : 'skin';
    var btns = document.querySelectorAll('#cos-tabs button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('on', btns[i].getAttribute('data-tab') === cosTab);
    }
    renderCosmetics();
  }

  function renderCosmetics() {
    var grid = $('cos-grid');
    var list = [];
    for (var i = 0; i < COSMETICS.length; i++) {
      if (COSMETICS[i].kind === cosTab) list.push(COSMETICS[i]);
    }

    var html = '';
    for (var j = 0; j < list.length; j++) {
      var item = list[j];
      var isOwned = !!owned[item.id];
      var isEq = item.kind === 'skin'
        ? equippedSkin.id === item.id
        : equippedTrail.id === item.id;
      var state = isEq ? 'KUŞANILDI' : (isOwned ? 'KUŞAN' : 'SANDIKTAN');
      html += '<button class="cos-card ' + (isOwned ? 'owned' : 'locked') +
        (isEq ? ' equipped' : '') + '" data-rarity="' + item.rarity +
        '" data-id="' + item.id + '" type="button">' +
        '<div class="cos-prev"><canvas width="88" height="88"></canvas></div>' +
        '<div class="cos-name">' + item.name + '</div>' +
        '<div class="cos-state">' + state + '</div>' +
        (isOwned ? '' : '<span class="cos-lock">🔒</span>') +
        '</button>';
    }
    grid.innerHTML = html;

    var cards = grid.querySelectorAll('.cos-card');
    for (var k = 0; k < cards.length; k++) {
      (function (card) {
        var item = BY_ID[card.getAttribute('data-id')];
        renderPreview(card.querySelector('canvas'), item);
        card.addEventListener('click', function () {
          if (!owned[item.id]) {
            toast(RARITY[item.rarity].name + ' · sandıktan çıkabilir');
            sfx('ui');
            return;
          }
          var already = item.kind === 'skin'
            ? equippedSkin.id === item.id
            : equippedTrail.id === item.id;
          if (already) { toast(item.name + ' zaten kuşanıldı'); return; }
          equipItem(item);
          renderCosmetics();
        });
      })(cards[k]);
    }
  }

  /* ---- ayarlar ---- */

  function syncSettings() {
    $('sw-sound').classList.toggle('on', soundOn);
    $('set-sound').setAttribute('aria-pressed', soundOn ? 'true' : 'false');
    $('sw-shake').classList.toggle('on', shakeOn);
    $('set-shake').setAttribute('aria-pressed', shakeOn ? 'true' : 'false');

    var qb = document.querySelectorAll('#seg-quality button');
    for (var i = 0; i < qb.length; i++) {
      qb[i].classList.toggle('on', qb[i].getAttribute('data-q') === qualityMode);
    }

    var tag = qualityMode === 'auto' ? 'OTO'
      : qualityMode === '0' ? 'YÜKSEK'
        : qualityMode === '1' ? 'ORTA' : 'DÜŞÜK';
    $('set-quality-tag').textContent = tag;

    resetArmed = false;
    if (resetTimer) { clearTimeout(resetTimer); resetTimer = null; }
    $('btn-reset').classList.remove('armed');
    $('btn-reset').textContent = 'İLERLEMEYİ SIFIRLA';
  }

  function applyQualityMode(mode) {
    qualityMode = mode;
    store('wb_quality', mode);
    if (mode === 'auto') setQuality(isTouch ? 1 : 0);
    else setQuality(parseInt(mode, 10));
    syncSettings();
    toast('Kalite: ' + $('set-quality-tag').textContent);
  }

  function resetProgress() {
    coins = START_COINS;
    owned = { 'klasik': 1, 'iz-neon': 1 };
    equippedSkin = BY_ID['klasik'];
    equippedTrail = BY_ID['iz-neon'];
    G.best = 0;
    store('wb_best', '0');
    saveProgress();
    updateWalletUI();
    syncSettings();
    closeSheets();
    goMenu();
    toast('İlerleme sıfırlandı · ' + START_COINS + ' NEON hediye');
  }

  /* ---- arayüz bağlantıları ---- */

  $('btn-crate').addEventListener('click', function () { openSheet('sheet-crate'); });
  $('btn-over-crate').addEventListener('click', function () { openSheet('sheet-crate'); });
  $('btn-cosmetics').addEventListener('click', function () { openSheet('sheet-cos'); });
  $('btn-settings').addEventListener('click', function () { openSheet('sheet-set'); });

  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () { closeSheets(); sfx('ui'); });
  });

  $('btn-open-crate').addEventListener('click', doOpenCrate);
  $('btn-crate-done').addEventListener('click', function () { closeSheets(); sfx('ui'); });

  $('btn-equip-reward').addEventListener('click', function () {
    if (!rewardItem) return;
    equipItem(rewardItem);
    $('btn-equip-reward').textContent = 'KUŞANILDI ✓';
  });

  document.querySelectorAll('#cos-tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      setCosTab(b.getAttribute('data-tab'));
      sfx('ui');
    });
  });

  $('set-sound').addEventListener('click', function () { toggleSound(); });
  $('set-shake').addEventListener('click', function () {
    shakeOn = !shakeOn;
    store('wb_shake', shakeOn ? '1' : '0');
    syncSettings();
    sfx('ui');
    toast('Ekran sarsıntısı: ' + (shakeOn ? 'açık' : 'kapalı'));
  });

  document.querySelectorAll('#seg-quality button').forEach(function (b) {
    b.addEventListener('click', function () {
      applyQualityMode(b.getAttribute('data-q'));
      sfx('ui');
    });
  });

  $('btn-reset').addEventListener('click', function () {
    if (!resetArmed) {
      resetArmed = true;
      this.classList.add('armed');
      this.textContent = 'EMİN MİSİN? TEKRAR BAS';
      resetTimer = setTimeout(function () {
        resetArmed = false;
        $('btn-reset').classList.remove('armed');
        $('btn-reset').textContent = 'İLERLEMEYİ SIFIRLA';
      }, 4000);
      return;
    }
    resetProgress();
  });

  /* ---------------- ölçek ---------------- */

  function viewportSize() {
    var vv = window.visualViewport;
    return {
      w: (vv && vv.width) || window.innerWidth,
      h: (vv && vv.height) || window.innerHeight
    };
  }

  function layout() {
    var v = viewportSize();
    var s = Math.min(v.w / W, v.h / H);
    document.getElementById('frame').style.setProperty('--s', s);

    /* tarayıcı yakınlaştırması / ekran değişimi */
    var dpr = window.devicePixelRatio || 1;
    if (Math.abs(dpr - BASE_DPR) > 0.01) {
      BASE_DPR = dpr;
      applyCanvasSize();
      bgKey = '';
    }
  }

  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 150); });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', layout);
    window.visualViewport.addEventListener('scroll', layout);
  }
  layout();

  /* ---------------- başlat ---------------- */

  window.__whirlybird = {
    G: G,
    startGame: startGame,
    goMenu: goMenu,
    setMode: setMode,
    update: update,
    draw: draw,
    reset: reset,
    spawnPlatform: spawnPlatform,
    setInputMode: applyInputMode,
    getInputMode: function () { return inputMode; },
    setQuality: setQuality,
    getQuality: function () { return qLevel; },
    getDPR: function () { return DPR; },
    isTouch: isTouch,
    getCoins: function () { return coins; },
    addCoins: function (n) { coins = Math.max(0, coins + n); saveProgress(); updateWalletUI(); return coins; },
    getOwned: function () { return Object.keys(owned); },
    getEquipped: function () { return { skin: equippedSkin.id, trail: equippedTrail.id }; },
    equip: function (id) { if (BY_ID[id]) equipItem(BY_ID[id]); },
    openCrate: doOpenCrate,
    rollCrateItem: rollCrateItem,
    getCosmetics: function () { return COSMETICS; },
    openSheet: openSheet,
    closeSheets: closeSheets,
    renderCosmetics: renderCosmetics,
    getQualityMode: function () { return qualityMode; },
    setQualityMode: applyQualityMode,
    isShakeOn: function () { return shakeOn; },
    resetProgress: resetProgress,
    runCoins: runCoins,
    spawnBoss: function () { G.bossTriggered = false; startBoss(); },
    getBoss: function () {
      return G.boss ? { state: G.boss.state, hp: G.boss.hp, maxHp: G.boss.maxHp, x: G.boss.x, sy: G.boss.sy } : null;
    },
    getBossShots: function () { return G.bossShots.length; },
    getBossCore: function () { return G.bossCore ? { x: G.bossCore.x, y: G.bossCore.y } : null; },
    spawnBossCore: spawnBossCore,
    getRunBonuses: function () { return { bossScore: G.bonus, bossCoins: G.bossCoins, bossTriggered: G.bossTriggered }; },
    getTheme: function () { return themeFor(G.mode === 'menu' ? Math.min(7000, G.best * 2) : G.meters); },
    bossAt: BOSS_AT
  };

  $('btn-sound').textContent = soundOn ? '🔊' : '🔇';
  if (qualityMode !== 'auto') setQuality(parseInt(qualityMode, 10));
  syncSettings();
  updateWalletUI();
  applyInputMode(inputMode, false);
  goMenu();

  // menü arka planı için dünya hazır
  G.camY = START_CAM;
  requestAnimationFrame(frame);
})();
