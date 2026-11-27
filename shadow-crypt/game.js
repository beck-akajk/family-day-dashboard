/* 그림자 성채 · SHADOW CRYPT — a Diablo-flavoured hack & slash for mobile landscape + PC */
(function () {
'use strict';

/* =====================================================================
   0. ERROR CAPTURE (visible only if something breaks)
   ===================================================================== */
var ERRS = [];
window.__errs = ERRS;
function logErr(msg) {
  ERRS.push(String(msg));
  var b = document.getElementById('errbox');
  if (b) { b.textContent = ERRS.slice(-2).join('\n'); b.style.display = 'block'; }
}
window.onerror = function (m, s, l) { logErr(m + ' @' + String(s || '').split('/').pop() + ':' + l); };
window.addEventListener('unhandledrejection', function (e) { logErr('promise ' + e.reason); });

/* =====================================================================
   1. UTIL
   ===================================================================== */
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rnd(a, b) { return a + Math.random() * (b - a); }
function irnd(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function chance(p) { return Math.random() < p; }
function dist2(ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; }
function dist(ax, ay, bx, by) { return Math.sqrt(dist2(ax, ay, bx, by)); }
function nrm(x, y) { var l = Math.sqrt(x * x + y * y) || 1; return { x: x / l, y: y / l }; }
function angOf(x, y) { return Math.atan2(y, x); }
function hash2(x, y, s) { var n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); }
function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function $(id) { return document.getElementById(id); }
function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

/* =====================================================================
   2. SOUND — fully synthesised with Web Audio (no assets, no copyright)
   ===================================================================== */
var Sound = (function () {
  var ctx = null, master = null, muted = false, noiseCache = null;

  function init() {
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { return; }
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    var len = Math.floor(ctx.sampleRate * 0.6);
    noiseCache = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseCache.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  function ok() { return ctx && !muted; }
  function now() { return ctx.currentTime; }
  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!ok()) return;
    var t = now() + (delay || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol || 0.15), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, ftype, f0, f1, q, delay) {
    if (!ok() || !noiseCache) return;
    var t = now() + (delay || 0);
    var s = ctx.createBufferSource(); s.buffer = noiseCache;
    var f = ctx.createBiquadFilter(); f.type = ftype || 'lowpass';
    f.frequency.setValueAtTime(f0 || 1000, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    if (q) f.Q.value = q;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol || 0.2), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + dur + 0.02);
  }
  var api = {
    init: init,
    resume: function () { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setMuted: function (m) { muted = !!m; },
    isMuted: function () { return muted; },
    swing: function () { noise(0.13, 0.16, 'bandpass', 1900, 500, 1.2); },
    hit: function (big) { noise(big ? 0.16 : 0.09, big ? 0.3 : 0.18, 'lowpass', 1200, 220); tone(big ? 70 : 105, 0.1, 'square', 0.08, 40); },
    crit: function () { noise(0.15, 0.28, 'bandpass', 2600, 700, 1); tone(300, 0.14, 'sawtooth', 0.09, 90); },
    shoot: function () { tone(880, 0.09, 'triangle', 0.09, 320); noise(0.07, 0.09, 'highpass', 1800, 900); },
    fire: function () { noise(0.4, 0.32, 'lowpass', 2200, 180, 1); tone(160, 0.32, 'sawtooth', 0.1, 50); },
    boom: function () { noise(0.55, 0.4, 'lowpass', 900, 60, 1); tone(58, 0.5, 'sine', 0.22, 30); },
    frost: function () { tone(1760, 0.28, 'sine', 0.07, 2400); tone(2637, 0.3, 'sine', 0.05, 3200, 0.03); noise(0.25, 0.09, 'highpass', 3000, 1200); },
    dash: function () { noise(0.2, 0.16, 'bandpass', 400, 2100, 0.8); },
    potion: function () { tone(420, 0.1, 'sine', 0.11, 620); tone(620, 0.14, 'sine', 0.09, 860, 0.08); },
    gold: function () { tone(1320, 0.06, 'square', 0.05); tone(1760, 0.08, 'square', 0.04, 1760, 0.04); },
    levelup: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.34, 'triangle', 0.11, f, i * 0.1); }); noise(0.5, 0.06, 'highpass', 4000, 6000); },
    legendary: function () { [1046, 1318, 1568, 2093, 2637].forEach(function (f, i) { tone(f, 0.75, 'sine', 0.09, f, i * 0.085); }); },
    portal: function () { tone(90, 1.2, 'sine', 0.14, 300); tone(180, 1.2, 'triangle', 0.06, 600); noise(1.1, 0.1, 'bandpass', 200, 1400, 2); },
    hurt: function () { noise(0.2, 0.28, 'lowpass', 700, 120); tone(120, 0.18, 'sawtooth', 0.1, 60); },
    death: function () { tone(220, 0.9, 'sawtooth', 0.12, 55); noise(0.7, 0.2, 'lowpass', 900, 100); },
    roar: function () { tone(62, 1.1, 'sawtooth', 0.2, 40); tone(93, 1.1, 'square', 0.08, 60); noise(1.0, 0.22, 'lowpass', 500, 90); },
    click: function () { tone(760, 0.05, 'square', 0.04, 520); },
    deny: function () { tone(180, 0.12, 'square', 0.06, 120); },
    equip: function () { tone(320, 0.1, 'triangle', 0.08, 480); noise(0.15, 0.1, 'bandpass', 1200, 3000, 1); }
  };
  return api;
})();

/* =====================================================================
   3. DATA
   ===================================================================== */
var TILE = 40;
var MAPW = 41, MAPH = 41;

var CLASSES = {
  warrior: {
    id: 'warrior', name: '야만용사', short: '야만', color: '#c4552e', emblem: '⚔️',
    hp: 175, mp: 50, str: 13, dex: 5, vit: 12, int: 3, main: 'str',
    speed: 168, atkSpeed: 2.0, range: 92,
    autoStats: { str: 0.5, vit: 0.4, dex: 0.1 },
    skills: [
      { id: 'whirl', name: '회전베기', icon: '🌀', key: '1', cd: 6, mp: 14, desc: '0.9초간 회전하며 주변을 계속 벱니다.' },
      { id: 'leap', name: '도약 강타', icon: '💢', key: '2', cd: 9, mp: 12, desc: '조준 지점으로 도약, 착지 충격파로 광역 피해.' },
      { id: 'cry', name: '전투 함성', icon: '📢', key: '3', cd: 20, mp: 18, desc: '12초간 공격 +30%, 방어 +40%, 이동 +8%.' }
    ]
  },
  mage: {
    id: 'mage', name: '원소술사', short: '술사', color: '#4d7fd6', emblem: '✦',
    hp: 120, mp: 105, str: 4, dex: 6, vit: 8, int: 15, main: 'int',
    speed: 162, atkSpeed: 2.3, range: 330,
    autoStats: { int: 0.6, vit: 0.3, dex: 0.1 },
    skills: [
      { id: 'fireball', name: '화염구', icon: '🔥', key: '1', cd: 4.5, mp: 12, desc: '폭발하는 화염구를 발사합니다.' },
      { id: 'nova', name: '빙결 파동', icon: '❄', key: '2', cd: 9, mp: 20, desc: '주변 적을 얼려 느려지게 하고 피해를 줍니다.' },
      { id: 'meteor', name: '유성 낙하', icon: '☄', key: '3', cd: 13, mp: 32, desc: '조준 지점에 거대한 유성을 떨어뜨립니다.' }
    ]
  },
  ranger: {
    id: 'ranger', name: '악마사냥꾼', short: '사냥꾼', color: '#4f9b62', emblem: '🏹',
    hp: 140, mp: 70, str: 6, dex: 14, vit: 9, int: 5, main: 'dex',
    speed: 182, atkSpeed: 2.9, range: 340,
    autoStats: { dex: 0.6, vit: 0.3, str: 0.1 },
    skills: [
      { id: 'multi', name: '연발 사격', icon: '🎯', key: '1', cd: 5, mp: 12, desc: '부채꼴로 화살 5발을 발사합니다.' },
      { id: 'pierce', name: '관통 화살', icon: '➤', key: '2', cd: 8, mp: 10, desc: '모든 적을 꿰뚫는 강력한 화살.' },
      { id: 'smoke', name: '연막 도약', icon: '💨', key: '3', cd: 11, mp: 14, desc: '뒤로 도약하며 1.2초 무적·이동 가속.' }
    ]
  }
};

var THEMES = [
  { name: '잊힌 회랑', floor: '#2c2a2f', floor2: '#26242a', wall: '#3b373d', wall2: '#211e24', mortar: '#141216', accent: '#c8803f', fog: '#050508' },
  { name: '핏빛 성당', floor: '#332528', floor2: '#2a1e21', wall: '#4b2c2b', wall2: '#2a1919', mortar: '#170e10', accent: '#c2452c', fog: '#080406' },
  { name: '뼈의 심연', floor: '#26292b', floor2: '#202325', wall: '#3f4446', wall2: '#232728', mortar: '#111415', accent: '#8fc0a8', fog: '#040607' },
  { name: '심연의 왕좌', floor: '#241f30', floor2: '#1e1a29', wall: '#352c48', wall2: '#1d1829', mortar: '#0e0b15', accent: '#9b6fd6', fog: '#050308' }
];

var BOSSES = [
  { name: '뼈 군주 카르가스', title: 'THE BONE LORD' },
  { name: '핏빛 대사제 몰록', title: 'HIGH PRIEST OF BLOOD' },
  { name: '심연의 포식자', title: 'DEVOURER OF THE ABYSS' },
  { name: '성채의 군주', title: 'LORD OF THE CRYPT' }
];

var ETYPES = {
  skeleton: { name: '해골 병사', hp: 46, dmg: 8, speed: 76, r: 14, range: 36, cd: 1.1, xp: 13, color: '#cfc7ae', dark: '#8f876f', kind: 'melee' },
  cultist: { name: '핏빛 광신도', hp: 38, dmg: 9, speed: 64, r: 13, range: 250, cd: 1.9, xp: 16, color: '#a8443c', dark: '#5e211d', kind: 'ranged', pspd: 235 },
  brute: { name: '지옥의 거한', hp: 120, dmg: 15, speed: 54, r: 21, range: 44, cd: 1.6, xp: 28, color: '#8a5040', dark: '#4d281f', kind: 'melee' },
  wraith: { name: '망령', hp: 62, dmg: 11, speed: 112, r: 14, range: 38, cd: 1.0, xp: 20, color: '#8fb8b0', dark: '#3f5f5c', kind: 'melee', ghost: true },
  boneshot: { name: '뼈 창수', hp: 52, dmg: 10, speed: 66, r: 14, range: 280, cd: 2.1, xp: 19, color: '#b8ae90', dark: '#6f6751', kind: 'ranged', pspd: 260 }
};
var ETYPE_BY_FLOOR = [
  ['skeleton', 'cultist', 'skeleton', 'brute'],
  ['cultist', 'skeleton', 'boneshot', 'brute'],
  ['boneshot', 'wraith', 'skeleton', 'brute'],
  ['wraith', 'boneshot', 'brute', 'cultist']
];

var RARITY = {
  common: { n: '일반', c: '#cfc6b2', glow: 'rgba(220,215,195,', mult: 1.0, affix: [0, 0], gold: 7, w: 100 },
  magic:  { n: '마법', c: '#6f9ee8', glow: 'rgba(90,140,235,', mult: 1.32, affix: [1, 2], gold: 22, w: 46 },
  rare:   { n: '희귀', c: '#e8d05a', glow: 'rgba(230,205,80,', mult: 1.72, affix: [2, 3], gold: 60, w: 15 },
  legend: { n: '전설', c: '#f0902a', glow: 'rgba(240,140,40,', mult: 2.25, affix: [3, 3], gold: 180, w: 3 }
};
var RARITY_ORDER = ['common', 'magic', 'rare', 'legend'];

var SLOTINFO = {
  weapon: { n: '무기', icon: '⚔', short: '무기' },
  armor: { n: '갑옷', icon: '🛡', short: '갑옷' },
  ring: { n: '반지', icon: '💍', short: '반지' },
  amulet: { n: '아뮬렛', icon: '📿', short: '목걸이' }
};

var BASES = {
  weapon: ['녹슨 장검', '강철 대검', '룬 도끼', '심연의 칼날', '성채의 대검'],
  armor: ['가죽 조끼', '사슬 갑옷', '흑철 판금', '심연의 사슬', '성채 수호갑'],
  ring: ['구리 반지', '은 반지', '흑요석 반지', '룬 반지'],
  amulet: ['뼈 목걸이', '룬 아뮬렛', '핏빛 성표']
};
var PREFIX = { magic: ['빛나는', '날카로운', '단단한', '고요한'], rare: ['고귀한', '잔혹한', '불굴의', '서릿결의'], legend: [] };
var SUFFIX = ['곰의', '매의', '불꽃의', '심연의', '서리의', '피의', '폭풍의'];

var LEGENDARIES = [
  { id: 'ember', slot: 'weapon', name: '잿불의 이빨', desc: '적중 시 25% 확률로 불꽃이 폭발해 주변에 공격력 80% 피해.' },
  { id: 'vamp', slot: 'weapon', name: '흡혈의 송곳니', desc: '적중할 때마다 생명력 3 회복.' },
  { id: 'titan', slot: 'armor', name: '거인의 심장', desc: '최대 생명력 +25%.' },
  { id: 'gale', slot: 'armor', name: '질풍의 갑주', desc: '이동 속도 +18%, 대시 쿨다운 -30%.' },
  { id: 'gold', slot: 'ring', name: '탐욕의 인장', desc: '골드 획득 +80%, 이동 속도 +8%.' },
  { id: 'arc', slot: 'ring', name: '번개의 고리', desc: '공격 시 20% 확률로 연쇄 번개(공격력 60%).' },
  { id: 'storm', slot: 'amulet', name: '폭풍의 룬', desc: '모든 스킬 쿨다운 -20%, 최대 마나 +20.' }
];

var AFFIXES = [
  { k: 'atk', n: '공격력', base: 3, per: 1.15, int: true, w: 2.0 },
  { k: 'armor', n: '방어력', base: 3, per: 1.0, int: true, w: 1.6 },
  { k: 'hp', n: '최대 생명력', base: 12, per: 5.2, int: true, w: 1.8 },
  { k: 'mp', n: '최대 마나', base: 8, per: 2.4, int: true, w: 0.8 },
  { k: 'crit', n: '치명타 확률', base: 2, per: 0.28, int: false, pct: true, w: 1.0 },
  { k: 'aspd', n: '공격 속도', base: 3, per: 0.32, int: false, pct: true, w: 0.9 },
  { k: 'mspd', n: '이동 속도', base: 2, per: 0.22, int: false, pct: true, w: 0.8 },
  { k: 'loh', n: '적중 시 생명력', base: 1, per: 0.22, int: true, w: 0.7 },
  { k: 'gold', n: '골드 획득', base: 6, per: 1.0, int: false, pct: true, w: 0.7 },
  { k: 'cdr', n: '재사용 대기시간 감소', base: 2, per: 0.22, int: false, pct: true, w: 0.6 }
];

var MAX_UPGRADE = 10;
var BAG_SIZE = 30;

/* ---- item creation ---- */
var UID = 1;
function rollRarity(ilvl, bonus) {
  var w = { common: RARITY.common.w, magic: RARITY.magic.w * (1 + ilvl * 0.02), rare: RARITY.rare.w * (1 + ilvl * 0.035), legend: RARITY.legend.w * (1 + ilvl * 0.02) };
  if (bonus) { w.magic *= bonus; w.rare *= bonus * 1.2; w.legend *= bonus * 1.6; w.common /= bonus; }
  var tot = w.common + w.magic + w.rare + w.legend, r = Math.random() * tot;
  if ((r -= w.common) < 0) return 'common';
  if ((r -= w.magic) < 0) return 'magic';
  if ((r -= w.rare) < 0) return 'rare';
  return 'legend';
}
function tierOf(ilvl) { return clamp(Math.floor((ilvl - 1) / 6), 0, 4); }

function makeItem(ilvl, opt) {
  opt = opt || {};
  var rarity = opt.rarity || rollRarity(ilvl, opt.luck || 0);
  var slot = opt.slot || pick(['weapon', 'weapon', 'armor', 'armor', 'ring', 'amulet']);
  var R = RARITY[rarity];
  var tier = tierOf(ilvl);
  var base = BASES[slot][clamp(tier + (chance(0.15) ? 1 : 0), 0, BASES[slot].length - 1)];
  var q = R.mult * rnd(0.9, 1.12);
  var mods = {};
  if (slot === 'weapon') mods.atk = Math.max(2, Math.round((6 + ilvl * 2.1) * q));
  if (slot === 'armor') mods.armor = Math.max(2, Math.round((5 + ilvl * 1.7) * q));
  if (slot === 'ring' || slot === 'amulet') {
    if (chance(0.5)) mods.atk = Math.max(1, Math.round((3 + ilvl * 1.0) * q * 0.7));
    else mods.armor = Math.max(1, Math.round((2 + ilvl * 0.9) * q * 0.7));
  }
  var cnt = irnd(R.affix[0], R.affix[1]);
  var pool = AFFIXES.slice();
  for (var i = 0; i < cnt && pool.length; i++) {
    var idx = weightedIndex(pool);
    var a = pool.splice(idx, 1)[0];
    if (mods[a.k]) { i--; continue; }
    var v = a.base + a.per * ilvl * rnd(0.8, 1.2);
    mods[a.k] = a.int ? Math.max(1, Math.round(v)) : Math.round(v * 10) / 10;
  }
  var it = {
    uid: UID++, slot: slot, rarity: rarity, base: base, ilvl: ilvl, up: 0, mods: mods, power: null,
    name: ''
  };
  if (rarity === 'legend') {
    var cands = LEGENDARIES.filter(function (L) { return L.slot === slot; });
    var L = cands.length ? pick(cands) : null;
    if (L) { it.power = L.id; it.name = L.name; }
    else it.name = '심연의 ' + base;
  } else {
    it.name = (PREFIX[rarity] && chance(0.7) ? pick(PREFIX[rarity]) + ' ' : '') + base + (chance(0.55) ? ' ' + pick(SUFFIX) : '');
  }
  return it;
}
function weightedIndex(arr) {
  var t = 0, i;
  for (i = 0; i < arr.length; i++) t += arr[i].w;
  var r = Math.random() * t;
  for (i = 0; i < arr.length; i++) { if ((r -= arr[i].w) < 0) return i; }
  return 0;
}
function itemMods(it) {
  if (!it) return {};
  var f = 1 + 0.1 * (it.up || 0), o = {};
  for (var k in it.mods) {
    var v = it.mods[k];
    o[k] = (k === 'crit' || k === 'aspd' || k === 'mspd' || k === 'gold' || k === 'cdr') ? Math.round(v * f * 10) / 10 : Math.round(v * f);
  }
  return o;
}
function itemScore(it) {
  if (!it) return 0;
  var m = itemMods(it);
  return (m.atk || 0) * 2.2 + (m.armor || 0) * 1.1 + (m.hp || 0) * 0.32 + (m.mp || 0) * 0.15 +
    (m.crit || 0) * 3.2 + (m.aspd || 0) * 2.6 + (m.mspd || 0) * 1.6 + (m.loh || 0) * 2.2 +
    (m.gold || 0) * 0.25 + (m.cdr || 0) * 2.2 + (it.power ? 30 : 0);
}
function salvageValue(it) {
  return Math.round(RARITY[it.rarity].gold * (1 + it.ilvl * 0.12) + 12 * (it.up || 0));
}
function upgradeCost(it) {
  return Math.round((45 + it.ilvl * 8) * (1 + (it.up || 0) * 0.75));
}
function affixLine(k, v) {
  var a = null;
  for (var i = 0; i < AFFIXES.length; i++) if (AFFIXES[i].k === k) a = AFFIXES[i];
  if (!a) return '';
  return '+' + v + (a.pct ? '% ' : ' ') + a.n;
}

/* =====================================================================
   4. GAME STATE
   ===================================================================== */
var G = {
  state: 'title',           // title | class | play | inv | pause | help | death
  floor: 1, theme: 0,
  player: null,
  enemies: [], projectiles: [], items: [], particles: [], floats: [], effects: [], torches: [],
  map: null, rooms: [], startRoom: null, bossRoom: null, staticCanvas: null,
  portal: null, boss: null,
  cam: { x: 0, y: 0 }, zoom: 1, view: { w: 800, h: 400, dpr: 1 },
  shake: 0, shakeX: 0, shakeY: 0, hitStop: 0,
  time: 0, flow: null, flowTimer: 0,
  keys: {}, mouse: { x: 0, y: 0, wx: 0, wy: 0, down: false, has: false },
  joy: { active: false, id: null, bx: 0, by: 0, kx: 0, ky: 0, dx: 0, dy: 0, mag: 0 },
  atkHeld: false, deathT: 0, bannerT: 0, saveTimer: 0,
  muted: false, autoStats: true,
  lightCv: null, lightCtx: null,
  fpsAcc: 0, fpsN: 0,
  lastTs: 0
};
var canvas = null, ctx = null, minimap = null, mctx = null;

/* =====================================================================
   5. MAP / DUNGEON
   ===================================================================== */
function tileAt(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MAPW || ty >= MAPH) return 0;
  return G.map[ty * MAPW + tx];
}
function isWallPx(x, y) { return tileAt(Math.floor(x / TILE), Math.floor(y / TILE)) !== 1; }

function genDungeon(floor) {
  var W = MAPW, H = MAPH, map = new Uint8Array(W * H), rooms = [], tries = 0;
  var want = 13 + Math.min(4, Math.floor(floor / 3));
  while (rooms.length < want && tries < 900) {
    tries++;
    var rw = irnd(5, 10), rh = irnd(4, 8);
    var rx = irnd(2, W - rw - 3), ry = irnd(2, H - rh - 3);
    var ok = true;
    for (var i = 0; i < rooms.length; i++) {
      var o = rooms[i];
      if (rx - 2 < o.x + o.w && rx + rw + 2 > o.x && ry - 2 < o.y + o.h && ry + rh + 2 > o.y) { ok = false; break; }
    }
    if (ok) rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: Math.floor(rx + rw / 2), cy: Math.floor(ry + rh / 2) });
  }
  if (rooms.length < 4) { // extremely unlikely fallback
    rooms = [{ x: 3, y: 3, w: 8, h: 7, cx: 7, cy: 6 }, { x: 26, y: 5, w: 9, h: 7, cx: 30, cy: 8 },
             { x: 5, y: 26, w: 9, h: 8, cx: 9, cy: 30 }, { x: 26, y: 27, w: 8, h: 8, cx: 30, cy: 31 }];
  }
  function carve(x, y) { if (x > 0 && y > 0 && x < W - 1 && y < H - 1) map[y * W + x] = 1; }
  rooms.forEach(function (r) {
    for (var y = r.y; y < r.y + r.h; y++) for (var x = r.x; x < r.x + r.w; x++) carve(x, y);
  });
  function corridor(a, b) {
    var x, y;
    var y0 = a.cy, x1 = b.cx;
    for (x = Math.min(a.cx, x1); x <= Math.max(a.cx, x1); x++) { carve(x, y0); carve(x, y0 + 1); }
    for (y = Math.min(y0, b.cy); y <= Math.max(y0, b.cy); y++) { carve(x1, y); carve(x1 + 1, y); }
    // make the corridor mouth solid
    for (var dx = -1; dx <= 2; dx++) for (var dy = -1; dy <= 2; dy++) {
      if (dx === -1 || dx === 2 || dy === -1 || dy === 2) { /* walls naturally remain */ }
    }
  }
  for (var ri = 1; ri < rooms.length; ri++) corridor(rooms[ri - 1], rooms[ri]);
  // a few loops so it's not a pure chain
  for (var k = 0; k < 3; k++) {
    var a = pick(rooms), b = pick(rooms);
    if (a !== b && dist(a.cx, a.cy, b.cx, b.cy) < 26) corridor(a, b);
  }
  // walls around every floor cell so rooms have clean edges
  var m2 = map.slice();
  for (var y2 = 1; y2 < H - 1; y2++) for (var x2 = 1; x2 < W - 1; x2++) {
    if (map[y2 * W + x2] === 1) {
      if (map[(y2 - 1) * W + x2] !== 1 && hash2(x2, y2, 3) < 0.5) m2[(y2 - 1) * W + x2] = 0;
    }
  }
  map = m2;

  var start = rooms[0];
  var bossRoom = rooms[1], bd = dist(start.cx, start.cy, rooms[1].cx, rooms[1].cy);
  for (var q = 2; q < rooms.length; q++) {
    var d = dist(start.cx, start.cy, rooms[q].cx, rooms[q].cy);
    if (d > bd) { bd = d; bossRoom = rooms[q]; }
  }
  // enlarge the boss room by one tile
  for (var yy = bossRoom.y - 1; yy <= bossRoom.y + bossRoom.h; yy++)
    for (var xx = bossRoom.x - 1; xx <= bossRoom.x + bossRoom.w; xx++) carve(xx, yy);

  // torches on walls facing a floor
  var torches = [];
  for (var ty = 1; ty < H - 1; ty++) for (var tx = 1; tx < W - 1; tx++) {
    if (map[ty * W + tx] !== 0) continue;
    var faces = (tileAt2(map, tx, ty + 1, W)) ? 1 : 0;
    if (!faces) continue;
    if (hash2(tx, ty, 9) < 0.86) continue;
    var near = false;
    for (var t2 = 0; t2 < torches.length; t2++) if (Math.abs(torches[t2].tx - tx) + Math.abs(torches[t2].ty - ty) < 5) { near = true; break; }
    if (near) continue;
    torches.push({ tx: tx, ty: ty, x: tx * TILE + TILE / 2, y: ty * TILE + TILE * 0.72, phase: Math.random() * 6.28 });
  }

  return { map: map, rooms: rooms, start: start, bossRoom: bossRoom, torches: torches };
}
function tileAt2(map, tx, ty, W) {
  if (tx < 0 || ty < 0 || tx >= MAPW || ty >= MAPH) return 0;
  return map[ty * W + tx];
}

/* ---------------- static dungeon painting ---------------- */
function shade(hex, f) {
  var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f > 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  else { r *= (1 + f); g *= (1 + f); b *= (1 + f); }
  return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
}
function paintDungeon() {
  var th = THEMES[G.theme];
  var cv = document.createElement('canvas');
  cv.width = MAPW * TILE; cv.height = MAPH * TILE;
  var c = cv.getContext('2d');
  c.fillStyle = th.fog; c.fillRect(0, 0, cv.width, cv.height);

  // floor
  for (var y = 0; y < MAPH; y++) for (var x = 0; x < MAPW; x++) {
    if (G.map[y * MAPW + x] !== 1) continue;
    var h = hash2(x, y, 1), h2 = hash2(x, y, 4);
    var px = x * TILE, py = y * TILE;
    c.fillStyle = shade(h > 0.5 ? th.floor : th.floor2, (h - 0.5) * 0.22);
    c.fillRect(px, py, TILE, TILE);
    // slab bevel
    c.strokeStyle = 'rgba(0,0,0,.42)'; c.lineWidth = 1;
    c.strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3);
    c.strokeStyle = 'rgba(255,235,205,.035)';
    c.beginPath(); c.moveTo(px + 2, py + TILE - 2); c.lineTo(px + 2, py + 2); c.lineTo(px + TILE - 2, py + 2); c.stroke();
    // cracks / rubble
    if (h2 > 0.87) {
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.2;
      c.beginPath();
      var sx = px + 6 + h * 20, sy = py + 6 + h2 * 20;
      c.moveTo(sx, sy); c.lineTo(sx + 7, sy + 5); c.lineTo(sx + 3, sy + 13); c.lineTo(sx + 11, sy + 18);
      c.stroke();
    } else if (h2 > 0.79) {
      c.fillStyle = 'rgba(0,0,0,.28)';
      c.beginPath(); c.ellipse(px + 8 + h * 24, py + 9 + h2 * 22, 7, 4, h * 3, 0, 6.3); c.fill();
    }
    if (h > 0.965) { // blood stain
      c.fillStyle = th.name === '핏빛 성당' ? 'rgba(90,12,10,.34)' : 'rgba(70,12,10,.22)';
      c.beginPath(); c.ellipse(px + TILE * 0.5, py + TILE * 0.55, 11, 7, h, 0, 6.3); c.fill();
    }
  }

  // walls
  for (var wy = 0; wy < MAPH; wy++) for (var wx = 0; wx < MAPW; wx++) {
    if (G.map[wy * MAPW + wx] === 1) continue;
    var px2 = wx * TILE, py2 = wy * TILE;
    var facing = tileAt(wx, wy + 1) === 1 || tileAt(wx, wy - 1) === 1 || tileAt(wx - 1, wy) === 1 || tileAt(wx + 1, wy) === 1;
    var hh = hash2(wx, wy, 7);
    c.fillStyle = shade(facing ? th.wall : th.wall2, (hh - 0.5) * 0.2);
    c.fillRect(px2, py2, TILE, TILE);
    if (facing) {
      // brick courses
      c.strokeStyle = th.mortar; c.lineWidth = 1;
      for (var by = 0; by < TILE; by += 10) {
        c.beginPath(); c.moveTo(px2, py2 + by + 0.5); c.lineTo(px2 + TILE, py2 + by + 0.5); c.stroke();
      }
      for (var by2 = 0; by2 < TILE; by2 += 10) {
        var off = (by2 / 10) % 2 ? 0 : 12;
        for (var bx = off; bx < TILE; bx += 24) {
          c.beginPath(); c.moveTo(px2 + bx + 0.5, py2 + by2); c.lineTo(px2 + bx + 0.5, py2 + by2 + 10); c.stroke();
        }
      }
      c.strokeStyle = 'rgba(255,235,205,.09)';
      c.beginPath(); c.moveTo(px2, py2 + 1); c.lineTo(px2 + TILE, py2 + 1); c.stroke();
    } else {
      c.fillStyle = 'rgba(0,0,0,.35)';
      c.fillRect(px2 + 2, py2 + 2, TILE - 4, TILE - 4);
    }
  }

  // contact shadow on floor next to walls
  for (var sy = 0; sy < MAPH; sy++) for (var sx = 0; sx < MAPW; sx++) {
    if (G.map[sy * MAPW + sx] !== 1) continue;
    var grad = null;
    if (tileAt(sx, sy - 1) === 0) {
      grad = c.createLinearGradient(0, sy * TILE, 0, sy * TILE + 12);
      grad.addColorStop(0, 'rgba(0,0,0,.55)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = grad; c.fillRect(sx * TILE, sy * TILE, TILE, 12);
    }
    if (tileAt(sx - 1, sy) === 0) {
      grad = c.createLinearGradient(sx * TILE, 0, sx * TILE + 12, 0);
      grad.addColorStop(0, 'rgba(0,0,0,.45)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = grad; c.fillRect(sx * TILE, sy * TILE, 12, TILE);
    }
    if (tileAt(sx, sy + 1) === 0) {
      grad = c.createLinearGradient(0, sy * TILE + TILE, 0, sy * TILE + TILE - 12);
      grad.addColorStop(0, 'rgba(0,0,0,.5)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = grad; c.fillRect(sx * TILE, sy * TILE + TILE - 12, TILE, 12);
    }
    if (tileAt(sx + 1, sy) === 0) {
      grad = c.createLinearGradient(sx * TILE + TILE, 0, sx * TILE + TILE - 12, 0);
      grad.addColorStop(0, 'rgba(0,0,0,.45)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = grad; c.fillRect(sx * TILE + TILE - 12, sy * TILE, 12, TILE);
    }
  }
  G.staticCanvas = cv;
}

/* ---------------- flow field (BFS toward player) ---------------- */
function computeFlow() {
  var W = MAPW, H = MAPH;
  if (!G.flow) G.flow = new Int32Array(W * H);
  var f = G.flow;
  f.fill(-1);
  if (!G.player) return;
  var px = Math.floor(G.player.x / TILE), py = Math.floor(G.player.y / TILE);
  if (tileAt(px, py) !== 1) {
    var found = false;
    for (var r = 1; r <= 4 && !found; r++) {
      for (var oy = -r; oy <= r && !found; oy++) for (var ox = -r; ox <= r && !found; ox++) {
        if (tileAt(px + ox, py + oy) === 1) { px += ox; py += oy; found = true; }
      }
    }
    if (!found) return;
  }
  var q = new Int32Array(W * H), head = 0, tail = 0;
  var s = py * W + px;
  f[s] = 0; q[tail++] = s;
  while (head < tail) {
    var c = q[head++], cx = c % W, cy = (c - cx) / W, d = f[c];
    if (cx > 0 && G.map[c - 1] === 1 && f[c - 1] < 0) { f[c - 1] = d + 1; q[tail++] = c - 1; }
    if (cx < W - 1 && G.map[c + 1] === 1 && f[c + 1] < 0) { f[c + 1] = d + 1; q[tail++] = c + 1; }
    if (cy > 0 && G.map[c - W] === 1 && f[c - W] < 0) { f[c - W] = d + 1; q[tail++] = c - W; }
    if (cy < H - 1 && G.map[c + W] === 1 && f[c + W] < 0) { f[c + W] = d + 1; q[tail++] = c + W; }
  }
}
function flowDir(x, y) {
  var W = MAPW;
  var tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  var i = ty * W + tx;
  if (!G.flow || G.flow[i] == null || G.flow[i] < 0) return null;
  var best = G.flow[i], bx = -1, by = -1;
  var cand = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (var k = 0; k < 4; k++) {
    var nx = tx + cand[k][0], ny = ty + cand[k][1];
    if (nx < 0 || ny < 0 || nx >= MAPW || ny >= MAPH) continue;
    var j = ny * W + nx;
    if (G.map[j] !== 1) continue;
    if (G.flow[j] >= 0 && G.flow[j] < best) { best = G.flow[j]; bx = nx; by = ny; }
  }
  if (bx < 0) return null;
  // aim at the centre of the best neighbouring cell (keeps corridors passable)
  var cx = bx * TILE + TILE / 2, cy = by * TILE + TILE / 2;
  return nrm(cx - x, cy - y);
}

/* ---------------- camera ---------------- */
function camFollow(dt) {
  var p = G.player; if (!p) return;
  var vw = G.view.w / G.zoom, vh = G.view.h / G.zoom;
  var tx = p.x - vw / 2, ty = p.y - vh / 2;
  tx = clamp(tx, 0, Math.max(0, MAPW * TILE - vw));
  ty = clamp(ty, 0, Math.max(0, MAPH * TILE - vh));
  var k = 1 - Math.pow(0.0016, dt);
  G.cam.x += (tx - G.cam.x) * k;
  G.cam.y += (ty - G.cam.y) * k;
}
function worldToScreen(x, y) {
  return { x: (x - G.cam.x) * G.zoom, y: (y - G.cam.y) * G.zoom };
}
function screenToWorld(sx, sy) {
  return { x: sx / G.zoom + G.cam.x, y: sy / G.zoom + G.cam.y };
}

/* =====================================================================
   6. PLAYER
   ===================================================================== */
var SLOTS = ['weapon', 'armor', 'ring', 'amulet'];

function makePlayer(clsId) {
  var C = CLASSES[clsId];
  var p = {
    cls: clsId, x: 0, y: 0, r: 15, facing: { x: 0, y: 1 },
    level: 1, xp: 0, xpNext: 60,
    str: C.str, dex: C.dex, vit: C.vit, int: C.int, points: 0,
    hp: C.hp, maxHp: C.hp, mp: C.mp, maxMp: C.mp,
    equip: { weapon: null, armor: null, ring: null, amulet: null },
    bag: [], gold: 0, potions: 3,
    atkCd: 0, dashCd: 0, skillCd: [0, 0, 0], invuln: 0,
    buffT: 0, hasteT: 0, spinT: 0, spinTick: 0,
    leap: null, dashT: 0, dashVX: 0, dashVY: 0,
    anim: 0, moving: false, dead: false, kills: 0, dmgDealt: 0,
    lastHit: 0
  };
  recalc(p);
  p.hp = p.maxHp; p.mp = p.maxMp;
  return p;
}
function computeStats(p, override) {
  var C = CLASSES[p.cls];
  var eq = override || p.equip;
  var s = { atk: 0, armor: 0, hp: 0, mp: 0, crit: 0, aspd: 0, mspd: 0, loh: 0, gold: 0, cdr: 0, powers: {} };
  for (var i = 0; i < SLOTS.length; i++) {
    var it = eq[SLOTS[i]];
    if (!it) continue;
    var m = itemMods(it);
    s.atk += m.atk || 0; s.armor += m.armor || 0; s.hp += m.hp || 0; s.mp += m.mp || 0;
    s.crit += m.crit || 0; s.aspd += m.aspd || 0; s.mspd += m.mspd || 0;
    s.loh += m.loh || 0; s.gold += m.gold || 0; s.cdr += m.cdr || 0;
    if (it.power) s.powers[it.power] = 1;
  }
  var main = p[C.main] || 0;
  var all = p.str + p.dex + p.vit + p.int;
  s.atk = Math.round(4 + main * 1.15 + all * 0.18 + s.atk);
  s.armor = Math.round(s.armor + p.vit * 0.5);
  s.crit = Math.round((4 + p.dex * 0.3 + s.crit) * 10) / 10;
  s.aspd = Math.round(s.aspd * 10) / 10;
  s.mspd = Math.round(s.mspd * 10) / 10;
  s.cdr = Math.min(55, s.cdr);
  s.maxHp = Math.round(C.hp + p.vit * 7 + (p.level - 1) * 9 + s.hp);
  s.maxMp = Math.round(C.mp + p.int * 4 + (p.level - 1) * 2 + s.mp);
  s.atkSpeed = C.atkSpeed * (1 + s.aspd / 100);
  s.moveSpeed = C.speed * (1 + s.mspd / 100);
  s.powers = s.powers;
  if (s.powers.titan) s.maxHp = Math.round(s.maxHp * 1.25);
  if (s.powers.gold) s.gold += 80, s.mspd += 8;
  if (s.powers.storm) { s.cdr = Math.min(60, s.cdr + 20); s.maxMp += 20; }
  if (s.powers.gale) s.mspd += 18;
  s.moveSpeed = C.speed * (1 + s.mspd / 100);
  return s;
}
function recalc(p) {
  var s = computeStats(p);
  p.stats = s;
  var ratioHp = p.maxHp ? p.hp / p.maxHp : 1;
  p.maxHp = s.maxHp; p.maxMp = s.maxMp;
  p.hp = clamp(Math.round(p.maxHp * ratioHp), 0, p.maxHp);
  p.mp = clamp(p.mp, 0, p.maxMp);
}

function aimDir() {
  var p = G.player;
  if (!p) return { x: 0, y: 1 };
  if (G.mouse.has && !G.touchMode) {
    var w = screenToWorld(G.mouse.x, G.mouse.y);
    var d = nrm(w.x - p.x, w.y - p.y);
    if (isFinite(d.x)) return d;
  }
  var e = nearestEnemy(p.x, p.y, 560);
  if (e) return nrm(e.x - p.x, e.y - p.y);
  if (G.joy.mag > 0.15) return { x: G.joy.dx, y: G.joy.dy };
  return p.facing;
}
function nearestEnemy(x, y, maxD) {
  var best = null, bd = maxD * maxD;
  for (var i = 0; i < G.enemies.length; i++) {
    var e = G.enemies[i];
    if (e.dead) continue;
    var d = dist2(x, y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

/* =====================================================================
   7. COMBAT CORE
   ===================================================================== */
function addFloat(x, y, text, color, size, crit) {
  G.floats.push({ x: x + rnd(-8, 8), y: y - 12, vy: -46, text: text, color: color || '#fff', size: size || 13, life: 0.95, maxLife: 0.95, crit: !!crit });
}
function burst(x, y, n, color, spd, size, grav) {
  for (var i = 0; i < n; i++) {
    var a = Math.random() * 6.283, v = rnd(spd * 0.25, spd);
    G.particles.push({
      x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (grav ? rnd(20, 80) : 0),
      life: rnd(0.25, 0.6), maxLife: 0.6, size: rnd(size * 0.5, size), color: color, grav: grav || 0
    });
  }
}
function addRing(x, y, r0, r1, color, width, life) {
  G.effects.push({ type: 'ring', x: x, y: y, r0: r0, r1: r1, color: color, width: width || 3, life: life || 0.4, maxLife: life || 0.4 });
}
function addSlash(x, y, ang, r, color) {
  G.effects.push({ type: 'slash', x: x, y: y, ang: ang, r: r, color: color, life: 0.2, maxLife: 0.2 });
}
function tele(x, y, r, dur, color) {
  G.effects.push({ type: 'tele', x: x, y: y, r: r, color: color || 'rgba(240,90,60,', life: dur, maxLife: dur });
}
function addDelay(t, fn) { G.delayed.push({ t: t, fn: fn }); }

function damageEnemy(e, amount, crit, srcX, srcY, kb) {
  if (e.dead) return 0;
  var red = (e.armor || 0) / ((e.armor || 0) + 120);
  var dmg = Math.max(1, amount * (1 - red));
  e.hp -= dmg;
  e.hitFlash = 0.14;
  e.aggro = true;
  e.aggroT = 8;
  addFloat(e.x, e.y - e.r, Math.round(dmg), crit ? '#ffd75e' : '#fff1d0', crit ? 19 : 13, crit);
  if (crit) Sound.crit(); else Sound.hit(e.boss);
  var col = e.boss ? '#b03a2a' : '#7d1f18';
  burst(e.x, e.y, crit ? 9 : 5, col, 200, 3);
  if (kb) {
    var k = nrm(e.x - srcX, e.y - srcY);
    e.kx = (e.kx || 0) + k.x * kb; e.ky = (e.ky || 0) + k.y * kb;
  }
  G.player.dmgDealt += dmg;
  if (e.hp <= 0) killEnemy(e);
  return dmg;
}
function healPlayer(n) {
  var p = G.player;
  if (!p || p.dead) return;
  var before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + n);
  if (p.hp - before > 0.5) addFloat(p.x, p.y - 24, '+' + Math.round(p.hp - before), '#8fe08a', 12);
}
function hurtPlayer(dmg, sx, sy) {
  var p = G.player;
  if (!p || p.dead) return;
  if (p.invuln > 0) return;
  var red = p.stats.armor / (p.stats.armor + 95);
  var take = Math.max(1, dmg * (1 - red));
  if (p.buffT > 0) take *= 0.7;
  p.hp -= take;
  p.lastHit = G.time;
  G.shake = Math.max(G.shake, 5);
  addFloat(p.x, p.y - 26, '-' + Math.round(take), '#ff7d6a', 14);
  burst(p.x, p.y, 6, '#8d1f19', 170, 3);
  Sound.hurt();
  var fl = $('flash'); if (fl) { fl.style.opacity = '1'; setTimeout(function () { fl.style.opacity = '0'; }, 90); }
  if (p.hp <= 0) { p.hp = 0; playerDeath(); }
}
function playerDeath() {
  var p = G.player;
  p.dead = true;
  G.state = 'death';
  Sound.death();
  G.shake = 14;
  addRing(p.x, p.y, 10, 200, 'rgba(200,40,25,', 6, 0.8);
  burst(p.x, p.y, 30, '#8d1f19', 300, 4);
  var info = $('death-info');
  if (info) info.innerHTML = 'Lv.' + p.level + ' · ' + G.floor + '층에서 쓰러졌습니다<br>골드 ' + fmt(Math.floor(p.gold * 0.5)) + '을 잃고 입구에서 되살아납니다';
  show('death');
}
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true; e.deadT = 0.5;
  var p = G.player;
  p.kills++;
  Sound.hit(true);
  burst(e.x, e.y, e.boss ? 60 : 16, e.boss ? '#c8402a' : '#6e1a14', e.boss ? 380 : 220, e.boss ? 5 : 3);
  burst(e.x, e.y, 6, '#1a1512', 120, 3);
  // xp & gold
  var xp = Math.round(e.xp);
  addXp(xp);
  var gold = Math.round((e.boss ? 260 : e.elite ? 55 : 12) * (0.8 + G.floor * 0.25) * (1 + p.stats.gold / 100) * rnd(0.8, 1.2));
  p.gold += gold;
  addFloat(e.x, e.y - 30, '+' + fmt(gold) + ' G', '#f0cf8a', 12);
  if (!e.boss) Sound.gold();
  // loot
  var rolls = e.boss ? 3 : e.elite ? 2 : 1;
  for (var i = 0; i < rolls; i++) {
    var ch = e.boss ? 1 : e.elite ? 0.85 : 0.16;
    if (chance(ch)) {
      var it = makeItem(Math.max(1, G.floor * 2 + irnd(-1, 3)), { luck: e.boss ? 3 : e.elite ? 1.6 : 1 });
      dropItem(e.x + rnd(-24, 24), e.y + rnd(-20, 20), it);
    }
  }
  if (e.boss) {
    G.boss = null;
    G.shake = 16;
    G.portal = { x: e.x, y: e.y, r: 34, t: 0 };
    addRing(e.x, e.y, 10, 260, 'rgba(120,170,255,', 7, 1.1);
    Sound.portal();
    banner('균열이 열렸다', 'NEXT DEPTH');
    setTimeout(function () { if (G.portal) G.portal.ready = true; }, 700);
    saveGame();
  }
}
function dropItem(x, y, it) {
  G.items.push({ x: x, y: y, it: it, t: 0, bob: Math.random() * 6.28 });
  if (it.rarity === 'legend') { Sound.legendary(); toast('전설 아이템이 떨어졌습니다!', 'leg'); }
}

function addXp(n) {
  var p = G.player;
  p.xp += n;
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level++;
    p.points += 3;
    p.xpNext = Math.round(60 * Math.pow(1.24, p.level - 1));
    if (G.autoStats) autoSpend(p);
    recalc(p);
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.35);
    p.mp = p.maxMp;
    Sound.levelup();
    banner('레벨 업', 'LEVEL ' + p.level);
    addRing(p.x, p.y, 8, 190, 'rgba(255,215,130,', 5, 0.9);
    burst(p.x, p.y, 26, '#ffd98a', 200, 3);
    var lf = $('lvlflash'); if (lf) { lf.style.opacity = '1'; setTimeout(function () { lf.style.opacity = '0'; }, 420); }
    saveGame();
  }
}
function autoSpend(p) {
  var C = CLASSES[p.cls], keys = Object.keys(C.autoStats);
  while (p.points > 0) {
    var r = Math.random(), acc = 0, k = keys[0];
    for (var i = 0; i < keys.length; i++) { acc += C.autoStats[keys[i]]; if (r <= acc) { k = keys[i]; break; } }
    p[k]++; p.points--;
  }
}

/* =====================================================================
   8. PLAYER ACTIONS
   ===================================================================== */
function basicAttack() {
  var p = G.player, C = CLASSES[p.cls], s = p.stats;
  p.atkCd = 1 / s.atkSpeed;
  var aim = aimDir();
  p.facing = aim;
  var ang = Math.atan2(aim.y, aim.x);
  if (p.cls === 'warrior') {
    Sound.swing();
    addSlash(p.x, p.y, ang, C.range + 18, 'rgba(255,226,180,');
    var hit = 0, arc = Math.PI * 0.95;
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (e.dead) continue;
      var d = dist(p.x, p.y, e.x, e.y);
      if (d > C.range + e.r) continue;
      var a = Math.atan2(e.y - p.y, e.x - p.x);
      var diff = Math.abs(((a - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff > arc / 2) continue;
      var r = playerDamage(1.0);
      damageEnemy(e, r.amount, r.crit, p.x, p.y, 130);
      onPlayerHit(e, r.amount);
      hit++;
    }
    if (hit) { G.hitStop = 0.035; G.shake = Math.max(G.shake, 2.4); }
  } else if (p.cls === 'mage') {
    Sound.shoot();
    spawnProj(p.x + aim.x * 18, p.y + aim.y * 18, aim.x, aim.y, 470, 1.05, {
      friendly: true, type: 'arcane', r: 6, color: '#8fb6ff', life: 1.1, glow: '#5f8cff'
    });
    burst(p.x + aim.x * 20, p.y + aim.y * 20, 3, '#9fc0ff', 80, 2);
  } else {
    Sound.shoot();
    spawnProj(p.x + aim.x * 18, p.y + aim.y * 18, aim.x, aim.y, 760, 1.0, {
      friendly: true, type: 'arrow', r: 5, color: '#e8dfc4', life: 0.9, ang: ang
    });
  }
}
function playerDamage(mult, bonus) {
  var p = G.player, s = p.stats;
  var d = s.atk * mult * rnd(0.92, 1.08) + (bonus || 0);
  if (p.buffT > 0) d *= 1.3;
  var crit = Math.random() * 100 < s.crit;
  if (crit) d *= 1.85;
  return { amount: d, crit: crit };
}
function onPlayerHit(e, amount) {
  var p = G.player, pw = p.stats.powers;
  if (p.stats.loh) healPlayer(p.stats.loh);
  if (pw.vamp) healPlayer(3);
  if (pw.ember && chance(0.25)) {
    explode(e.x, e.y, 78, amount * 0.8, '#ff9a3c');
  }
  if (pw.arc && chance(0.2)) {
    var t = null, bd = 260 * 260;
    for (var i = 0; i < G.enemies.length; i++) {
      var o = G.enemies[i];
      if (o.dead || o === e) continue;
      var d = dist2(e.x, e.y, o.x, o.y);
      if (d < bd) { bd = d; t = o; }
    }
    if (t) {
      G.effects.push({ type: 'line', x1: e.x, y1: e.y, x2: t.x, y2: t.y, color: 'rgba(140,190,255,', life: 0.2, maxLife: 0.2 });
      damageEnemy(t, amount * 0.6, false, e.x, e.y, 0);
      Sound.crit();
    }
  }
}
function explode(x, y, radius, dmg, color) {
  addRing(x, y, 6, radius, 'rgba(255,150,60,', 4, 0.4);
  burst(x, y, 16, color || '#ff9a3c', 260, 4);
  Sound.boom();
  for (var i = 0; i < G.enemies.length; i++) {
    var e = G.enemies[i];
    if (e.dead) continue;
    if (dist(x, y, e.x, e.y) < radius + e.r) damageEnemy(e, dmg, false, x, y, 90);
  }
}
function spawnProj(x, y, dx, dy, spd, mult, opt) {
  var p = G.player;
  var dmg = opt.friendly && mult ? p.stats.atk * mult * (p.buffT > 0 ? 1.3 : 1) : (opt.dmg || 0);
  var crit = opt.friendly ? (Math.random() * 100 < p.stats.crit) : false;
  if (crit) dmg *= 1.85;
  G.projectiles.push({
    x: x, y: y, vx: dx * spd, vy: dy * spd, r: opt.r || 6,
    dmg: dmg, friendly: !!opt.friendly, crit: crit,
    type: opt.type || 'bolt', color: opt.color || '#fff', glow: opt.glow || opt.color || '#fff',
    life: opt.life || 1.4, pierce: !!opt.pierce, hitList: [], ang: opt.ang != null ? opt.ang : Math.atan2(dy, dx),
    explodeR: opt.explodeR || 0, slow: opt.slow || 0, boss: !!opt.boss
  });
}
function doDash() {
  var p = G.player;
  if (!p || p.dead) return;
  if (p.dashCd > 0) { Sound.deny(); return; }
  var md = moveVec();
  var d = (md.mag > 0.2) ? { x: md.x, y: md.y } : p.facing;
  p.dashCd = (p.stats.powers.gale ? 1.75 : 2.5);
  p.dashT = 0.17; p.dashVX = d.x * 700; p.dashVY = d.y * 700;
  p.invuln = Math.max(p.invuln, 0.22);
  Sound.dash();
  for (var i = 0; i < 7; i++) {
    G.particles.push({ x: p.x - d.x * i * 5, y: p.y - d.y * i * 5 + rnd(-6, 6), vx: -d.x * 40, vy: -d.y * 40, life: 0.3, maxLife: 0.3, size: 5, color: 'rgba(180,160,130,', grav: 0 });
  }
}
function usePotion() {
  var p = G.player;
  if (!p || p.dead) return;
  if (p.potions <= 0) { toast('물약이 없습니다', 'warn'); Sound.deny(); return; }
  if (p.hp >= p.maxHp) { toast('생명력이 가득합니다'); return; }
  p.potions--;
  var heal = Math.round(p.maxHp * 0.45);
  healPlayer(heal);
  Sound.potion();
  addRing(p.x, p.y, 6, 60, 'rgba(210,60,50,', 3, 0.4);
  burst(p.x, p.y, 10, '#d24a3a', 90, 3);
}

function castSkill(i) {
  var p = G.player;
  if (!p || p.dead || G.state !== 'play') return;
  var C = CLASSES[p.cls], sk = C.skills[i];
  if (!sk) return;
  if (p.skillCd[i] > 0) { Sound.deny(); return; }
  if (p.mp < sk.mp) { toast('마나가 부족합니다', 'warn'); Sound.deny(); return; }
  p.mp -= sk.mp;
  p.skillCd[i] = sk.cd * (1 - p.stats.cdr / 100);
  var aim = aimDir(), ang = Math.atan2(aim.y, aim.x);
  p.facing = aim;

  if (sk.id === 'whirl') {
    p.spinT = 0.95; p.spinTick = 0;
    Sound.swing(); Sound.roar();
    addRing(p.x, p.y, 10, 110, 'rgba(220,120,60,', 4, 0.4);
  } else if (sk.id === 'leap') {
    var tgtE = nearestEnemy(p.x, p.y, 420);
    var d = tgtE ? Math.min(270, dist(p.x, p.y, tgtE.x, tgtE.y)) : 200;
    var tx = p.x + aim.x * d, ty = p.y + aim.y * d;
    p.leap = { sx: p.x, sy: p.y, tx: tx, ty: ty, t: 0, dur: 0.34 };
    p.invuln = Math.max(p.invuln, 0.4);
    Sound.dash();
    burst(p.x, p.y, 10, 'rgba(190,170,140,', 130, 4);
  } else if (sk.id === 'cry') {
    p.buffT = 12;
    Sound.roar();
    addRing(p.x, p.y, 10, 180, 'rgba(255,170,90,', 5, 0.8);
    burst(p.x, p.y, 22, '#ffb066', 180, 4);
    addFloat(p.x, p.y - 34, '전투 함성!', '#ffc078', 15);
  } else if (sk.id === 'fireball') {
    Sound.fire();
    spawnProj(p.x + aim.x * 20, p.y + aim.y * 20, aim.x, aim.y, 430, 2.2, {
      friendly: true, type: 'fireball', r: 11, color: '#ff8a2a', glow: '#ff5a10', life: 1.6, explodeR: 88
    });
  } else if (sk.id === 'nova') {
    Sound.frost();
    addRing(p.x, p.y, 10, 175, 'rgba(140,220,255,', 6, 0.55);
    burst(p.x, p.y, 30, '#a8e4ff', 260, 3);
    for (var i2 = 0; i2 < G.enemies.length; i2++) {
      var e2 = G.enemies[i2];
      if (e2.dead) continue;
      if (dist(p.x, p.y, e2.x, e2.y) < 175 + e2.r) {
        var r2 = playerDamage(1.4);
        damageEnemy(e2, r2.amount, r2.crit, p.x, p.y, 40);
        e2.slowT = 2.6;
        onPlayerHit(e2, r2.amount);
      }
    }
    G.shake = Math.max(G.shake, 5);
  } else if (sk.id === 'meteor') {
    var tE = nearestEnemy(p.x, p.y, 520);
    var md = tE ? Math.min(430, dist(p.x, p.y, tE.x, tE.y)) : 260;
    var mx = p.x + aim.x * md, my = p.y + aim.y * md;
    tele(mx, my, 150, 1.0, 'rgba(255,140,60,');
    addRing(mx, my, 20, 150, 'rgba(255,120,40,', 2, 1.0);
    Sound.roar();
    addDelay(1.0, function () {
      explode(mx, my, 155, playerDamageValue(4.2), '#ff8a3a');
      G.shake = 14; G.hitStop = 0.06;
      addRing(mx, my, 20, 210, 'rgba(255,180,80,', 8, 0.5);
    });
  } else if (sk.id === 'multi') {
    Sound.shoot();
    for (var k = -2; k <= 2; k++) {
      var a2 = ang + k * 0.13;
      spawnProj(p.x + Math.cos(a2) * 18, p.y + Math.sin(a2) * 18, Math.cos(a2), Math.sin(a2), 730, 0.85, {
        friendly: true, type: 'arrow', r: 5, color: '#e8dfc4', life: 0.85, ang: a2
      });
    }
  } else if (sk.id === 'pierce') {
    Sound.shoot(); Sound.crit();
    spawnProj(p.x + aim.x * 20, p.y + aim.y * 20, aim.x, aim.y, 1000, 2.6, {
      friendly: true, type: 'pierce', r: 7, color: '#d8f0b0', glow: '#9ad060', life: 1.0, pierce: true, ang: ang
    });
    G.shake = Math.max(G.shake, 3);
  } else if (sk.id === 'smoke') {
    var bd = { x: -aim.x, y: -aim.y };
    var sx = p.x, sy = p.y;
    for (var step = 0; step < 16; step++) {
      var nx = p.x + bd.x * 12, ny = p.y + bd.y * 12;
      if (collideCircle(nx, ny, p.r)) break;
      p.x = nx; p.y = ny;
    }
    p.invuln = Math.max(p.invuln, 1.2);
    p.hasteT = 1.4;
    Sound.dash();
    burst(sx, sy, 22, 'rgba(120,130,120,', 150, 6);
    addRing(sx, sy, 10, 70, 'rgba(140,150,140,', 4, 0.35);
    burst(p.x, p.y, 8, 'rgba(120,130,120,', 90, 5);
  }
}
function playerDamageValue(mult) {
  var p = G.player, s = p.stats;
  var d = s.atk * mult * rnd(0.95, 1.05);
  if (p.buffT > 0) d *= 1.3;
  if (Math.random() * 100 < s.crit) d *= 1.85;
  return d;
}

/* =====================================================================
   9. ENEMIES
   ===================================================================== */
function makeEnemy(typeKey, x, y, floor, elite) {
  var T = ETYPES[typeKey];
  var sc = 1 + (floor - 1) * 0.34;
  var e = {
    type: typeKey, name: T.name, x: x, y: y, r: T.r, kind: T.kind,
    hp: Math.round(T.hp * sc * (elite ? 2.8 : 1)), maxHp: 1,
    dmg: T.dmg * (1 + (floor - 1) * 0.22) * (elite ? 1.45 : 1),
    speed: T.speed * (elite ? 1.06 : 1), range: T.range, atkCd: rnd(0.3, 1), atkCdMax: T.cd,
    xp: T.xp * (1 + (floor - 1) * 0.5) * (elite ? 3 : 1),
    armor: T.kind === 'melee' && T.r > 18 ? 22 : 6,
    color: T.color, dark: T.dark, ghost: !!T.ghost, pspd: T.pspd || 240,
    elite: !!elite, boss: false, aggro: false, aggroT: 0, hitFlash: 0, slowT: 0,
    kx: 0, ky: 0, dead: false, deadT: 0, anim: Math.random() * 6.28, wander: 0, wanderA: Math.random() * 6.28,
    facing: 1
  };
  e.maxHp = e.hp;
  return e;
}
function makeBoss(x, y, floor) {
  var B = BOSSES[(floor - 1) % BOSSES.length];
  var sc = 1 + (floor - 1) * 0.5;
  var e = {
    type: 'boss', name: B.name, x: x, y: y, r: 34, kind: 'melee', boss: true,
    hp: Math.round(520 * sc), maxHp: 1, dmg: 20 * (1 + (floor - 1) * 0.22),
    speed: 62, range: 62, atkCd: 1.2, atkCdMax: 1.5, xp: 260 * (1 + (floor - 1) * 0.6),
    armor: 30, color: '#9a3d2e', dark: '#4a1a14', elite: false, aggro: true, aggroT: 999,
    hitFlash: 0, slowT: 0, kx: 0, ky: 0, dead: false, deadT: 0, anim: 0, facing: 1,
    abilityCd: 3.5, abilIdx: 0, phase: 1
  };
  e.maxHp = e.hp;
  return e;
}
function spawnFloorEnemies(floor) {
  var pool = ETYPE_BY_FLOOR[Math.min(3, Math.floor((floor - 1) / 3))];
  var bossRoom = G.bossRoom;
  for (var i = 0; i < G.rooms.length; i++) {
    var r = G.rooms[i];
    if (r === G.startRoom) continue;
    var count = r === bossRoom ? 3 : Math.max(2, Math.round(r.w * r.h / 26) + Math.floor(floor / 2));
    for (var j = 0; j < count; j++) {
      var tx = r.x + rnd(1.2, r.w - 1.2), ty = r.y + rnd(1.2, r.h - 1.2);
      var x = tx * TILE, y = ty * TILE;
      if (collideCircle(x, y, 16)) continue;
      if (dist(x, y, G.player.x, G.player.y) < 220) continue;
      var key = pick(pool);
      var elite = chance(0.09 + Math.min(0.1, floor * 0.01));
      var e = makeEnemy(key, x, y, floor, elite);
      G.enemies.push(e);
    }
  }
  // boss + guards
  var bx = bossRoom.cx * TILE + TILE / 2, by = bossRoom.cy * TILE + TILE / 2;
  var boss = makeBoss(bx, by, floor);
  G.enemies.push(boss); G.boss = boss;
  for (var g = 0; g < 2; g++) {
    var ga = g * Math.PI + 0.6;
    var ge = makeEnemy(pick(pool), bx + Math.cos(ga) * 90, by + Math.sin(ga) * 90, floor, true);
    if (collideCircle(ge.x, ge.y, ge.r)) { ge.x = bx + 60; ge.y = by + 60; }
    G.enemies.push(ge);
  }
}

function collideCircle(x, y, r) {
  var x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE);
  var y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
  for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) {
    if (tileAt(tx, ty) === 1) continue;
    var cx = clamp(x, tx * TILE, tx * TILE + TILE), cy = clamp(y, ty * TILE, ty * TILE + TILE);
    var dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}
function moveCircle(ent, dx, dy) {
  var r = ent.r;
  if (!collideCircle(ent.x + dx, ent.y, r)) ent.x += dx;
  else if (!collideCircle(ent.x + dx * 0.3, ent.y, r)) ent.x += dx * 0.3;
  if (!collideCircle(ent.x, ent.y + dy, r)) ent.y += dy;
  else if (!collideCircle(ent.x, ent.y + dy * 0.3, r)) ent.y += dy * 0.3;
}
function los(ax, ay, bx, by) {
  var d = dist(ax, ay, bx, by), steps = Math.ceil(d / 14);
  for (var i = 1; i < steps; i++) {
    var t = i / steps;
    if (isWallPx(lerp(ax, bx, t), lerp(ay, by, t))) return false;
  }
  return true;
}
function moveVec() {
  var p = G.player, jx = 0, jy = 0;
  if (G.joy.active) { jx = G.joy.dx * G.joy.mag; jy = G.joy.dy * G.joy.mag; }
  var kx = 0, ky = 0;
  if (G.keys['w'] || G.keys['arrowup']) ky -= 1;
  if (G.keys['s'] || G.keys['arrowdown']) ky += 1;
  if (G.keys['a'] || G.keys['arrowleft']) kx -= 1;
  if (G.keys['d'] || G.keys['arrowright']) kx += 1;
  if (kx || ky) { var n = nrm(kx, ky); return { x: n.x, y: n.y, mag: 1 }; }
  var m = Math.sqrt(jx * jx + jy * jy);
  if (m < 0.08) return { x: 0, y: 0, mag: 0 };
  return { x: jx / m, y: jy / m, mag: Math.min(1, m) };
}

function updateEnemy(e, dt) {
  if (e.dead) { e.deadT -= dt; return; }
  var p = G.player;
  e.anim += dt * 3;
  e.hitFlash = Math.max(0, e.hitFlash - dt);
  e.slowT = Math.max(0, e.slowT - dt);
  if (e.aggroT > 0) { e.aggroT -= dt; if (e.aggroT <= 0) e.aggro = false; }
  var d = dist(e.x, e.y, p.x, p.y);
  if (!e.aggro && d < 470) e.aggro = true;
  if (e.aggro) e.aggroT = Math.max(e.aggroT, 4);

  // knockback
  if (e.kx || e.ky) {
    moveCircle(e, e.kx * dt, e.ky * dt);
    e.kx *= Math.pow(0.02, dt); e.ky *= Math.pow(0.02, dt);
    if (Math.abs(e.kx) < 4) e.kx = 0;
    if (Math.abs(e.ky) < 4) e.ky = 0;
  }

  var spd = e.speed * (e.slowT > 0 ? 0.28 : 1);
  var dir = null;
  if (e.aggro) {
    if (e.kind === 'ranged' && !e.boss) {
      if (d > e.range * 0.92) dir = flowDir(e.x, e.y) || nrm(p.x - e.x, p.y - e.y);
      else if (d < e.range * 0.5) dir = nrm(e.x - p.x, e.y - p.y);
      else dir = null;
    } else if (e.boss) {
      if (d > e.range) dir = flowDir(e.x, e.y) || nrm(p.x - e.x, p.y - e.y);
      else dir = null;
    } else {
      if (d > e.range + e.r * 0.4) dir = flowDir(e.x, e.y) || nrm(p.x - e.x, p.y - e.y);
    }
  } else {
    e.wander -= dt;
    if (e.wander <= 0) { e.wander = rnd(1.5, 3.5); e.wanderA = Math.random() * 6.283; }
    dir = { x: Math.cos(e.wanderA) * 0.35, y: Math.sin(e.wanderA) * 0.35 };
  }
  if (dir) {
    var mvx = dir.x * spd * dt, mvy = dir.y * spd * dt;
    moveCircle(e, mvx, mvy);
    if (Math.abs(mvx) > 0.1) e.facing = mvx > 0 ? 1 : -1;
  }
  // separation
  for (var i = 0; i < G.enemies.length; i++) {
    var o = G.enemies[i];
    if (o === e || o.dead) continue;
    var dd = dist(e.x, e.y, o.x, o.y), min = e.r + o.r;
    if (dd > 0.01 && dd < min) {
      var push = (min - dd) * 0.5;
      var k = nrm(e.x - o.x, e.y - o.y);
      if (!collideCircle(e.x + k.x * push, e.y + k.y * push, e.r)) { e.x += k.x * push; e.y += k.y * push; }
    }
  }

  // attack
  e.atkCd -= dt;
  if (e.aggro && e.atkCd <= 0) {
    if (e.kind === 'ranged') {
      if (d < e.range && los(e.x, e.y, p.x, p.y)) {
        e.atkCd = e.atkCdMax * rnd(0.85, 1.15);
        var a = Math.atan2(p.y - e.y, p.x - e.x);
        spawnProj(e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, Math.cos(a), Math.sin(a), e.pspd, 0, {
          friendly: false, dmg: e.dmg, type: 'ebolt', r: 6, color: e.ghost ? '#9ee0d6' : '#e0603c', glow: '#d04020', life: 2.2
        });
        Sound.shoot();
      }
    } else if (d < e.range + e.r + p.r) {
      e.atkCd = e.atkCdMax * rnd(0.85, 1.15);
      e.lunge = 0.18;
      addSlash(lerp(e.x, p.x, 0.4), lerp(e.y, p.y, 0.4), Math.atan2(p.y - e.y, p.x - e.x), e.range * 0.8, 'rgba(230,120,90,');
      hurtPlayer(e.dmg, e.x, e.y);
    }
  }
  if (e.lunge > 0) e.lunge -= dt;

  // boss abilities
  if (e.boss) {
    e.abilityCd -= dt;
    if (e.abilityCd <= 0) {
      e.abilityCd = 5.2;
      var mode = e.abilIdx % 3;
      e.abilIdx++;
      if (mode === 0) {
        Sound.roar();
        addRing(e.x, e.y, e.r, e.r + 60, 'rgba(230,100,60,', 4, 0.4);
        for (var f = 0; f < 12; f++) {
          var fa = (f / 12) * 6.283 + e.anim * 0.1;
          spawnProj(e.x, e.y, Math.cos(fa), Math.sin(fa), 210, 0, {
            friendly: false, dmg: e.dmg * 0.55, type: 'ebolt', r: 7, color: '#e0703c', glow: '#ff6a20', life: 3.2, boss: true
          });
        }
      } else if (mode === 1) {
        var tx = p.x, ty = p.y;
        tele(tx, ty, 110, 0.9, 'rgba(255,90,50,');
        addDelay(0.9, function () {
          if (!e || e.dead) return;
          explode(tx, ty, 115, e.dmg * 1.4, '#e05030');
          G.shake = 9;
          if (dist(p.x, p.y, tx, ty) < 115) hurtPlayer(e.dmg * 1.5, tx, ty);
        });
      } else {
        Sound.roar();
        var pool2 = ETYPE_BY_FLOOR[Math.min(3, Math.floor((G.floor - 1) / 3))];
        for (var s2 = 0; s2 < 3; s2++) {
          var ang2 = s2 * 2.1 + 0.5;
          var mx = e.x + Math.cos(ang2) * 80, my = e.y + Math.sin(ang2) * 80;
          if (collideCircle(mx, my, 14)) { mx = e.x + 50; my = e.y; }
          G.enemies.push(makeEnemy(pick(pool2), mx, my, G.floor, false));
          addRing(mx, my, 4, 46, 'rgba(160,60,200,', 3, 0.4);
        }
      }
    }
  }
}

/* =====================================================================
   10. UPDATE
   ===================================================================== */
function updatePlayer(dt) {
  var p = G.player, C = CLASSES[p.cls];
  if (!p || p.dead) return;
  p.anim += dt;
  p.atkCd = Math.max(0, p.atkCd - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.buffT = Math.max(0, p.buffT - dt);
  p.hasteT = Math.max(0, p.hasteT - dt);
  for (var i = 0; i < 3; i++) p.skillCd[i] = Math.max(0, p.skillCd[i] - dt);
  p.mp = Math.min(p.maxMp, p.mp + (p.cls === 'mage' ? 9 : 7.5) * dt);

  // leap
  if (p.leap) {
    var L = p.leap;
    L.t += dt;
    var t = Math.min(1, L.t / L.dur);
    p.x = lerp(L.sx, L.tx, t); p.y = lerp(L.sy, L.ty, t);
    if (Math.random() < 0.6) G.particles.push({ x: p.x, y: p.y, vx: rnd(-30, 30), vy: rnd(-30, 30), life: 0.3, maxLife: 0.3, size: 4, color: 'rgba(200,160,110,', grav: 0 });
    if (t >= 1) {
      p.leap = null;
      var dmg = playerDamageValue(2.5);
      explode(p.x, p.y, 135, dmg, '#e0b070');
      G.shake = 12; G.hitStop = 0.05;
      addRing(p.x, p.y, 12, 150, 'rgba(220,170,110,', 7, 0.45);
      for (var k = 0; k < G.enemies.length; k++) {
        var e = G.enemies[k];
        if (!e.dead && dist(p.x, p.y, e.x, e.y) < 135 + e.r) damageEnemy(e, dmg * 0.5, false, p.x, p.y, 260);
      }
    }
    return;
  }
  // dash
  if (p.dashT > 0) {
    p.dashT -= dt;
    moveCircle(p, p.dashVX * dt, p.dashVY * dt);
    p.dashVX *= Math.pow(0.02, dt); p.dashVY *= Math.pow(0.02, dt);
    if (Math.random() < 0.8) G.particles.push({ x: p.x, y: p.y, vx: rnd(-20, 20), vy: rnd(-20, 20), life: 0.25, maxLife: 0.25, size: 5, color: 'rgba(190,170,140,', grav: 0 });
  } else {
    var mv = moveVec();
    p.moving = mv.mag > 0.06;
    if (p.moving) {
      var sp = p.stats.moveSpeed * (p.buffT > 0 ? 1.08 : 1) * (p.hasteT > 0 ? 1.4 : 1) * (p.spinT > 0 ? 0.5 : 1);
      moveCircle(p, mv.x * sp * dt * mv.mag, mv.y * sp * dt * mv.mag);
      if (!(G.mouse.has && !G.touchMode)) p.facing = { x: mv.x, y: mv.y };
      if (Math.random() < dt * 8) {
        G.particles.push({ x: p.x + rnd(-6, 6), y: p.y + p.r * 0.7, vx: rnd(-12, 12), vy: rnd(-16, -4), life: 0.35, maxLife: 0.35, size: 3, color: 'rgba(160,145,120,', grav: 0 });
      }
    }
  }
  // whirlwind ticks
  if (p.spinT > 0) {
    p.spinT -= dt;
    p.spinTick -= dt;
    if (p.spinTick <= 0) {
      p.spinTick = 0.125;
      addRing(p.x, p.y, 30, 108, 'rgba(255,220,170,', 2.5, 0.18);
      for (var j = 0; j < G.enemies.length; j++) {
        var en = G.enemies[j];
        if (en.dead) continue;
        if (dist(p.x, p.y, en.x, en.y) < 106 + en.r) {
          var r3 = playerDamage(0.48);
          damageEnemy(en, r3.amount, r3.crit, p.x, p.y, 60);
          onPlayerHit(en, r3.amount);
        }
      }
    }
  }
  // attack
  if (G.atkHeld && p.atkCd <= 0 && p.spinT <= 0) basicAttack();

  // loot pickup
  for (var ii = G.items.length - 1; ii >= 0; ii--) {
    var g = G.items[ii];
    if (g.t > 0.45 && dist(g.x, g.y, p.x, p.y) < 46) {
      if (addToBag(g.it)) {
        G.items.splice(ii, 1);
        Sound.equip();
        toastItem(g.it);
      }
    }
  }
  // portal
  if (G.portal && G.portal.ready && dist(p.x, p.y, G.portal.x, G.portal.y) < 46) {
    nextFloor();
  }
}

function updateProjectiles(dt) {
  var p = G.player;
  for (var i = G.projectiles.length - 1; i >= 0; i--) {
    var pr = G.projectiles[i];
    pr.life -= dt;
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    if (pr.type === 'arrow' || pr.type === 'pierce') pr.ang = Math.atan2(pr.vy, pr.vx);
    var dead = false;
    if (pr.life <= 0) dead = true;
    if (!dead && isWallPx(pr.x, pr.y)) {
      dead = true;
      if (pr.explodeR) { explode(pr.x, pr.y, pr.explodeR, pr.dmg, pr.glow); }
      else burst(pr.x, pr.y, 4, pr.color, 100, 2);
    }
    if (!dead && pr.friendly) {
      for (var j = 0; j < G.enemies.length; j++) {
        var e = G.enemies[j];
        if (e.dead || pr.hitList.indexOf(e) >= 0) continue;
        if (dist(pr.x, pr.y, e.x, e.y) < pr.r + e.r) {
          if (pr.explodeR) {
            dead = true;
            explode(pr.x, pr.y, pr.explodeR, pr.dmg, pr.glow);
            break;
          }
          damageEnemy(e, pr.dmg, pr.crit, pr.x - pr.vx * 0.02, pr.y - pr.vy * 0.02, 70);
          if (pr.friendly) onPlayerHit(e, pr.dmg);
          pr.hitList.push(e);
          if (!pr.pierce) { dead = true; break; }
        }
      }
    } else if (!dead && !pr.friendly) {
      if (!p.dead && dist(pr.x, pr.y, p.x, p.y) < pr.r + p.r) {
        hurtPlayer(pr.dmg, pr.x, pr.y);
        burst(pr.x, pr.y, 5, pr.color, 120, 3);
        dead = true;
      }
    }
    if (dead) G.projectiles.splice(i, 1);
  }
}
function updateItems(dt) {
  for (var i = 0; i < G.items.length; i++) { G.items[i].t += dt; G.items[i].bob += dt * 2; }
  if (G.portal) {
    G.portal.t += dt;
    if (Math.random() < dt * 14) {
      var a = Math.random() * 6.283, r = rnd(6, 34);
      G.particles.push({ x: G.portal.x + Math.cos(a) * r, y: G.portal.y + Math.sin(a) * r, vx: -Math.sin(a) * 40, vy: Math.cos(a) * 40 - 20, life: 0.8, maxLife: 0.8, size: 3, color: 'rgba(120,180,255,', grav: 0 });
    }
  }
}
function updateEffects(dt) {
  var i;
  for (i = G.effects.length - 1; i >= 0; i--) {
    var f = G.effects[i];
    f.life -= dt;
    if (f.type === 'ring') f.r = lerp(f.r0, f.r1, 1 - f.life / f.maxLife);
    if (f.life <= 0) G.effects.splice(i, 1);
  }
  for (i = G.particles.length - 1; i >= 0; i--) {
    var q = G.particles[i];
    q.life -= dt;
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.vy += (q.grav || 0) * dt;
    q.vx *= Math.pow(0.2, dt); q.vy *= Math.pow(0.2, dt);
    if (q.life <= 0) G.particles.splice(i, 1);
  }
  for (i = G.floats.length - 1; i >= 0; i--) {
    var fl = G.floats[i];
    fl.life -= dt;
    fl.y += fl.vy * dt;
    fl.vy += 60 * dt;
    if (fl.life <= 0) G.floats.splice(i, 1);
  }
  for (i = G.delayed.length - 1; i >= 0; i--) {
    G.delayed[i].t -= dt;
    if (G.delayed[i].t <= 0) {
      var fn = G.delayed[i].fn;
      G.delayed.splice(i, 1);
      try { fn(); } catch (err) { logErr(err.message); }
    }
  }
}

function step(dt) {
  G.time += dt;
  if (G.hitStop > 0) { G.hitStop -= dt; dt *= 0.3; }
  updatePlayer(dt);
  G.flowTimer -= dt;
  if (G.flowTimer <= 0) { G.flowTimer = 0.3; computeFlow(); }
  for (var i = 0; i < G.enemies.length; i++) updateEnemy(G.enemies[i], dt);
  for (var j = G.enemies.length - 1; j >= 0; j--) {
    if (G.enemies[j].dead && G.enemies[j].deadT <= 0) G.enemies.splice(j, 1);
  }
  updateProjectiles(dt);
  updateItems(dt);
  updateEffects(dt);
  camFollow(dt);
  G.shake = Math.max(0, G.shake - dt * 26);
  G.shakeX = G.shake > 0.2 ? rnd(-G.shake, G.shake) : 0;
  G.shakeY = G.shake > 0.2 ? rnd(-G.shake, G.shake) : 0;
  G.hintT = Math.max(0, G.hintT - dt);
  G.bannerT -= dt;
  if (G.bannerT <= 0) { var b = $('banner'); if (b) b.classList.remove('on'); }
  updateHUD();
  G.saveTimer += dt;
  if (G.saveTimer > 15 && G.state === 'play') { G.saveTimer = 0; saveGame(); }
}

/* =====================================================================
   11. FLOOR / PROGRESS
   ===================================================================== */
function enterFloor(floor) {
  G.floor = floor;
  G.theme = Math.min(THEMES.length - 1, Math.floor((floor - 1) / 3));
  var d = genDungeon(floor);
  G.map = d.map; G.rooms = d.rooms; G.startRoom = d.start; G.bossRoom = d.bossRoom; G.torches = d.torches;
  paintDungeon();
  var p = G.player;
  p.x = d.start.cx * TILE + TILE / 2;
  p.y = d.start.cy * TILE + TILE / 2;
  p.leap = null; p.dashT = 0;
  G.enemies = []; G.projectiles = []; G.items = []; G.particles = []; G.floats = []; G.effects = []; G.delayed = [];
  G.portal = null; G.boss = null;
  spawnFloorEnemies(floor);
  computeFlow();
  G.zoom = clamp(Math.max(G.view.h / 440, G.view.w / 1500), 0.8, 1.4);
  G.cam.x = clamp(p.x - G.view.w / G.zoom / 2, 0, Math.max(0, MAPW * TILE - G.view.w / G.zoom));
  G.cam.y = clamp(p.y - G.view.h / G.zoom / 2, 0, Math.max(0, MAPH * TILE - G.view.h / G.zoom));
  banner(floor + '층', THEMES[G.theme].name);
  updateBossBar();
}
function nextFloor() {
  var p = G.player;
  p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.35);
  p.mp = p.maxMp;
  p.potions = Math.min(9, p.potions + 1);
  enterFloor(G.floor + 1);
  saveGame();
  Sound.portal();
}
function newGame(clsId) {
  G.player = makePlayer(clsId);
  G.floor = 1;
  G.delayed = [];
  G.items = []; G.enemies = []; G.projectiles = [];
  G.state = 'play';
  G.sel = null;
  buildActions();
  enterFloor(1);
  G.player.hp = G.player.maxHp;
  G.player.mp = G.player.maxMp;
  saveGame();
  hideAllScreens();
  showHUD(true);
  Sound.resume();
  toast(G.touchMode ? '왼쪽 화면 터치로 이동 · 오른쪽 버튼으로 공격' : 'WASD 이동 · J 공격 · 1/2/3 스킬', '');
  if (!G.touchMode) toast('E 가방 · Shift 대시 · Q 물약', '');
}
function revive() {
  var p = G.player;
  p.dead = false;
  p.gold = Math.floor(p.gold * 0.5);
  p.hp = Math.round(p.maxHp * 0.6);
  p.mp = p.maxMp;
  p.invuln = 2;
  G.state = 'play';
  enterFloor(G.floor);
  hideAllScreens();
  saveGame();
}

/* =====================================================================
   12. SAVE
   ===================================================================== */
var SAVE_KEY = 'shadowcrypt_save_v1';
function saveGame() {
  if (!G.player) return;
  try {
    var p = G.player;
    var data = {
      v: 1, ts: Date.now(), floor: G.floor, cls: p.cls,
      level: p.level, xp: p.xp, xpNext: p.xpNext,
      str: p.str, dex: p.dex, vit: p.vit, int: p.int, points: p.points,
      hp: p.hp, mp: p.mp, equip: p.equip, bag: p.bag,
      gold: p.gold, potions: p.potions, kills: p.kills,
      autoStats: G.autoStats, muted: G.muted
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* storage may be blocked */ }
}
function loadSave() {
  try { var s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } }
function continueGame(sv) {
  G.autoStats = sv.autoStats !== false;
  G.muted = !!sv.muted;
  Sound.setMuted(G.muted); syncMuteBtn();
  var p = makePlayer(CLASSES[sv.cls] ? sv.cls : 'warrior');
  p.level = sv.level || 1; p.xp = sv.xp || 0; p.xpNext = sv.xpNext || 60;
  p.str = sv.str; p.dex = sv.dex; p.vit = sv.vit; p.int = sv.int; p.points = sv.points || 0;
  p.equip = sv.equip || p.equip;
  p.bag = sv.bag || [];
  p.gold = sv.gold || 0; p.potions = sv.potions != null ? sv.potions : 3;
  p.kills = sv.kills || 0;
  recalc(p);
  p.hp = clamp(sv.hp || p.maxHp, 1, p.maxHp);
  p.mp = clamp(sv.mp || p.maxMp, 0, p.maxMp);
  G.player = p;
  G.floor = sv.floor || 1;
  G.state = 'play';
  buildActions();
  enterFloor(G.floor);
  hideAllScreens();
  showHUD(true);
  Sound.resume();
  var mx = 1;
  function scan(list) { for (var i = 0; i < list.length; i++) if (list[i] && list[i].uid > mx) mx = list[i].uid; }
  scan(p.bag);
  for (var k in p.equip) if (p.equip[k]) mx = Math.max(mx, p.equip[k].uid);
  UID = mx + 1;
  toast('이어서 시작합니다 · ' + G.floor + '층');
}

/* =====================================================================
   13. RENDER
   ===================================================================== */
function render() {
  var v = G.view;
  ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
  ctx.clearRect(0, 0, v.w, v.h);
  ctx.fillStyle = THEMES[G.theme].fog;
  ctx.fillRect(0, 0, v.w, v.h);
  if (!G.map || !G.player) return;

  ctx.setTransform(v.dpr * G.zoom, 0, 0, v.dpr * G.zoom, (-G.cam.x + G.shakeX) * G.zoom * v.dpr, (-G.cam.y + G.shakeY) * G.zoom * v.dpr);

  // static dungeon (only the visible slice)
  if (G.staticCanvas) {
    var sw = v.w / G.zoom + 64, sh = v.h / G.zoom + 64;
    var sx0 = Math.max(0, Math.floor(G.cam.x - G.shakeX - 32)), sy0 = Math.max(0, Math.floor(G.cam.y - G.shakeY - 32));
    var sx1 = Math.min(G.staticCanvas.width, Math.ceil(G.cam.x - G.shakeX + sw)), sy1 = Math.min(G.staticCanvas.height, Math.ceil(G.cam.y - G.shakeY + sh));
    if (sx1 > sx0 && sy1 > sy0) ctx.drawImage(G.staticCanvas, sx0, sy0, sx1 - sx0, sy1 - sy0, sx0, sy0, sx1 - sx0, sy1 - sy0);
  }

  drawTorches();
  drawPortal();
  drawGroundItems();

  // under-entity effects
  for (var i = 0; i < G.effects.length; i++) drawEffect(G.effects[i], true);
  drawParticles();

  // entities sorted by depth
  var list = [];
  for (var j = 0; j < G.enemies.length; j++) if (!G.enemies[j].dead) list.push(G.enemies[j]);
  if (!G.player.dead) list.push(G.player);
  list.sort(function (a, b) { return a.y - b.y; });
  for (var k = 0; k < list.length; k++) {
    if (list[k] === G.player) drawPlayer(); else drawEnemy(list[k]);
  }
  for (var d = 0; d < G.enemies.length; d++) if (G.enemies[d].dead) drawEnemyCorpse(G.enemies[d]);

  drawProjectiles();
  for (var e2 = 0; e2 < G.effects.length; e2++) if (!G.effects[e2].under) drawEffect(G.effects[e2], false);

  drawLighting();
  drawFloats();

  // ---- screen space ----
  ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
  drawJoystick();
  drawLowHp();
  drawMinimap();
}

function drawTorches() {
  var th = THEMES[G.theme];
  for (var i = 0; i < G.torches.length; i++) {
    var t = G.torches[i];
    var flick = 0.75 + Math.sin(G.time * 9 + t.phase) * 0.15 + Math.sin(G.time * 23 + t.phase * 2) * 0.08;
    // sconce
    ctx.fillStyle = '#1a1512';
    ctx.fillRect(t.x - 2, t.y - 6, 4, 12);
    // flame
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(t.x, t.y - 8, 0, t.x, t.y - 8, 26 * flick);
    g.addColorStop(0, 'rgba(255,225,170,0.95)');
    g.addColorStop(0.35, 'rgba(255,150,60,0.55)');
    g.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(t.x, t.y - 8, 26 * flick, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(255,235,190,0.95)';
    ctx.beginPath();
    ctx.moveTo(t.x - 3, t.y - 2);
    ctx.quadraticCurveTo(t.x - 5, t.y - 12, t.x, t.y - 18 * flick);
    ctx.quadraticCurveTo(t.x + 5, t.y - 12, t.x + 3, t.y - 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawGroundItems() {
  for (var i = 0; i < G.items.length; i++) {
    var g = G.items[i], it = g.it, R = RARITY[it.rarity];
    var bob = Math.sin(g.bob) * 3;
    var pulse = 0.75 + Math.sin(g.bob * 1.6) * 0.25;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var lg = ctx.createLinearGradient(0, g.y - 54, 0, g.y + 6);
    lg.addColorStop(0, R.glow + '0)');
    lg.addColorStop(0.5, R.glow + (0.20 * pulse) + ')');
    lg.addColorStop(1, R.glow + (0.55 * pulse) + ')');
    ctx.fillStyle = lg;
    ctx.fillRect(g.x - 9, g.y - 54, 18, 60);
    var rg = ctx.createRadialGradient(g.x, g.y - 6, 0, g.x, g.y - 6, 30);
    rg.addColorStop(0, R.glow + (0.35 * pulse) + ')');
    rg.addColorStop(1, R.glow + '0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(g.x, g.y - 6, 30, 0, 6.283); ctx.fill();
    ctx.restore();
    // item glyph
    ctx.save();
    ctx.translate(g.x, g.y - 12 + bob);
    ctx.rotate(Math.sin(g.bob * 0.7) * 0.12);
    ctx.fillStyle = R.c;
    ctx.strokeStyle = 'rgba(0,0,0,.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (it.slot === 'weapon') { ctx.rect(-2.5, -10, 5, 18); ctx.fill(); ctx.beginPath(); ctx.rect(-6, 6, 12, 3); ctx.fill(); }
    else if (it.slot === 'armor') { ctx.moveTo(0, -10); ctx.lineTo(9, -4); ctx.lineTo(7, 9); ctx.lineTo(-7, 9); ctx.lineTo(-9, -4); ctx.closePath(); ctx.fill(); }
    else if (it.slot === 'ring') { ctx.arc(0, 0, 7, 0, 6.283); ctx.lineWidth = 3; ctx.strokeStyle = R.c; ctx.stroke(); }
    else { ctx.arc(0, -3, 5, 0, 6.283); ctx.fill(); ctx.beginPath(); ctx.moveTo(-3, 2); ctx.lineTo(0, 9); ctx.lineTo(3, 2); ctx.fill(); }
    ctx.restore();
    var dd = dist(g.x, g.y, G.player.x, G.player.y);
    if (dd < 150) {
      ctx.font = '600 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,.65)';
      ctx.fillText(it.name, g.x + 1, g.y - 46 + bob + 1);
      ctx.fillStyle = R.c;
      ctx.fillText(it.name, g.x, g.y - 46 + bob);
    }
  }
}

function drawPortal() {
  var P = G.portal;
  if (!P) return;
  var t = P.t;
  ctx.save();
  ctx.translate(P.x, P.y);
  var g = ctx.createRadialGradient(0, 0, 2, 0, 0, 62);
  g.addColorStop(0, 'rgba(190,225,255,0.9)');
  g.addColorStop(0.3, 'rgba(90,150,255,0.5)');
  g.addColorStop(0.75, 'rgba(60,80,220,0.18)');
  g.addColorStop(1, 'rgba(30,40,140,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 0, 30 + Math.sin(t * 3) * 2, 50, 0, 0, 6.283); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  for (var i = 0; i < 3; i++) {
    ctx.strokeStyle = 'rgba(150,200,255,' + (0.5 - i * 0.12) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 20 + i * 9 + Math.sin(t * 2 + i) * 2, 34 + i * 12, t * (0.6 + i * 0.3), 0, 6.283);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles() {
  for (var i = 0; i < G.particles.length; i++) {
    var q = G.particles[i];
    var a = clamp(q.life / q.maxLife, 0, 1);
    ctx.fillStyle = q.color + (a * 0.9) + ')';
    ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size * 0.9);
  }
}
function drawEffect(f, under) {
  var t = clamp(f.life / f.maxLife, 0, 1);
  ctx.save();
  if (f.type === 'ring') {
    ctx.strokeStyle = f.color + (t * 0.9) + ')';
    ctx.lineWidth = f.width * (0.4 + t * 0.6);
    ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(1, f.r), 0, 6.283); ctx.stroke();
  } else if (f.type === 'slash') {
    ctx.translate(f.x, f.y);
    ctx.rotate(f.ang);
    ctx.strokeStyle = f.color + (t * 0.95) + ')';
    ctx.lineWidth = 7 * t + 2;
    ctx.beginPath();
    ctx.arc(0, 0, f.r * (1.15 - t * 0.15), -0.85, 0.85);
    ctx.stroke();
    ctx.strokeStyle = f.color + (t * 0.35) + ')';
    ctx.lineWidth = 16 * t;
    ctx.beginPath(); ctx.arc(0, 0, f.r * 0.82, -0.7, 0.7); ctx.stroke();
  } else if (f.type === 'tele') {
    var p2 = 1 - t;
    ctx.fillStyle = f.color + (0.10 + 0.1 * Math.sin(G.time * 18)) + ')';
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
    ctx.strokeStyle = f.color + '0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, -1.57, -1.57 + 6.283 * p2); ctx.stroke();
  } else if (f.type === 'line') {
    ctx.strokeStyle = f.color + (t * 0.9) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(f.x1, f.y1);
    var mx = (f.x1 + f.x2) / 2 + rnd(-16, 16), my = (f.y1 + f.y2) / 2 + rnd(-16, 16);
    ctx.lineTo(mx, my); ctx.lineTo(f.x2, f.y2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,' + (t * 0.6) + ')';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------------- player ---------------- */
function drawPlayer() {
  var p = G.player, C = CLASSES[p.cls];
  var bob = p.moving ? Math.sin(p.anim * 13) * 1.8 : Math.sin(p.anim * 2.2) * 0.9;
  var x = p.x, y = p.y + bob;
  ctx.save();
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 12, 13, 5.5, 0, 0, 6.283); ctx.fill();
  // buff aura
  if (p.buffT > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var ag = ctx.createRadialGradient(x, y, 4, x, y, 34);
    ag.addColorStop(0, 'rgba(255,150,60,0.22)');
    ag.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(x, y, 34, 0, 6.283); ctx.fill();
    ctx.restore();
  }
  if (p.invuln > 0 && Math.floor(G.time * 20) % 2 === 0) ctx.globalAlpha = 0.55;

  var fx = p.facing.x < 0 ? -1 : 1;
  ctx.translate(x, y);
  ctx.scale(fx, 1);
  var col = C.color, dark = shade(col, -0.55), light = shade(col, 0.35);

  // cape
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(-9, -12);
  ctx.quadraticCurveTo(-15, 4, -11, 15);
  ctx.lineTo(11, 15);
  ctx.quadraticCurveTo(15, 4, 9, -12);
  ctx.closePath();
  ctx.fill();
  // body
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-8, -12);
  ctx.quadraticCurveTo(0, -16, 8, -12);
  ctx.lineTo(7, 10);
  ctx.quadraticCurveTo(0, 13, -7, 10);
  ctx.closePath();
  ctx.fill();
  // belt
  ctx.fillStyle = 'rgba(30,22,16,.85)';
  ctx.fillRect(-7, 4, 14, 3.5);
  ctx.fillStyle = '#d9b479';
  ctx.fillRect(-1.5, 4, 3, 3.5);
  // head / hood
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.arc(0, -16, 8.6, 0, 6.283); ctx.fill();
  ctx.fillStyle = light;
  ctx.beginPath(); ctx.arc(0, -15.4, 6.4, Math.PI * 0.05, Math.PI * 0.95, true); ctx.fill();
  // face shadow + eyes
  ctx.fillStyle = 'rgba(8,6,10,.9)';
  ctx.beginPath(); ctx.ellipse(1.2, -14.5, 4.6, 4.2, 0, 0, 6.283); ctx.fill();
  ctx.fillStyle = p.cls === 'mage' ? '#9fc6ff' : p.cls === 'ranger' ? '#a8e090' : '#ffb070';
  ctx.beginPath(); ctx.arc(0.6, -14.8, 1.05, 0, 6.283); ctx.arc(3.4, -14.8, 1.05, 0, 6.283); ctx.fill();

  // weapon
  ctx.save();
  if (p.spinT > 0) {
    ctx.translate(0, -2);
    ctx.rotate(p.anim * 26);
    ctx.strokeStyle = 'rgba(240,235,215,.95)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(20, 0); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,190,120,.5)';
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(18, 0); ctx.stroke();
  } else if (p.cls === 'warrior') {
    ctx.translate(7, 0);
    ctx.rotate(-0.5 + Math.sin(p.anim * 6) * 0.05);
    ctx.fillStyle = '#cfc8b6';
    ctx.fillRect(-1.6, -20, 3.2, 22);
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(-4, 1, 8, 3);
    ctx.fillRect(-1.2, 4, 2.4, 5);
  } else if (p.cls === 'mage') {
    ctx.translate(8, 2);
    ctx.rotate(0.12);
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(-1.5, -22, 3, 26);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var og = ctx.createRadialGradient(0, -24, 0, 0, -24, 12);
    og.addColorStop(0, 'rgba(160,205,255,0.95)');
    og.addColorStop(1, 'rgba(80,120,255,0)');
    ctx.fillStyle = og; ctx.beginPath(); ctx.arc(0, -24, 12, 0, 6.283); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#cfe4ff';
    ctx.beginPath(); ctx.arc(0, -24, 3.2, 0, 6.283); ctx.fill();
  } else {
    ctx.translate(8, 0);
    ctx.strokeStyle = '#7a5a34';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(0, -4, 11, -1.15, 1.15); ctx.stroke();
    ctx.strokeStyle = 'rgba(230,225,205,.7)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(4.4, -13.5); ctx.lineTo(4.4, 5.5); ctx.stroke();
  }
  ctx.restore();
  ctx.restore();

  // aim/facing tick
  if (!p.dead) {
    var aim = aimDir();
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = p.cls === 'mage' ? 'rgba(140,180,255,' : p.cls === 'ranger' ? 'rgba(170,220,150,' : 'rgba(255,200,150,';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    var aa = Math.atan2(aim.y, aim.x);
    ctx.arc(p.x, p.y, 24, aa - 0.28, aa + 0.28);
    ctx.stroke();
    ctx.restore();
  }
}

function drawEnemy(e) {
  var x = e.x, y = e.y;
  var bob = Math.sin(e.anim) * (e.ghost ? 3 : 1.4);
  var fx = e.facing < 0 ? -1 : 1;
  ctx.save();
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.beginPath(); ctx.ellipse(x, y + e.r * 0.75, e.r * 0.85, e.r * 0.32, 0, 0, 6.283); ctx.fill();
  // elite aura
  if (e.elite || e.boss) {
    var col = e.boss ? 'rgba(220,70,40,' : 'rgba(240,200,80,';
    var pl = 0.45 + Math.sin(G.time * 4 + e.anim) * 0.2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var eg = ctx.createRadialGradient(x, y, e.r * 0.5, x, y, e.r * 2.2);
    eg.addColorStop(0, col + (pl * 0.35) + ')');
    eg.addColorStop(1, col + '0)');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(x, y, e.r * 2.2, 0, 6.283); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = col + (pl * 0.7) + ')';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(x, y + e.r * 0.7, e.r * 1.1, e.r * 0.45, 0, 0, 6.283); ctx.stroke();
  }
  if (e.ghost) ctx.globalAlpha = 0.78;
  if (e.slowT > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var fg = ctx.createRadialGradient(x, y, 2, x, y, e.r * 1.9);
    fg.addColorStop(0, 'rgba(150,220,255,0.28)');
    fg.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x, y, e.r * 1.9, 0, 6.283); ctx.fill();
    ctx.restore();
  }
  ctx.translate(x, y + bob);
  ctx.scale(fx, 1);
  var body = e.hitFlash > 0 ? '#ffffff' : e.color;
  var dark = e.hitFlash > 0 ? '#ffffff' : e.dark;

  if (e.boss) {
    // big horned demon
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-26, 16); ctx.quadraticCurveTo(-30, -14, -16, -22);
    ctx.lineTo(16, -22); ctx.quadraticCurveTo(30, -14, 26, 16);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, -2, 17, 20, 0, 0, 6.283); ctx.fill();
    // chest rune
    ctx.fillStyle = 'rgba(255,180,90,.9)';
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, 6.283); ctx.fill();
    // head
    ctx.fillStyle = '#2a1512';
    ctx.beginPath(); ctx.arc(0, -26, 11, 0, 6.283); ctx.fill();
    // horns
    ctx.strokeStyle = '#d8c8a8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-8, -32); ctx.quadraticCurveTo(-18, -42, -12, -48); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, -32); ctx.quadraticCurveTo(18, -42, 12, -48); ctx.stroke();
    // eyes
    ctx.fillStyle = '#ff7a30';
    ctx.beginPath(); ctx.arc(-4, -26, 2.2, 0, 6.283); ctx.arc(4, -26, 2.2, 0, 6.283); ctx.fill();
    // arms
    ctx.strokeStyle = dark; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-16, -8); ctx.lineTo(-26, 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(16, -8); ctx.lineTo(26, 8); ctx.stroke();
  } else if (e.type === 'skeleton') {
    ctx.strokeStyle = dark; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-7, 4); ctx.lineTo(-9, 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(7, 4); ctx.lineTo(9, 14); ctx.stroke();
    ctx.strokeStyle = body; ctx.lineWidth = 3;
    for (var r = 0; r < 3; r++) { ctx.beginPath(); ctx.arc(0, -6 + r * 4, 6 - r * 0.6, 0.25, Math.PI - 0.25); ctx.stroke(); }
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(0, -14, 7, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#15110f';
    ctx.beginPath(); ctx.arc(-2.4, -15, 1.9, 0, 6.283); ctx.arc(2.4, -15, 1.9, 0, 6.283); ctx.fill();
    ctx.fillStyle = e.elite ? '#ffcf5a' : '#ff8a50';
    ctx.beginPath(); ctx.arc(-2.4, -15, 0.9, 0, 6.283); ctx.arc(2.4, -15, 0.9, 0, 6.283); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(-14, 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, -6); ctx.lineTo(14, 2); ctx.stroke();
  } else if (e.type === 'brute') {
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(0, 2, 20, 18, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 15, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#2a1712';
    ctx.beginPath(); ctx.arc(0, -14, 8, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#c8b490'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-6, -19); ctx.quadraticCurveTo(-11, -24, -9, -27); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6, -19); ctx.quadraticCurveTo(11, -24, 9, -27); ctx.stroke();
    ctx.fillStyle = '#ff6a30';
    ctx.beginPath(); ctx.arc(-3, -14, 1.7, 0, 6.283); ctx.arc(3, -14, 1.7, 0, 6.283); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-15, -4); ctx.lineTo(-21, 9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(15, -4); ctx.lineTo(21, 9); ctx.stroke();
  } else if (e.type === 'wraith') {
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-10, -12);
    ctx.quadraticCurveTo(-14, 6, -6, 16);
    ctx.quadraticCurveTo(0, 10, 6, 16);
    ctx.quadraticCurveTo(14, 6, 10, -12);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(0, -12, 9, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(190,255,245,.95)';
    ctx.beginPath(); ctx.arc(-3, -13, 2.1, 0, 6.283); ctx.arc(3, -13, 2.1, 0, 6.283); ctx.fill();
  } else {
    // cultist / boneshot: hooded
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-11, 13); ctx.quadraticCurveTo(-12, -12, 0, -20);
    ctx.quadraticCurveTo(12, -12, 11, 13);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-8, 12); ctx.quadraticCurveTo(-8, -10, 0, -16);
    ctx.quadraticCurveTo(8, -10, 8, 12);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0a0808';
    ctx.beginPath(); ctx.ellipse(0, -13, 5.4, 5.8, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = e.type === 'boneshot' ? '#c9e39a' : '#ff5a3a';
    ctx.beginPath(); ctx.arc(-2, -13, 1.3, 0, 6.283); ctx.arc(2, -13, 1.3, 0, 6.283); ctx.fill();
    if (e.type === 'boneshot') {
      ctx.strokeStyle = '#cbbf9e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(10, -8); ctx.lineTo(20, -14); ctx.stroke();
    }
  }
  ctx.restore();

  // hp bar
  if (!e.boss && (e.hp < e.maxHp || e.elite)) {
    var w = e.elite ? 40 : 30, hh = 3.4;
    var bx = x - w / 2, by = y - e.r - (e.elite ? 20 : 14);
    ctx.fillStyle = 'rgba(0,0,0,.7)';
    ctx.fillRect(bx - 1, by - 1, w + 2, hh + 2);
    ctx.fillStyle = e.elite ? '#e8c85a' : '#c23a2a';
    ctx.fillRect(bx, by, w * clamp(e.hp / e.maxHp, 0, 1), hh);
  }
}
function drawEnemyCorpse(e) {
  var a = clamp(e.deadT / 0.5, 0, 1);
  ctx.save();
  ctx.globalAlpha = a * 0.7;
  ctx.fillStyle = e.dark;
  ctx.beginPath(); ctx.ellipse(e.x, e.y + 6, e.r * (1 + (1 - a) * 0.4), e.r * 0.45, 0, 0, 6.283); ctx.fill();
  ctx.restore();
}
function drawProjectiles() {
  for (var i = 0; i < G.projectiles.length; i++) {
    var p = G.projectiles[i];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3.4);
    g.addColorStop(0, p.glow);
    g.addColorStop(0.4, p.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3.4, 0, 6.283); ctx.fill();
    ctx.restore();
    if (p.type === 'arrow' || p.type === 'pierce') {
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.ang);
      ctx.strokeStyle = p.type === 'pierce' ? '#c8e8a0' : '#e6dcc0';
      ctx.lineWidth = p.type === 'pierce' ? 3.5 : 2;
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(8, 0); ctx.stroke();
      ctx.restore();
    } else {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.6, 0, 6.283); ctx.fill();
    }
  }
}
function drawFloats() {
  ctx.textAlign = 'center';
  for (var i = 0; i < G.floats.length; i++) {
    var f = G.floats[i];
    var a = clamp(f.life / f.maxLife, 0, 1);
    var yy = f.y - (1 - a) * 16;
    ctx.globalAlpha = a;
    ctx.font = (f.crit ? '800 ' : '600 ') + f.size + 'px "Noto Sans KR",sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,.75)';
    ctx.fillText(f.text, f.x + 1.5, yy + 1.5);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, yy);
    if (f.crit) {
      ctx.strokeStyle = 'rgba(255,180,60,.8)';
      ctx.lineWidth = 0.8;
      ctx.strokeText(f.text, f.x, yy);
    }
  }
  ctx.globalAlpha = 1;
}

/* ---------------- lighting ---------------- */
function drawLighting() {
  var v = G.view, lc = G.lightCtx;
  if (!lc) return;
  var lcv = G.lightCanvas;
  var dpr = G.view.dpr;
  var W = lcv.width, H = lcv.height;
  lc.setTransform(1, 0, 0, 1, 0, 0);
  lc.clearRect(0, 0, W, H);
  lc.fillStyle = 'rgba(4,4,8,0.88)';
  lc.fillRect(0, 0, W, H);
  lc.globalCompositeOperation = 'destination-out';
  function hole(sx, sy, rad, strength) {
    var g = lc.createRadialGradient(sx, sy, rad * 0.06, sx, sy, rad);
    g.addColorStop(0, 'rgba(0,0,0,' + strength + ')');
    g.addColorStop(0.45, 'rgba(0,0,0,' + (strength * 0.82) + ')');
    g.addColorStop(0.78, 'rgba(0,0,0,' + (strength * 0.35) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    lc.fillStyle = g;
    lc.beginPath(); lc.arc(sx, sy, rad, 0, 6.283); lc.fill();
  }
  var p = G.player;
  var ps = worldToScreen(p.x, p.y);
  var pr = (300 + Math.sin(G.time * 2) * 6) * G.zoom * (p.buffT > 0 ? 1.12 : 1);
  hole(ps.x * dpr, ps.y * dpr, pr * dpr, 0.97);
  for (var i = 0; i < G.torches.length; i++) {
    var t = G.torches[i];
    var s = worldToScreen(t.x, t.y);
    if (s.x < -160 || s.y < -160 || s.x > v.w + 160 || s.y > v.h + 160) continue;
    var fl = 0.85 + Math.sin(G.time * 8 + t.phase) * 0.13;
    hole(s.x * dpr, s.y * dpr, 175 * G.zoom * fl * dpr, 0.8);
  }
  for (var j = 0; j < G.projectiles.length; j++) {
    var q = G.projectiles[j], qs = worldToScreen(q.x, q.y);
    hole(qs.x * dpr, qs.y * dpr, 70 * G.zoom * dpr, 0.5);
  }
  if (G.portal) {
    var o = worldToScreen(G.portal.x, G.portal.y);
    hole(o.x * dpr, o.y * dpr, 200 * G.zoom * dpr, 0.75);
  }
  for (var k = 0; k < G.items.length; k++) {
    var it = worldToScreen(G.items[k].x, G.items[k].y);
    if (it.x < -60 || it.x > v.w + 60 || it.y < -60 || it.y > v.h + 60) continue;
    hole(it.x * dpr, it.y * dpr, 60 * G.zoom * dpr, 0.4);
  }
  lc.globalCompositeOperation = 'source-over';

  ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
  ctx.drawImage(lcv, 0, 0, v.w, v.h);

  // warm additive glow
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (var m = 0; m < G.torches.length; m++) {
    var t2 = G.torches[m], s2 = worldToScreen(t2.x, t2.y);
    if (s2.x < -120 || s2.y < -120 || s2.x > v.w + 120 || s2.y > v.h + 120) continue;
    var fl2 = 0.85 + Math.sin(G.time * 8 + t2.phase) * 0.15;
    var g2 = ctx.createRadialGradient(s2.x, s2.y, 0, s2.x, s2.y, 120 * G.zoom * fl2);
    g2.addColorStop(0, 'rgba(255,160,70,0.10)');
    g2.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(s2.x, s2.y, 120 * G.zoom * fl2, 0, 6.283); ctx.fill();
  }
  ctx.restore();

  // restore world transform for the next passes
  ctx.setTransform(v.dpr * G.zoom, 0, 0, v.dpr * G.zoom, (-G.cam.x + G.shakeX) * G.zoom * v.dpr, (-G.cam.y + G.shakeY) * G.zoom * v.dpr);
}

function drawMinimap() {
  if (!mctx) return;
  var S = minimap.width;
  mctx.clearRect(0, 0, S, S);
  mctx.fillStyle = '#08070b';
  mctx.fillRect(0, 0, S, S);
  if (!G.map) return;
  var cell = S / MAPW;
  for (var y = 0; y < MAPH; y++) {
    for (var x = 0; x < MAPW; x++) {
      if (G.map[y * MAPW + x] !== 1) continue;
      var near = false;
      if (tileAt(x, y - 1) === 0 || tileAt(x - 1, y) === 0 || tileAt(x, y + 1) === 0 || tileAt(x + 1, y) === 0) near = true;
      mctx.fillStyle = near ? 'rgba(120,105,80,.55)' : 'rgba(84,76,60,.4)';
      mctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5);
    }
  }
  for (var i = 0; i < G.items.length; i++) {
    var g = G.items[i], R = RARITY[g.it.rarity];
    mctx.fillStyle = R.c;
    mctx.fillRect(g.x / TILE * cell - 1, g.y / TILE * cell - 1, 2.5, 2.5);
  }
  if (G.portal) {
    mctx.fillStyle = '#79b4ff';
    mctx.beginPath(); mctx.arc(G.portal.x / TILE * cell, G.portal.y / TILE * cell, 3.2, 0, 6.283); mctx.fill();
  }
  for (var j = 0; j < G.enemies.length; j++) {
    var e = G.enemies[j];
    if (e.dead) continue;
    if (dist(e.x, e.y, G.player.x, G.player.y) > 620 && !e.boss) continue;
    mctx.fillStyle = e.boss ? '#ff5a3a' : e.elite ? '#e8c85a' : '#b44a3a';
    var s = e.boss ? 3.4 : 2;
    mctx.beginPath(); mctx.arc(e.x / TILE * cell, e.y / TILE * cell, s, 0, 6.283); mctx.fill();
  }
  var p = G.player;
  mctx.fillStyle = '#ffe8b0';
  mctx.beginPath(); mctx.arc(p.x / TILE * cell, p.y / TILE * cell, 3, 0, 6.283); mctx.fill();
  mctx.strokeStyle = 'rgba(255,232,176,.75)';
  mctx.lineWidth = 1;
  mctx.beginPath(); mctx.arc(p.x / TILE * cell, p.y / TILE * cell, 5.5 + Math.sin(G.time * 3) * 1.2, 0, 6.283); mctx.stroke();
}

function drawJoystick() {
  if (G.state !== 'play') return;
  var v = G.view;
  if (G.joy.active) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(220,190,140,.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(G.joy.bx, G.joy.by, 52, 0, 6.283); ctx.stroke();
    ctx.fillStyle = 'rgba(20,16,14,.35)';
    ctx.beginPath(); ctx.arc(G.joy.bx, G.joy.by, 52, 0, 6.283); ctx.fill();
    var kx = G.joy.bx + G.joy.dx * G.joy.mag * 40, ky = G.joy.by + G.joy.dy * G.joy.mag * 40;
    var g = ctx.createRadialGradient(kx, ky - 4, 2, kx, ky, 22);
    g.addColorStop(0, 'rgba(240,216,170,.85)');
    g.addColorStop(1, 'rgba(140,110,70,.55)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(kx, ky, 22, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  } else if (G.touchMode && G.hintT > 0) {
    ctx.save();
    ctx.globalAlpha = 0.18 + Math.sin(G.time * 2) * 0.05;
    ctx.strokeStyle = 'rgba(220,190,140,.7)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(96, v.h - 96, 52, 0, 6.283); ctx.stroke();
    ctx.fillStyle = 'rgba(240,216,170,.5)';
    ctx.beginPath(); ctx.arc(96, v.h - 96, 20, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#cbb894';
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('이동', 96, v.h - 20);
    ctx.restore();
  }
}
function drawLowHp() {
  var p = G.player;
  if (!p || p.dead) return;
  var r = p.hp / p.maxHp;
  if (r > 0.32) return;
  var a = (0.32 - r) * 1.6 * (0.6 + Math.sin(G.time * 6) * 0.4);
  ctx.save();
  var g = ctx.createRadialGradient(G.view.w / 2, G.view.h / 2, G.view.h * 0.3, G.view.w / 2, G.view.h / 2, G.view.h * 0.8);
  g.addColorStop(0, 'rgba(150,10,5,0)');
  g.addColorStop(1, 'rgba(150,10,5,' + clamp(a, 0, 0.55) + ')');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, G.view.w, G.view.h);
  ctx.restore();
}

/* =====================================================================
   14. UI
   ===================================================================== */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function r1(n) { return Math.round(n * 10) / 10; }
function legendBy(id) { for (var i = 0; i < LEGENDARIES.length; i++) if (LEGENDARIES[i].id === id) return LEGENDARIES[i]; return null; }

function banner(t, s) {
  var b = $('banner');
  if (!b) return;
  $('banner-t').textContent = t;
  $('banner-s').textContent = s || '';
  b.classList.add('on');
  G.bannerT = 2.4;
}
var toastCount = 0;
function toast(text, type) {
  var box = $('toasts');
  if (!box) return;
  if (box.children.length > 3) box.removeChild(box.firstChild);
  var t = el('div', 'toast' + (type ? ' ' + type : ''), esc(text));
  box.appendChild(t);
  setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2400);
}
function toastItem(it) {
  var R = RARITY[it.rarity];
  toast(it.name + ' 획득' + (it.rarity === 'legend' ? ' ◆' : ''), it.rarity === 'legend' ? 'leg' : (it.rarity === 'rare' ? 'warn' : ''));
}

function show(id) {
  var ids = ['screen-title', 'screen-class', 'screen-inv', 'screen-pause', 'screen-help', 'screen-death'];
  for (var i = 0; i < ids.length; i++) { var e = $(ids[i]); if (e) e.classList.add('hidden'); }
  var t = $(id); if (t) t.classList.remove('hidden');
}
function hideAllScreens() { show('__none__'); }
function showHUD(v) {
  $('hud').style.display = v ? 'block' : 'none';
  $('actions').style.display = v ? 'flex' : 'none';
  if (!v) $('bossbar').style.display = 'none';
}

/* ---- HUD ---- */
var hudFrame = 0;
function updateHUD() {
  if (!G.player) return;
  hudFrame++;
  var p = G.player;
  // cooldowns every frame (cheap)
  updateCooldowns();
  if (hudFrame % 3 !== 0) return;
  $('hud-lv').textContent = p.level;
  $('hud-cls').textContent = CLASSES[p.cls].name;
  $('hud-hp').style.width = clamp(p.hp / p.maxHp * 100, 0, 100) + '%';
  $('hud-mp').style.width = clamp(p.mp / p.maxMp * 100, 0, 100) + '%';
  $('hud-xp').style.width = clamp(p.xp / p.xpNext * 100, 0, 100) + '%';
  $('hud-hptxt').textContent = Math.ceil(p.hp) + ' / ' + p.maxHp;
  $('hud-gold').textContent = fmt(p.gold);
  $('hud-depth').textContent = G.floor + '층 · ' + THEMES[G.theme].name;
  var cnt = document.querySelector('#btn-potion .cnt');
  if (cnt) cnt.textContent = p.potions;
  var pb = $('btn-potion'); if (pb) pb.classList.toggle('zero', p.potions <= 0);
  var dsh = $('btn-dash'); if (dsh) dsh.classList.toggle('dis', p.dashCd > 0);
  updateBossBar();
}
function updateCooldowns() {
  var p = G.player, C = CLASSES[p.cls];
  if (!G.skillEls) return;
  for (var i = 0; i < G.skillEls.length; i++) {
    var b = G.skillEls[i], sk = C.skills[i];
    var maxCd = sk.cd * (1 - p.stats.cdr / 100);
    var cd = p.skillCd[i];
    var pct = cd > 0 ? (cd / Math.max(0.1, maxCd)) * 100 : 0;
    var fill = b.querySelector('.cd');
    if (fill) fill.style.setProperty('--p', pct.toFixed(1) + '%');
    var tx = b.querySelector('.cdt');
    if (tx) tx.textContent = cd > 0.05 ? Math.ceil(cd) : '';
    b.classList.toggle('dis', cd > 0.05 || p.mp < sk.mp);
  }
}
function updateBossBar() {
  var bar = $('bossbar');
  if (!bar) return;
  var b = G.boss;
  if (b && !b.dead && G.player && !G.player.dead) {
    bar.style.display = 'block';
    $('boss-name').textContent = b.name;
    $('boss-fill').style.width = clamp(b.hp / b.maxHp * 100, 0, 100) + '%';
  } else bar.style.display = 'none';
}

/* ---- action buttons ---- */
function buildActions() {
  var p = G.player, C = CLASSES[p.cls];
  var skills = $('skills'), row = $('mainrow');
  skills.innerHTML = ''; row.innerHTML = '';
  G.skillEls = [];
  for (var i = 0; i < C.skills.length; i++) {
    (function (idx) {
      var sk = C.skills[idx];
      var b = el('button', 'act sk');
      b.innerHTML = '<span class="key">' + sk.key + '</span><span class="ic">' + sk.icon + '</span><span class="cd"></span><span class="cdt"></span><span class="nm">' + sk.name + '</span>';
      b.addEventListener('pointerdown', function (ev) { ev.preventDefault(); Sound.resume(); castSkill(idx); });
      b.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
      skills.appendChild(b);
      G.skillEls.push(b);
    })(i);
  }
  // potion
  var pot = el('button', 'act s2');
  pot.id = 'btn-potion';
  pot.innerHTML = '<span class="ic">🧪</span><span class="cnt">3</span>';
  pot.addEventListener('pointerdown', function (ev) { ev.preventDefault(); Sound.resume(); usePotion(); });
  row.appendChild(pot);
  // dash
  var dash = el('button', 'act s2');
  dash.id = 'btn-dash';
  dash.innerHTML = '<span class="ic">💨</span><span class="nm" style="bottom:1px">대시</span>';
  dash.addEventListener('pointerdown', function (ev) { ev.preventDefault(); Sound.resume(); doDash(); });
  row.appendChild(dash);
  // attack
  var atk = el('button', 'act');
  atk.id = 'btn-atk';
  atk.innerHTML = '<span class="ic">⚔</span><span class="nm">공격</span>';
  atk.addEventListener('pointerdown', function (ev) {
    ev.preventDefault(); Sound.resume();
    G.atkHeld = true;
    if (G.state === 'play' && G.player.atkCd <= 0 && G.player.spinT <= 0) basicAttack();
  });
  atk.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
  var releaseAtk = function () { G.atkHeld = false; };
  atk.addEventListener('pointerup', releaseAtk);
  atk.addEventListener('pointercancel', releaseAtk);
  atk.addEventListener('pointerleave', releaseAtk);
  row.appendChild(atk);
}

/* ---- inventory ---- */
function selItem() {
  var p = G.player;
  if (!G.sel) return null;
  if (G.sel.kind === 'eq') return p.equip[G.sel.slot];
  if (G.sel.kind === 'bag') return p.bag[G.sel.i] || null;
  return null;
}
function addToBag(it) {
  var p = G.player;
  if (p.bag.length >= BAG_SIZE) { toast('가방이 가득 찼습니다', 'warn'); return false; }
  p.bag.push(it);
  saveGame();
  return true;
}
function openInv() {
  if (!G.player || G.player.dead) return;
  G.state = 'inv';
  G.atkHeld = false;
  if (!G.sel) G.sel = { kind: 'bag', i: 0 };
  renderInv();
  show('screen-inv');
  Sound.click();
}
function closeInv() {
  if (G.state !== 'inv') return;
  G.state = 'play';
  hideAllScreens();
  saveGame();
  Sound.click();
}
function renderInv() {
  var p = G.player;
  if (!p) return;
  $('inv-gold').textContent = '◈ ' + fmt(p.gold);
  // equipment slots
  var eq = $('eqslots'); eq.innerHTML = '';
  for (var i = 0; i < SLOTS.length; i++) {
    (function (sl) {
      var it = p.equip[sl];
      var b = el('button', 'eqslot' + (it ? '' : ' empty') + (G.sel && G.sel.kind === 'eq' && G.sel.slot === sl ? ' sel' : ''));
      b.innerHTML = '<span class="ei">' + (it ? SLOTINFO[sl].icon : '◌') + '</span><span class="el">' + SLOTINFO[sl].n + '</span>';
      if (it) b.style.borderColor = RARITY[it.rarity].c;
      b.onclick = function () { G.sel = { kind: 'eq', slot: sl }; renderInv(); Sound.click(); };
      eq.appendChild(b);
    })(SLOTS[i]);
  }
  // bag
  $('bagcap').textContent = p.bag.length + ' / ' + BAG_SIZE;
  var grid = $('baggrid'); grid.innerHTML = '';
  for (var j = 0; j < BAG_SIZE; j++) {
    (function (idx) {
      var it = p.bag[idx];
      var d = el('button', 'islot' + (it ? ' r-' + it.rarity : '') + (G.sel && G.sel.kind === 'bag' && G.sel.i === idx ? ' sel' : ''));
      if (it) d.innerHTML = '<span class="ii">' + SLOTINFO[it.slot].icon + '</span>' + (it.up ? '<span class="iu">+' + it.up + '</span>' : '') +
        '<span class="dot" style="background:' + RARITY[it.rarity].c + '"></span>';
      d.onclick = function () { if (it) { G.sel = { kind: 'bag', i: idx }; renderInv(); Sound.click(); } };
      grid.appendChild(d);
    })(j);
  }
  // stats
  var s = computeStats(p);
  var rows = [
    ['공격력', s.atk], ['방어력', s.armor], ['최대 생명력', s.maxHp], ['최대 마나', s.maxMp],
    ['치명타 확률', s.crit + '%'], ['공격 속도', s.atkSpeed.toFixed(2) + '/s'], ['이동 속도', Math.round(s.moveSpeed)],
    ['골드 획득', '+' + s.gold + '%'], ['쿨다운 감소', s.cdr + '%']
  ];
  var html = '';
  for (var k = 0; k < rows.length; k++) html += '<div class="' + (k < 2 ? 'hl' : '') + '"><span>' + rows[k][0] + '</span><b>' + rows[k][1] + '</b></div>';
  html += '<div style="margin-top:5px"><span>힘</span><b>' + p.str + '</b></div><div><span>민첩</span><b>' + p.dex + '</b></div><div><span>활력</span><b>' + p.vit + '</b></div><div><span>지능</span><b>' + p.int + '</b></div>';
  $('statlist').innerHTML = html;
  renderPoints();
  renderDetail();
}
function renderPoints() {
  var p = G.player;
  $('ptnum').textContent = p.points;
  $('autostat').checked = !!G.autoStats;
  var box = $('ptbtns'); box.innerHTML = '';
  var pairs = [['str', '힘'], ['dex', '민첩'], ['vit', '활력'], ['int', '지능']];
  for (var i = 0; i < pairs.length; i++) {
    (function (key, label) {
      var b = el('button', 'ptbtn', '<span>' + label + '</span><span>' + p[key] + ' +</span>');
      b.disabled = p.points <= 0;
      b.onclick = function () {
        if (G.player.points <= 0) return;
        G.player[key]++; G.player.points--;
        recalc(G.player); saveGame(); renderInv(); Sound.click();
      };
      box.appendChild(b);
    })(pairs[i][0], pairs[i][1]);
  }
}
function renderDetail() {
  var d = $('detail'), it = selItem();
  if (!it) {
    d.innerHTML = '<div class="dempty">아이템을 선택하세요<br><span style="font-size:9px;opacity:.65">가방 · 장비 칸을 누르면<br>능력치 비교가 표시됩니다</span></div>';
    return;
  }
  var R = RARITY[it.rarity], mods = itemMods(it), p = G.player;
  var h = '<div class="dname" style="color:' + R.c + '">' + esc(it.name) + (it.up ? ' <span style="color:#8fd18a;font-size:.8em">+' + it.up + '</span>' : '') + '</div>';
  h += '<div class="dmeta">' + SLOTINFO[it.slot].n + ' · ' + R.n + ' · Lv.' + it.ilvl + '</div>';
  h += '<div class="dmods">';
  for (var k in mods) { if (mods[k]) h += '<div><span>' + affixLine(k, mods[k]) + '</span></div>'; }
  h += '</div>';
  if (it.power) {
    var L = legendBy(it.power);
    if (L) h += '<div class="dlegend">◆ ' + esc(L.desc) + '</div>';
  }
  // comparison
  if (G.sel.kind === 'bag') {
    var cur = p.equip[it.slot];
    var a = computeStats(p);
    var eq2 = {};
    for (var sl in p.equip) eq2[sl] = p.equip[sl];
    eq2[it.slot] = it;
    var b = computeStats(p, eq2);
    var diffs = [
      ['공격력', b.atk - a.atk, 0], ['방어력', b.armor - a.armor, 0], ['생명력', b.maxHp - a.maxHp, 0],
      ['치명타', r1(b.crit - a.crit), 1], ['공격속도', r1(b.atkSpeed - a.atkSpeed), 2], ['이동속도', Math.round(b.moveSpeed - a.moveSpeed), 0]
    ];
    h += '<div class="dcmp">';
    h += '<div style="color:#8c8069;margin-bottom:2px">' + (cur ? '장착 중: ' + esc(cur.name) : '빈 슬롯') + '</div>';
    var shown = 0;
    for (var q = 0; q < diffs.length; q++) {
      var dv = diffs[q][1];
      if (Math.abs(dv) < (diffs[q][2] === 2 ? 0.005 : 0.05)) continue;
      shown++;
      h += '<div><span>' + diffs[q][0] + '</span><b class="' + (dv > 0 ? 'up' : 'dn') + '">' + (dv > 0 ? '▲ +' : '▼ ') + (diffs[q][2] === 2 ? dv.toFixed(2) : (diffs[q][2] === 1 ? dv.toFixed(1) : dv)) + '</b></div>';
    }
    if (!shown) h += '<div class="eq">능력치 변화 없음</div>';
    h += '</div>';
  }
  // actions
  h += '<div class="dactions">';
  if (G.sel.kind === 'bag') {
    h += '<button class="abtn" data-act="equip">장 착<small>' + (p.equip[it.slot] ? esc(p.equip[it.slot].name) + ' 와 교체' : '빈 슬롯') + '</small></button>';
  } else {
    h += '<button class="abtn" data-act="unequip">해 제<small>가방으로 이동</small></button>';
  }
  var maxed = (it.up || 0) >= MAX_UPGRADE;
  h += '<button class="abtn" data-act="up"' + (maxed ? ' disabled' : '') + '>강 화 +' + ((it.up || 0) + 1) + '<small>' + (maxed ? '최대 강화' : '◈ ' + fmt(upgradeCost(it))) + '</small></button>';
  if (G.sel.kind === 'bag') h += '<button class="abtn danger" data-act="salvage">분 해<small>◈ +' + fmt(salvageValue(it)) + '</small></button>';
  h += '</div>';
  d.innerHTML = h;
}
function equipSelected() {
  var p = G.player, it = selItem();
  if (!it || G.sel.kind !== 'bag') return;
  var idx = p.bag.indexOf(it);
  if (idx < 0) return;
  var prev = p.equip[it.slot];
  p.bag.splice(idx, 1);
  p.equip[it.slot] = it;
  if (prev && p.bag.length < BAG_SIZE) p.bag.push(prev);
  else if (prev) { p.bag.unshift(prev); }
  recalc(p);
  G.sel = { kind: 'eq', slot: it.slot };
  Sound.equip(); saveGame(); renderInv();
  toast(it.name + ' 장착');
}
function unequipSelected() {
  var p = G.player, it = selItem();
  if (!it || G.sel.kind !== 'eq') return;
  if (p.bag.length >= BAG_SIZE) { toast('가방이 가득 찼습니다', 'warn'); return; }
  p.bag.push(it); p.equip[G.sel.slot] = null;
  recalc(p);
  G.sel = null;
  Sound.equip(); saveGame(); renderInv();
}
function salvageSelected() {
  var p = G.player, it = selItem();
  if (!it || G.sel.kind !== 'bag') return;
  var idx = p.bag.indexOf(it);
  if (idx < 0) return;
  var g = salvageValue(it);
  p.bag.splice(idx, 1);
  p.gold += g;
  G.sel = null;
  Sound.gold(); saveGame(); renderInv();
  toast('분해 +' + fmt(g) + ' G');
}
function upgradeSelected() {
  var p = G.player, it = selItem();
  if (!it) return;
  if ((it.up || 0) >= MAX_UPGRADE) { toast('더는 강화할 수 없습니다', 'warn'); return; }
  var cost = upgradeCost(it);
  if (p.gold < cost) { toast('골드가 부족합니다', 'warn'); Sound.deny(); return; }
  p.gold -= cost;
  it.up = (it.up || 0) + 1;
  recalc(p);
  Sound.equip(); saveGame(); renderInv();
  toast(it.name + ' +' + it.up + ' 강화');
}

/* ---- pause / mute ---- */
function togglePause() {
  if (G.state === 'play') {
    G.state = 'pause'; G.atkHeld = false;
    $('pause-info').innerHTML = 'Lv.' + G.player.level + ' · ' + G.floor + '층<br>처치 ' + G.player.kills + ' · 골드 ' + fmt(G.player.gold);
    show('screen-pause');
  } else if (G.state === 'pause') {
    G.state = 'play'; hideAllScreens();
  }
}
function toggleMute() {
  G.muted = !G.muted;
  Sound.setMuted(G.muted);
  syncMuteBtn();
  saveGame();
}
function syncMuteBtn() {
  var b = $('btn-mute'); if (b) b.textContent = G.muted ? '🔇' : '♪';
  var b2 = $('btn-mute2'); if (b2) b2.textContent = G.muted ? '소리 켜기' : '소리 끄기';
}

/* =====================================================================
   15. INPUT
   ===================================================================== */
function updateJoy(x, y) {
  var dx = x - G.joy.bx, dy = y - G.joy.by;
  var l = Math.sqrt(dx * dx + dy * dy);
  if (l < 8) { G.joy.dx = 0; G.joy.dy = 0; G.joy.mag = 0; return; }
  G.joy.dx = dx / l; G.joy.dy = dy / l;
  G.joy.mag = Math.min(1, l / 52);
}
function tryTapPickup(sx, sy) {
  var w = screenToWorld(sx, sy);
  var best = null, bd = 60 * 60;
  for (var i = 0; i < G.items.length; i++) {
    var g = G.items[i];
    var d = dist2(w.x, w.y, g.x, g.y);
    if (d < bd) { bd = d; best = g; }
  }
  if (best && dist(best.x, best.y, G.player.x, G.player.y) < 190) {
    if (addToBag(best.it)) {
      var idx = G.items.indexOf(best);
      if (idx >= 0) G.items.splice(idx, 1);
      Sound.equip();
      toastItem(best.it);
      burst(best.x, best.y, 8, RARITY[best.it.rarity].c, 90, 3);
    }
  }
}
function bindInput() {
  canvas.addEventListener('pointerdown', function (e) {
    Sound.resume();
    if (G.state !== 'play') return;
    if (e.pointerType === 'mouse') {
      G.touchMode = false;
      G.mouse.has = true;
      G.mouse.x = e.clientX; G.mouse.y = e.clientY;
      if (e.button === 0) {
        G.atkHeld = true;
        if (G.player.atkCd <= 0 && G.player.spinT <= 0) basicAttack();
      }
      return;
    }
    G.touchMode = true; G.hintT = 0;
    var x = e.clientX, y = e.clientY;
    if (!G.joy.active && x < G.view.w * 0.58) {
      G.joy.active = true; G.joy.id = e.pointerId;
      G.joy.bx = x; G.joy.by = y;
      updateJoy(x, y);
      if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) { } }
    } else {
      tryTapPickup(x, y);
    }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'mouse') {
      G.mouse.has = true; G.touchMode = false;
      G.mouse.x = e.clientX; G.mouse.y = e.clientY;
    } else if (G.joy.active && e.pointerId === G.joy.id) {
      updateJoy(e.clientX, e.clientY);
    }
  });
  function up(e) {
    if (e.pointerType === 'mouse') { if (e.button === 0) G.atkHeld = false; return; }
    if (G.joy.active && e.pointerId === G.joy.id) {
      G.joy.active = false; G.joy.id = null; G.joy.mag = 0; G.joy.dx = 0; G.joy.dy = 0;
    }
  }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  window.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase();
    if (k === 'escape') {
      e.preventDefault();
      if (G.state === 'inv') { closeInv(); return; }
      togglePause(); return;
    }
    if (G.state === 'title' || G.state === 'class') return;
    if (k === 'e' || k === 'tab') { e.preventDefault(); if (G.state === 'inv') closeInv(); else if (G.state === 'play') openInv(); return; }
    if (G.state !== 'play') return;
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) e.preventDefault();
    G.keys[k] = true;
    if (k === 'j' || k === ' ') { G.atkHeld = true; if (G.player.atkCd <= 0 && G.player.spinT <= 0) basicAttack(); }
    else if (k === '1' || k === 'u') castSkill(0);
    else if (k === '2' || k === 'i') castSkill(1);
    else if (k === '3' || k === 'o') castSkill(2);
    else if (k === 'shift') doDash();
    else if (k === 'q') usePotion();
    else if (k === 'm') toggleMute();
  });
  window.addEventListener('keyup', function (e) {
    var k = (e.key || '').toLowerCase();
    G.keys[k] = false;
    if (k === 'j' || k === ' ') G.atkHeld = false;
  });
  window.addEventListener('blur', function () { G.keys = {}; G.atkHeld = false; G.joy.active = false; G.joy.mag = 0; });
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 220); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) saveGame(); });

  // title
  $('btn-continue').addEventListener('click', function () {
    Sound.resume(); var sv = loadSave();
    if (sv) continueGame(sv); else { show('screen-class'); }
  });
  $('btn-new').addEventListener('click', function () { Sound.resume(); Sound.click(); show('screen-class'); });
  $('btn-help').addEventListener('click', function () { Sound.click(); show('screen-help'); });
  $('btn-help2').addEventListener('click', function () { Sound.click(); show('screen-help'); });
  $('btn-help-close').addEventListener('click', function () { Sound.click(); show(G.player ? 'screen-pause' : 'screen-title'); });
  $('btn-class-back').addEventListener('click', function () { Sound.click(); show('screen-title'); });
  $('btn-inv').addEventListener('click', function () { if (G.state === 'play') openInv(); });
  $('btn-inv-close').addEventListener('click', closeInv);
  $('btn-pause').addEventListener('click', function () { if (G.state === 'play') togglePause(); });
  $('btn-resume').addEventListener('click', function () { if (G.state === 'pause') { G.state = 'play'; hideAllScreens(); } });
  $('btn-mute').addEventListener('click', toggleMute);
  $('btn-mute2').addEventListener('click', toggleMute);
  $('btn-restart').addEventListener('click', function () { clearSave(); G.player = null; G.state = 'class'; show('screen-class'); showHUD(false); });
  $('btn-revive').addEventListener('click', revive);
  $('btn-death-new').addEventListener('click', function () { clearSave(); G.player = null; G.state = 'class'; show('screen-class'); showHUD(false); });
  $('detail').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'equip') equipSelected();
    else if (act === 'unequip') unequipSelected();
    else if (act === 'up') upgradeSelected();
    else if (act === 'salvage') salvageSelected();
  });
  $('autostat').addEventListener('change', function (e) {
    G.autoStats = e.target.checked;
    if (G.autoStats && G.player.points > 0) { autoSpend(G.player); recalc(G.player); }
    saveGame(); renderInv();
  });
  var cards = document.querySelectorAll('.card');
  for (var i = 0; i < cards.length; i++) {
    (function (card) {
      card.addEventListener('click', function () {
        var cls = card.getAttribute('data-class');
        var sel = document.querySelectorAll('.card');
        for (var j = 0; j < sel.length; j++) sel[j].classList.remove('sel');
        card.classList.add('sel');
        Sound.resume(); Sound.click();
        setTimeout(function () { newGame(cls); }, 120);
      });
    })(cards[i]);
  }
}

/* =====================================================================
   16. BOOT
   ===================================================================== */
function resize() {
  var w = Math.max(240, window.innerWidth), h = Math.max(240, window.innerHeight);
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  G.view.w = w; G.view.h = h; G.view.dpr = dpr;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  G.zoom = clamp(Math.max(h / 440, w / 1500), 0.8, 1.4);
  if (!G.lightCanvas) { G.lightCanvas = document.createElement('canvas'); G.lightCtx = G.lightCanvas.getContext('2d'); }
  G.lightCanvas.width = Math.round(w * dpr);
  G.lightCanvas.height = Math.round(h * dpr);
  if (G.player) {
    G.cam.x = clamp(G.player.x - w / G.zoom / 2, 0, Math.max(0, MAPW * TILE - w / G.zoom));
    G.cam.y = clamp(G.player.y - h / G.zoom / 2, 0, Math.max(0, MAPH * TILE - h / G.zoom));
  }
}

function frame(ts) {
  requestAnimationFrame(frame);
  if (!G.lastTs) G.lastTs = ts;
  var dt = (ts - G.lastTs) / 1000;
  G.lastTs = ts;
  if (!isFinite(dt) || dt < 0) dt = 0.016;
  dt = Math.min(0.05, dt);
  if (G.state === 'play') {
    step(dt);
  } else if (G.state === 'death' || G.state === 'pause' || G.state === 'inv') {
    G.time += dt;
    G.shake = Math.max(0, G.shake - dt * 26);
  } else {
    G.time += dt;
  }
  if (G.player) render();
}

function init() {
  canvas = $('game');
  ctx = canvas.getContext('2d', { alpha: false });
  minimap = $('minimap');
  mctx = minimap.getContext('2d');
  G.delayed = [];
  G.hintT = 8;
  G.touchMode = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  resize();
  bindInput();
  syncMuteBtn();
  showHUD(false);
  var sv = loadSave();
  var cb = $('btn-continue');
  if (sv) {
    cb.classList.remove('hidden');
    cb.textContent = '이어하기 · Lv.' + (sv.level || 1) + ' ' + (CLASSES[sv.cls] ? CLASSES[sv.cls].name : '') + ' · ' + (sv.floor || 1) + '층';
  } else {
    cb.classList.add('hidden');
  }
  show('screen-title');
  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
