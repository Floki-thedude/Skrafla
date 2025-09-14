// Daily Rack — core logic

// Icelandic Skrafl (new tile set) — points and counts
// Source: Netskrafl NewTileSet (Miðeind / Skraflfélag Íslands)
const LETTER_POINTS = {
  A:1, Á:3, B:5, D:5, Ð:2, E:3, É:7, F:3, G:3, H:4,
  I:1, Í:4, J:6, K:2, L:2, M:2, N:1, O:5, Ó:3, P:5,
  R:1, S:1, T:2, U:2, Ú:4, V:5, X:10, Y:6, Ý:5, Þ:7,
  Æ:4, Ö:6
};

// New Icelandic tile counts (no blanks)
const LETTER_COUNTS = {
  A:11, Á:2, B:1, D:1, Ð:4, E:3, É:1, F:3, G:3, H:1,
  I:7, Í:1, J:1, K:4, L:5, M:3, N:7, O:1, Ó:2, P:1,
  R:8, S:7, T:6, U:6, Ú:1, V:1, X:1, Y:1, Ý:1, Þ:1,
  Æ:2, Ö:1
};

const RACK_SIZE = 7;
const BINGO_BONUS = 50;

// Mulberry32 PRNG, deterministic with seed
function mulberry32(a){
  return function(){
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

// Polyfill for roundRect if not available
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
    this.beginPath();
    this.moveTo(x + radius, y);
    this.lineTo(x + width - radius, y);
    this.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.lineTo(x + width, y + height - radius);
    this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.lineTo(x + radius, y + height);
    this.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.lineTo(x, y + radius);
    this.quadraticCurveTo(x, y, x + radius, y);
    this.closePath();
  };
}

function hashStringToSeed(str){
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function todayKey(date=new Date()){
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth()+1).padStart(2,'0');
  const dd = String(date.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

function buildBag(){
  const bag = [];
  for(const [ch,count] of Object.entries(LETTER_COUNTS)){
    for(let i=0;i<count;i++) bag.push(ch);
  }
  return bag;
}

function dealRack(seed){
  const rnd = mulberry32(seed);
  const bag = buildBag();
  const rack = [];
  for(let i=0; i<RACK_SIZE; i++){
    const idx = Math.floor(rnd()*bag.length);
    rack.push(bag[idx]);
    bag.splice(idx,1);
  }
  return rack;
}

function scoreWord(word){
  let score = 0;
  for(const ch of word){
    score += LETTER_POINTS[ch] || 0;
  }
  if(word.length === RACK_SIZE){
    score += BINGO_BONUS;
  }
  return score;
}

function countsFrom(letters){
  const m = new Map();
  for(const ch of letters){
    m.set(ch, (m.get(ch)||0)+1);
  }
  return m;
}

function canMakeWordFromRack(word, rack){
  const need = countsFrom(word);
  const have = countsFrom(rack);
  for(const [ch, c] of need){
    if((have.get(ch)||0) < c) return false;
  }
  return true;
}

// Dictionary support (optional)
let DICT = null; // Set<string> or null if not loaded
let DICT_SOURCE = '';
let dictEnabled = false;

async function loadDictionary(){
  // Try multiple paths relative to current document and site root
  const rawCandidates = [
    // Preferred fast-loading normalized list
  '../data/words_is.txt', 'data/words_is.txt', '/data/words_is.txt',
  // Also try when data lives under scripts/
  '../scripts/data/words_is.txt', 'scripts/data/words_is.txt', '/scripts/data/words_is.txt',
    // Fallbacks: alternate names
  '../data/islensk.txt', 'data/islensk.txt', '/data/islensk.txt',
  '../scripts/data/islensk.txt', 'scripts/data/islensk.txt', '/scripts/data/islensk.txt',
  '../data/words.txt', 'data/words.txt', '/data/words.txt',
  '../scripts/data/words.txt', 'scripts/data/words.txt', '/scripts/data/words.txt',
    // Last resort: full Netskrafl list (large, slower to load in browser)
  '../data/ordalisti.full.sorted.txt', 'data/ordalisti.full.sorted.txt', '/data/ordalisti.full.sorted.txt',
  '../scripts/data/ordalisti.full.sorted.txt', 'scripts/data/ordalisti.full.sorted.txt', '/scripts/data/ordalisti.full.sorted.txt'
  ];
  const base = (typeof document !== 'undefined' && document.baseURI) ? document.baseURI : location.href;
  const candidates = rawCandidates.map(p=>{
    try{ return new URL(p, base).href; }catch{ return p; }
  });
  for(const url of candidates){
    try{
      const res = await fetch(url, { cache: 'no-cache' });
      if(res.ok){
        const text = await res.text();
        const words = text.split(/\r?\n/).map(w => w.trim()).filter(Boolean);
        // Normalize to NFC and uppercase for robust matching with diacritics
        DICT = new Set(words.map(w=> w.normalize('NFC').toUpperCase()));
        dictEnabled = true;
        DICT_SOURCE = url;
        try{ console.log('Dictionary loaded:', url, 'size=', DICT.size); }catch{}
        return;
      }
    }catch(e){/* try next */}
  }
  // Fallback to a tiny built-in demo list so the game runs
  const demo = ['TREE','STEAM','CRANE','STARE','TIRES','NOTES','STONE','RAINS','TRAIN','PASTE','PASTE','PAINT','POINT','PRIZE','QUIET','NOISE','CLOUD','HONEY','FUN','GAME','WORD','RACK','TILES','SCORE','BONUS'];
  DICT = new Set(demo);
  dictEnabled = false; // indicate limited list
}

function formatScoreBreakdown(word){
  const parts = [];
  for(const ch of word){
    parts.push(`${ch}(${LETTER_POINTS[ch]||0})`);
  }
  const base = word.split('').reduce((s,ch)=>s+(LETTER_POINTS[ch]||0),0);
  const bingo = word.length===RACK_SIZE ? ` + Bingo ${BINGO_BONUS}` : '';
  return `${parts.join(' + ')} = ${base}${bingo ? bingo : ''}`;
}

function shuffleArrayInPlace(arr, rnd){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(rnd()* (i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// Juicy UI helpers
function confettiBurstAt(el, count=24){
  if(!el) return;
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width/2;
  const cy = rect.top + rect.height/2;
  const colors = ['#ff5fa2','#8a5cff','#27c9ff','#2ee59d','#ffd166','#ff9f1c'];
  for(let i=0;i<count;i++){
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const angle = Math.random()*Math.PI*2;
    const mag = 60 + Math.random()*90;
    const dx = Math.cos(angle)*mag;
    const dy = Math.sin(angle)*mag + 40;
    piece.style.left = `${cx + (Math.random()*16-8)}px`;
    piece.style.top = `${cy + (Math.random()*8-4)}px`;
    piece.style.setProperty('--dx', `${dx}px`);
    piece.style.setProperty('--dy', `${dy}px`);
    piece.style.background = colors[i % colors.length];
    document.body.appendChild(piece);
    setTimeout(()=>{ piece.remove(); }, 1000);
  }
}

function showToast(msg, ms=1400){
  const el = document.createElement('div');
  el.className='toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(()=>{ el.remove(); }, ms);
}

// Drag-and-drop state and rendering
const state = {
  tiles: [],            // [{id, letter}]
  rackTileIds: [],      // [id]
  slotTileIds: [],      // [id|null] length=RACK_SIZE
  draggingFromRackIndex: -1,
  draggingFromSlotIndex: -1,
  draggingId: null
};

function makeTileEl(id, letter){
  const el = document.createElement('div');
  el.className = 'tile';
  el.draggable = true;
  el.setAttribute('role','button');
  el.setAttribute('tabindex','0');
  el.dataset.id = id;
  el.dataset.letter = letter;
  el.textContent = letter;
  const pts = document.createElement('div');
  pts.className='pts';
  pts.textContent = (LETTER_POINTS[letter] || 0);
  el.appendChild(pts);
  
  // Simplified drag events
  el.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    state.draggingId = id;
    el.style.opacity = '0.5';
  });
  
  el.addEventListener('dragend', () => {
    el.style.opacity = '';
    state.draggingId = null;
  });
  
  // Click to toggle between rack and next empty slot
  el.addEventListener('click', ()=>{
    const rackIndex = state.rackTileIds.indexOf(id);
    const inRack = rackIndex !== -1;
    if(inRack){
      const empty = state.slotTileIds.indexOf(null);
  if(empty === -1) return; // no room
      state.rackTileIds[rackIndex] = null; // leave a hole where tile was
      const prevIdx = state.slotTileIds.findIndex(x=>x===id);
      if(prevIdx!==-1) state.slotTileIds[prevIdx]=null;
      state.slotTileIds[empty] = id;
  renderAll();
  if(window._dailyRackPlink) window._dailyRackPlink();
    }else{
      // In a slot -> return to rack
      const prevIdx = state.slotTileIds.findIndex(x=>x===id);
      if(prevIdx!==-1) state.slotTileIds[prevIdx]=null;
      const hole = state.rackTileIds.findIndex(x=>x===null);
      if(hole!==-1) state.rackTileIds[hole]=id; else state.rackTileIds.push(id);
      renderAll();
    }
  });
  // Keyboard: Enter/Space toggles like click
  el.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      el.click();
    }
  });
  return el;
}

function renderRackFromState(){
  const rackEl = document.getElementById('rack');
  rackEl.innerHTML='';
  
  // Set up drop zone on rack container (only once)
  if (!rackEl.hasAttribute('data-drop-listeners')) {
    rackEl.setAttribute('data-drop-listeners', 'true');
    
    rackEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      rackEl.classList.add('droppable');
      // Highlight the first empty rack-slot for clarity
      const cells = rackEl.querySelectorAll('.rack-slot');
      const idx = state.rackTileIds.indexOf(null);
      if(idx !== -1 && cells[idx]) cells[idx].classList.add('droppable');
    });
    
    rackEl.addEventListener('dragleave', (e) => {
      if (!rackEl.contains(e.relatedTarget)) {
        rackEl.classList.remove('droppable');
        rackEl.querySelectorAll('.rack-slot.droppable').forEach(c=>c.classList.remove('droppable'));
      }
    });
    
    rackEl.addEventListener('drop', (e) => {
      e.preventDefault();
      rackEl.classList.remove('droppable');
      const tileId = e.dataTransfer.getData('text/plain');
      if (!tileId) return;
      
      // Don't handle if dropped on a slot (let individual slot handler deal with it)
      if (e.target.closest('.slot')) return;
      
      // Remove tile from slots
      const slotIndex = state.slotTileIds.indexOf(tileId);
      if (slotIndex !== -1) {
        state.slotTileIds[slotIndex] = null;
      }
      
      // Add to first empty rack slot if not already there
      if (!state.rackTileIds.includes(tileId)) {
        const emptyRackIndex = state.rackTileIds.indexOf(null);
        if (emptyRackIndex !== -1) {
          state.rackTileIds[emptyRackIndex] = tileId;
        } else {
          state.rackTileIds.push(tileId);
        }
      }
      
      renderAll();
    });
  }
  
  // Render rack as 7 slot-like cells for consistency with .slots
  for(let pos=0; pos<RACK_SIZE; pos++){
    const idAt = state.rackTileIds[pos];
    const cell = document.createElement('div');
    cell.className = 'rack-slot' + (idAt ? ' filled' : '');
    if(idAt){
      const tile = state.tiles.find(t=>t.id===idAt);
      if(tile){ cell.appendChild(makeTileEl(tile.id, tile.letter)); }
    }
    rackEl.appendChild(cell);
  }
}

function renderSlots(){
  const slotsEl = document.getElementById('word-slots');
  slotsEl.innerHTML='';
  
  // Set up drop zone on slots container (only once)
  if (!slotsEl.hasAttribute('data-drop-listeners')) {
    slotsEl.setAttribute('data-drop-listeners', 'true');
    
    slotsEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      slotsEl.classList.add('droppable');
    });
    
    slotsEl.addEventListener('dragleave', (e) => {
      if (!slotsEl.contains(e.relatedTarget)) {
        slotsEl.classList.remove('droppable');
      }
    });
    
    slotsEl.addEventListener('drop', (e) => {
      e.preventDefault();
      slotsEl.classList.remove('droppable');
      const tileId = e.dataTransfer.getData('text/plain');
      if (!tileId) return;
      
      // Don't handle if dropped on a slot (let individual slot handler deal with it)
      if (e.target.closest('.slot')) return;
      
      // Remove tile from rack
      const rackIndex = state.rackTileIds.indexOf(tileId);
      if (rackIndex !== -1) {
        state.rackTileIds[rackIndex] = null;
      }
      
      // Add to first empty slot
      const emptySlotIndex = state.slotTileIds.indexOf(null);
      if (emptySlotIndex !== -1) {
        state.slotTileIds[emptySlotIndex] = tileId;
      }
      
      renderAll();
    });
  }
  
  // Render slots
  for(let i=0;i<RACK_SIZE;i++){
    const slot = document.createElement('div');
    const tileId = state.slotTileIds[i];
    slot.className = 'slot' + (tileId ? ' filled' : '');
    slot.setAttribute('role','button');
    slot.setAttribute('tabindex','0');
    slot.setAttribute('aria-label', tileId ? `Letter ${(state.tiles.find(t=>t.id===tileId)||{}).letter} in position ${i+1}` : `Empty position ${i+1}`);
    
    // Individual slot drop handling for precise positioning
    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      slot.classList.add('droppable');
    });
    
    slot.addEventListener('dragleave', () => {
      slot.classList.remove('droppable');
    });
    
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent container drop handlers from firing
      slot.classList.remove('droppable');
      const draggedTileId = e.dataTransfer.getData('text/plain');
      if (!draggedTileId) return;
      
      // If there's already a tile here, move it to first empty slot or back to rack
      const currentTileInSlot = state.slotTileIds[i];
      if (currentTileInSlot && currentTileInSlot !== draggedTileId) {
        const emptySlotIndex = state.slotTileIds.indexOf(null);
        if (emptySlotIndex !== -1) {
          state.slotTileIds[emptySlotIndex] = currentTileInSlot;
        } else {
          // Move back to rack
          const emptyRackIndex = state.rackTileIds.indexOf(null);
          if (emptyRackIndex !== -1) {
            state.rackTileIds[emptyRackIndex] = currentTileInSlot;
          }
        }
      }
      
      // Remove dragged tile from its current position
      const rackIndex = state.rackTileIds.indexOf(draggedTileId);
      if (rackIndex !== -1) {
        state.rackTileIds[rackIndex] = null;
      }
      const previousSlotIndex = state.slotTileIds.indexOf(draggedTileId);
      if (previousSlotIndex !== -1) {
        state.slotTileIds[previousSlotIndex] = null;
      }
      
      // Place in this slot
      state.slotTileIds[i] = draggedTileId;
      renderAll();
      if(window._dailyRackPlink) window._dailyRackPlink();
      // Floating score bubble near slot
      try{
        const tile = state.tiles.find(t=>t.id===draggedTileId);
        if(tile){
          const pts = LETTER_POINTS[tile.letter]||0;
          const b = document.createElement('div'); b.className='score-float'; b.textContent = `+${pts}`;
          const r = slot.getBoundingClientRect(); b.style.left = `${r.left + r.width/2 - 8}px`; b.style.top = `${r.top - 8}px`;
          document.body.appendChild(b); setTimeout(()=>b.remove(), 750);
        }
      }catch{}
      updateSubmitGlow();
    });
    
    // Keyboard functionality
    slot.addEventListener('keydown', (e)=>{
      if(e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      const current = state.slotTileIds[i];
      if(current){
        state.slotTileIds[i] = null;
        const emptyRackIndex = state.rackTileIds.indexOf(null);
        if (emptyRackIndex !== -1) {
          state.rackTileIds[emptyRackIndex] = current;
        } else {
          state.rackTileIds.push(current);
        }
      }else{
        const idxFirst = state.rackTileIds.findIndex(Boolean);
        const id = idxFirst!==-1 ? state.rackTileIds[idxFirst] : null;
        if(id){
          state.rackTileIds[idxFirst] = null;
          state.slotTileIds[i] = id;
        }
      }
      renderAll();
    });
    
    if(tileId){
      const tile = state.tiles.find(t=>t.id===tileId);
      if(tile){
        slot.appendChild(makeTileEl(tile.id, tile.letter));
      }
    }
    slotsEl.appendChild(slot);
  }
}

function currentWordFromSlots(){
  return state.slotTileIds.filter(Boolean).map(id=>{
    const t = state.tiles.find(x=>x.id===id);
    return t ? t.letter : '';
  }).join('');
}

function renderAll(){
  renderRackFromState();
  renderSlots();
  const input = document.getElementById('word-input');
  if(input){ input.value = currentWordFromSlots(); }
  updateSubmitGlow();
}

function shakeAndRecall(){
  const slotsEl = document.getElementById('word-slots');
  if(slotsEl){
    slotsEl.classList.add('shake');
    setTimeout(()=> slotsEl.classList.remove('shake'), 260);
  }
  // Move all placed tiles back to the rack
  for(let i=0;i<RACK_SIZE;i++){
    const id = state.slotTileIds[i];
    if(!id) continue;
    state.slotTileIds[i] = null;
    // Find first empty rack position, or add to end if rack is full
    const emptyRackIndex = state.rackTileIds.indexOf(null);
    if (emptyRackIndex !== -1 && emptyRackIndex < RACK_SIZE) {
      state.rackTileIds[emptyRackIndex] = id;
    } else {
      // Only push if we haven't exceeded rack size
      if(state.rackTileIds.length < RACK_SIZE) {
        state.rackTileIds.push(id);
      }
    }
  }
  renderAll();
}

function setMessage(text, type=''){
  const el = document.getElementById('message');
  el.textContent = text;
  el.className = `message ${type}`.trim();
}

function setScore(text){
  document.getElementById('score-breakdown').textContent = text;
}

function shareText(dateKey, rack, word, score){
  const dictTag = dictEnabled ? '' : ' (no dict)';
  return `Daily Rack — ${dateKey}\nRack: ${rack.join(' ')}\nWord: ${word} = ${score}${dictTag}\n#dailyrack`;
}

function savePlay(dateKey, payload){
  localStorage.setItem(`daily-rack:${dateKey}`, JSON.stringify(payload));
}
function loadPlay(dateKey){
  const raw = localStorage.getItem(`daily-rack:${dateKey}`);
  if(!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function findBestWord(rack){
  if(!DICT) return null;
  let best = {word:'', score:0};
  for(const word of DICT){
    if(word.length>RACK_SIZE) continue;
    if(!canMakeWordFromRack(word, rack)) continue;
    const s = scoreWord(word);
    if(s>best.score) best = {word, score:s};
  }
  return best.word ? best : null;
}

async function main(){
  // Show loader while initializing
  const loader = document.getElementById('loader-overlay');
  const endPreload = ()=>{ try{ document.body.classList.remove('preload'); }catch{} };
  setTimeout(()=>{
    if(loader){ loader.style.opacity = '0'; setTimeout(()=> loader.remove(), 320); }
    endPreload();
  }, 2000);

  await loadDictionary();

  // Hidden feature: Alt + double‑click on the dict status fetches Icelandic list from GitHub
  (function installHiddenDictFetcher(){
    const el = document.getElementById('dict-status');
    if(!el) return;
    async function fetchIsl(url){
      try{
        setMessage('Downloading Icelandic dictionary…');
        const res = await fetch(url, { mode:'cors', cache:'no-cache' });
        if(!res.ok){ throw new Error('HTTP '+res.status); }
        const text = await res.text();
        const words = text.split(/\r?\n/).map(w=>w.trim()).filter(Boolean);
        DICT = new Set(words.map(w=> w.normalize('NFC').toUpperCase()));
        dictEnabled = true;
        // status UI removed
        setMessage('Icelandic dictionary loaded from GitHub.');
        return true;
      }catch(err){
        console.warn('Hidden dict fetch failed', err);
        setMessage('Failed to fetch dictionary from GitHub.', 'error');
        return false;
      }
    }
    async function trigger(){
      // Prefer the mid list for speed; fall back to full list if needed
      const mid = 'https://raw.githubusercontent.com/mideind/Netskrafl/master/resources/ordalisti.mid.sorted.txt';
      const full = 'https://raw.githubusercontent.com/mideind/Netskrafl/master/resources/ordalisti.full.sorted.txt';
      if(!(await fetchIsl(mid))){ await fetchIsl(full); }
    }
    el.addEventListener('dblclick', (ev)=>{ if(ev.altKey) trigger(); });
    // Optional URL trigger: append ?isdict=1 to auto-fetch (still "hidden")
    try{
      const u = new URL(location.href);
      if(u.searchParams.get('isdict') === '1'){ trigger(); }
    }catch{}
  })();

  // Removed manual dictionary file loader UI

  const dateKey = todayKey();
  document.getElementById('puzzle-date').textContent = dateKey;

  // Deterministic letters for the day (stable across refresh)
  const seed = hashStringToSeed(dateKey);
  const rack = dealRack(seed);
  // Initialize drag-drop state
  state.tiles = rack.map((letter, idx)=>({id: `t${idx}`, letter}));
  state.rackTileIds = state.tiles.map(t=>t.id);
  state.slotTileIds = new Array(RACK_SIZE).fill(null);
  renderAll();

  // UX: initialize settings and streak
  const soundToggle = document.getElementById('toggle-sound');
  const devToggle = document.getElementById('toggle-dev');
  const SETTINGS_KEY = 'daily-rack:ui';
  function loadUI(){ try{ return JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'); }catch{ return {} } }
  function saveUI(s){ try{ localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }catch{} }
  const ui = loadUI();
  if(soundToggle){ soundToggle.checked = !!ui.sound; soundToggle.addEventListener('change', ()=>{ ui.sound = soundToggle.checked; saveUI(ui); }); }
  if(devToggle){ devToggle.checked = !!ui.dev; devToggle.addEventListener('change', ()=>{ ui.dev = devToggle.checked; saveUI(ui); }); }
  function beep(){
    if(!ui.sound) return;
    try{
      const AudioCtx = (window.AudioContext||window.webkitAudioContext);
      const a = new AudioCtx();
      const base = a.currentTime;
  // Short C–E–G arpeggio (sine), around middle C
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      const step = 0.09; // spacing between note starts
      const dur = 0.12;  // per-note duration
      notes.forEach((freq, i)=>{
        const t = base + i*step;
        const o = a.createOscillator();
        const g = a.createGain();
  o.type = 'sine';
        o.frequency.setValueAtTime(freq, t);
        o.connect(g);
        g.connect(a.destination);
        // Envelope: quick attack, quick decay
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.08, t+0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t+0.11);
        o.start(t);
        o.stop(t + dur);
      });
    }catch{}
  }
  function plink(){
    if(!ui.sound) return;
    try{
      const a = new (window.AudioContext||window.webkitAudioContext)();
      const o = a.createOscillator();
      const g = a.createGain();
  o.type = 'sine';
  o.frequency.value = 1046.5; // C6
      o.connect(g);
      g.connect(a.destination);
      const t = a.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t+0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t+0.12);
      o.start();
      o.stop(t+0.14);
    }catch{}
  }
  // Expose lightweight plink to DnD handlers defined outside main
  window._dailyRackPlink = plink;
  function renderStreak(){
    const el = document.getElementById('streak-badge'); if(!el) return;
    // Count consecutive days with a saved play
    let streak=0; for(let d=new Date();;){
      const key = todayKey(d); const has = !!localStorage.getItem(`daily-rack:${key}`);
      if(!has) break; streak++; d.setDate(d.getDate()-1);
    }
    el.textContent = `🔥 ${streak}`;
  }
  renderStreak();
  // Onboarding tip shown once
  const tip = document.getElementById('onboarding-tip');
  const TIP_KEY = 'daily-rack:tip-dismissed';
  if(tip){ if(localStorage.getItem(TIP_KEY)==='1') tip.classList.add('hidden');
    const btn=document.getElementById('tip-dismiss'); if(btn){ btn.addEventListener('click',()=>{ tip.classList.add('hidden'); try{localStorage.setItem(TIP_KEY,'1')}catch{} }); }
  }

  // Load of prior play kept for sharing, but gameplay restarts on refresh
  const prior = loadPlay(dateKey);
  const input = document.getElementById('word-input');
  const form = document.getElementById('play-form');
  const shareBtn = document.getElementById('share-btn');
  const shuffleBtn = document.getElementById('shuffle-btn');
  const resetBtn = document.getElementById('reset-btn');
  const usernameEl = document.getElementById('username-input');
  const avatarEl = document.getElementById('avatar-select'); // optional (legacy)
  const avatarGrid = document.getElementById('avatar-grid');
  const LAST_NAME_KEY = 'daily-rack:last-name';
  const LAST_AVATAR_KEY = 'daily-rack:last-avatar';
  try{
    const last = localStorage.getItem(LAST_NAME_KEY);
    if(usernameEl && last && !usernameEl.value){ usernameEl.value = last; }
  }catch{}
  try{
    const lastA = localStorage.getItem(LAST_AVATAR_KEY);
    if(avatarEl && lastA){ avatarEl.value = lastA; }
    if(avatarGrid && lastA){
      const btn = Array.from(avatarGrid.querySelectorAll('.avatar-btn')).find(b=>b.dataset.avatar===lastA);
      if(btn){
        Array.from(avatarGrid.querySelectorAll('.avatar-btn')).forEach(b=>b.setAttribute('aria-pressed','false'));
        btn.setAttribute('aria-pressed','true');
      }
    }
  }catch{}
  if(avatarEl){
    avatarEl.addEventListener('change', ()=>{
      try{ localStorage.setItem(LAST_AVATAR_KEY, avatarEl.value); }catch{}
      renderScoreboard();
      updateUserPreview();
    });
  }
  if(avatarGrid){
    avatarGrid.addEventListener('click', (e)=>{
      const t = e.target.closest('.avatar-btn');
      if(!t) return;
      Array.from(avatarGrid.querySelectorAll('.avatar-btn')).forEach(b=>b.setAttribute('aria-pressed','false'));
      t.setAttribute('aria-pressed','true');
      try{ localStorage.setItem(LAST_AVATAR_KEY, t.dataset.avatar || ''); }catch{}
      updateUserPreview();
      renderScoreboard();
    });
  }
  const avatarRandomBtn = document.getElementById('avatar-random');
  const avatarSaveBtn = document.getElementById('avatar-save');
  function getSelectedAvatar(){
    if(avatarEl) return avatarEl.value;
    if(avatarGrid){
      const sel = avatarGrid.querySelector('.avatar-btn[aria-pressed="true"]');
      if(sel) return sel.dataset.avatar || '';
    }
    return '';
  }
  function updateUserPreview(){
    const previewA = document.getElementById('user-preview-avatar');
    const previewN = document.getElementById('user-preview-name');
    const rawName = (usernameEl && usernameEl.value.trim()) ? usernameEl.value.trim() : '';
    const selAvatar = getSelectedAvatar();
    const hasName = !!rawName;
    const hasAvatar = !!selAvatar;

    // Update in-panel preview (fallback to Guest/initial for clarity)
    const previewAvatar = hasAvatar ? selAvatar : ((rawName[0] || '🙂').toUpperCase());
    const previewName = hasName ? rawName : 'Guest';
    if(previewA){ previewA.textContent = previewAvatar; }
    if(previewN){ previewN.textContent = previewName; }
    const headerAv = document.getElementById('header-avatar');
    if(headerAv){
      const span = headerAv.querySelector('.icon');
      const headerAvatar = (hasName || hasAvatar) ? (hasAvatar ? selAvatar : (rawName[0] || '🙂').toUpperCase()) : '👤';
      if(span) span.textContent = headerAvatar; else headerAv.textContent = headerAvatar;
    }
    const headerName = document.getElementById('header-username');
    if(headerName){ headerName.textContent = (hasName || hasAvatar) ? (rawName || 'Guest') : 'Sign in'; }
  }
  if(usernameEl){ usernameEl.addEventListener('input', ()=>{ updateUserPreview(); }); }
  if(avatarRandomBtn){
    avatarRandomBtn.addEventListener('click', ()=>{
      let choices = [];
      if(avatarEl){ choices = Array.from(avatarEl.options).map(o=>o.value); }
      if(avatarGrid){ choices = Array.from(avatarGrid.querySelectorAll('.avatar-btn')).map(b=>b.dataset.avatar); }
      if(!choices.length) return;
      const idx = Math.floor(Math.random()*choices.length);
      const val = choices[idx];
      if(avatarEl){ avatarEl.value = val; }
      if(avatarGrid){
        Array.from(avatarGrid.querySelectorAll('.avatar-btn')).forEach(b=>b.setAttribute('aria-pressed','false'));
        const btn = Array.from(avatarGrid.querySelectorAll('.avatar-btn')).find(b=>b.dataset.avatar===val);
        if(btn) btn.setAttribute('aria-pressed','true');
      }
      try{ localStorage.setItem(LAST_AVATAR_KEY, val); }catch{}
      updateUserPreview();
      renderScoreboard();
    });
  }
  if(avatarSaveBtn){
    avatarSaveBtn.addEventListener('click', ()=>{
      if(usernameEl){ try{ localStorage.setItem(LAST_NAME_KEY, usernameEl.value.trim()||'Guest'); }catch{} }
      if(avatarEl){ try{ localStorage.setItem(LAST_AVATAR_KEY, avatarEl.value); }catch{} }
      updateUserPreview();
      renderScoreboard();
      // Close the avatar chooser details to mimic accordion behavior
      const avd = document.getElementById('avatar-details');
      if(avd && avd.open){ avd.open = false; }
  // Also close the player menu overlay after saving
  const pm = document.getElementById('player-menu');
  if(pm){ pm.classList.add('hidden'); }
    });
  }
  updateUserPreview();

  const rnd = mulberry32(seed ^ 0xC0FFEE);
  shuffleBtn.addEventListener('click', ()=>{
    // Shuffle only non-null tiles, keep holes in place
    const positions = state.rackTileIds.map((v,i)=>({v,i}));
    const values = positions.filter(p=>p.v).map(p=>p.v);
    shuffleArrayInPlace(values, rnd);
    let vi=0;
    for(let i=0;i<RACK_SIZE;i++){
      if(state.rackTileIds[i]){ state.rackTileIds[i] = values[vi++]; }
    }
    renderAll();
  try{ shuffleBtn.classList.add('jiggle'); setTimeout(()=>shuffleBtn.classList.remove('jiggle'), 420); }catch{}
  });

  // Reset: move all tiles from slots back to rack without error styling
  if(resetBtn){
    resetBtn.addEventListener('click', ()=>{
      // Use the same logic as shakeAndRecall but without the shake animation
      for(let i=0;i<RACK_SIZE;i++){
        const id = state.slotTileIds[i];
        if(!id) continue;
        state.slotTileIds[i] = null;
        const emptyRackIndex = state.rackTileIds.indexOf(null);
        if (emptyRackIndex !== -1 && emptyRackIndex < RACK_SIZE) {
          state.rackTileIds[emptyRackIndex] = id;
        } else {
          if(state.rackTileIds.length < RACK_SIZE) {
            state.rackTileIds.push(id);
          }
        }
      }
      renderAll();
    });
  }

  // Do not block replaying on refresh; show best hint only
  const bestAtStart = findBestWord(rack);
  if(bestAtStart){
    document.getElementById('best-result').textContent = `Best possible (from loaded list): ${bestAtStart.word} = ${bestAtStart.score}`;
  }

  // Scoreboard persistence
  const SCOREBOARD_KEY = 'daily-rack:scoreboard';
  function loadScoreboard(){
    try{
      const raw = localStorage.getItem(SCOREBOARD_KEY);
      return raw ? JSON.parse(raw) : [];
    }catch{ return []; }
  }
  function saveScoreboard(list){
    try{ localStorage.setItem(SCOREBOARD_KEY, JSON.stringify(list)); }catch{}
  }
  function addToScoreboard(entry){
    const list = loadScoreboard();
    const withTs = {...entry, ts: Date.now()};
    list.push(withTs);
    // Keep all entries; we filter + limit during render
    saveScoreboard(list);
  }
  function renderScoreboard(){
    const list = loadScoreboard();
    // Filter to today, then collapse duplicates by username to their best score
    const today = list.filter(item => item.date === dateKey);
    const byUser = new Map(); // key = normalized name, value = best entry
    for(const item of today){
      const key = (item.name || 'Guest').trim().toLowerCase();
      const current = byUser.get(key);
      if(!current || item.score > current.score){
        byUser.set(key, item);
      }
    }
    const todayList = Array.from(byUser.values())
      .sort((a,b)=> b.score - a.score || (a.name||'').localeCompare(b.name||''));
    const ul = document.getElementById('scoreboard-list');
    if(!ul) return;
    ul.innerHTML = '';
    if(todayList.length===0){
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'No scores yet for today — be the first!';
      ul.appendChild(li);
      return;
    }
    // Show only top 10 with avatars + medals
    todayList.slice(0,10).forEach((item, idx)=>{
      const li = document.createElement('li');
      li.className = 'lb-row';
      const avatar = document.createElement('div');
      avatar.className = 'lb-avatar';
      const letter = (item.name||'')[0] ? (item.name[0].toUpperCase()) : '?';
      avatar.textContent = item.avatar || letter;
      const info = document.createElement('div');
      info.className = 'lb-info';
      const nm = document.createElement('div');
      nm.className = 'lb-name';
      nm.textContent = item.name;
      if(idx < 3){
        const medal = document.createElement('span');
        medal.className = 'lb-medal';
        medal.textContent = idx===0?'\ud83e\udd47': (idx===1?'\ud83e\udd48':'\ud83e\udd49');
        nm.appendChild(medal);
      }
      const dt = document.createElement('div');
      dt.className = 'lb-date';
      dt.textContent = item.date;
      info.appendChild(nm);
      info.appendChild(dt);
      const scoreEl = document.createElement('div');
      scoreEl.className = 'lb-score';
      scoreEl.textContent = item.score;
      li.appendChild(avatar);
      li.appendChild(info);
      li.appendChild(scoreEl);
      ul.appendChild(li);
    });

    // Also show the user's newest entry as the 11th row (if not already in top 10)
    let myName = 'Guest';
    if(usernameEl && usernameEl.value.trim()) myName = usernameEl.value.trim();
    else{
      try{ const last = localStorage.getItem(LAST_NAME_KEY); if(last) myName = last; }catch{}
    }
    const myKey = myName.trim().toLowerCase();
    const todayAll = today.slice();
    const myEntries = todayAll.filter(e => (e.name||'Guest').trim().toLowerCase() === myKey);
    if(myEntries.length){
      // newest by timestamp if present, else fallback to last in array
      let newest = myEntries[0];
      for(const e of myEntries){ if((e.ts||0) > (newest.ts||0)) newest = e; }
      // Did newest already place in top10 (as best)?
      const myBest = byUser.get(myKey);
      const inTop10 = todayList.slice(0,10).some(x => x === myBest && myBest === newest);
      if(!inTop10){
        // Compute real rank among all submissions today (not deduped), sorted by score desc then ts asc
        const sortedAll = todayAll.slice().sort((a,b)=>{
          if(b.score !== a.score) return b.score - a.score;
          return (a.ts||0) - (b.ts||0);
        });
        const rank = sortedAll.findIndex(x=> x === newest) + 1;
  const li = document.createElement('li');
  li.className = 'lb-row';
  const avatar = document.createElement('div');
        avatar.className = 'lb-avatar';
        avatar.textContent = newest.avatar || ((newest.name||'?')[0]?.toUpperCase() || '?');
        const info = document.createElement('div');
        info.className = 'lb-info';
        const nm = document.createElement('div');
        nm.className = 'lb-name';
  nm.textContent = newest.name + ' (latest)';
  // Move the rank indicator to the right side of the user's name
  const pos = document.createElement('span');
  pos.className = 'lb-medal';
  pos.textContent = `#${rank}`;
  nm.appendChild(pos);
        const dt = document.createElement('div');
        dt.className = 'lb-date';
        dt.textContent = newest.date;
        info.appendChild(nm);
        info.appendChild(dt);
        const scoreEl = document.createElement('div');
        scoreEl.className = 'lb-score';
        scoreEl.textContent = newest.score;
        li.appendChild(avatar);
        li.appendChild(info);
        li.appendChild(scoreEl);
        ul.appendChild(li);
      }
    }
  }
  renderScoreboard();

  form.addEventListener('submit', (e)=>{
    e.preventDefault();

    const rawInput = currentWordFromSlots().trim();
    const raw = rawInput.normalize('NFC').toUpperCase();
    if(!raw){ setMessage('Enter a word.', 'error'); return; }
    if(raw.length>RACK_SIZE){ setMessage(`Max ${RACK_SIZE} letters.`, 'error'); return; }
    // Allow English A–Z and Icelandic letters (uppercase). Use Unicode flag.
    if(!/^[A-ZÁÐÉÍÓÚÝÞÆÖ]+$/u.test(raw)){
      setMessage('Only valid letters allowed.', 'error');
      return;
    }
    // Enforce Icelandic dictionary strictly (unless Dev toggle is on)
    const devAllow = devToggle && devToggle.checked;
    if(!devAllow){
      if(!DICT){
        setMessage('Dictionary not loaded. Please wait and try again.', 'error');
        return;
      }
      if(!DICT.has(raw)){
        setMessage('Not in dictionary.', 'error');
        shakeAndRecall();
        return;
      }
    }
    const score = scoreWord(raw);
  setMessage(`Nice! You scored ${score}. You can submit again.`, 'success');
    // Celebrate subtly
    {
      const card = document.querySelector('.card'); if(card){ card.classList.add('celebrate'); setTimeout(()=>card.classList.remove('celebrate'), 650); }
    }
  beep();
  // Removed confetti burst after submission per request
  showToast('Great move!');
    // Floating total score bubble near submit
    try{
      const btn = document.getElementById('submit-btn');
      if(btn){
        const r = btn.getBoundingClientRect();
        const b = document.createElement('div'); b.className='score-float'; b.textContent = `+${score}`;
        b.style.left = `${r.left + r.width/2 - 12}px`; b.style.top = `${r.top - 8}px`;
        document.body.appendChild(b); setTimeout(()=>b.remove(), 800);
      }
    }catch{}
    setScore(formatScoreBreakdown(raw));
    savePlay(dateKey, {word: raw, score, rack});
    // Add to scoreboard
    const name = (usernameEl && usernameEl.value.trim()) ? usernameEl.value.trim() : 'Guest';
    const avatar = getSelectedAvatar();
    try{ localStorage.setItem(LAST_NAME_KEY, name); }catch{}
    try{ if(avatar) localStorage.setItem(LAST_AVATAR_KEY, avatar); }catch{}
    addToScoreboard({name, word: raw, score, date: dateKey, avatar});
    renderScoreboard();
    renderStreak();
    // Show result modal with score and current rank (deduped leaderboard)
    try{
      const list = loadScoreboard();
      const today = list.filter(it => it.date === dateKey);
      const byUser = new Map();
      for(const it of today){
        const key = (it.name||'Guest').trim().toLowerCase();
        const cur = byUser.get(key);
        if(!cur || it.score > cur.score){ byUser.set(key, it); }
      }
      const sorted = Array.from(byUser.values()).sort((a,b)=> b.score - a.score || (a.name||'').localeCompare(b.name||''));
      const myKey = (name||'Guest').trim().toLowerCase();
      const myBest = byUser.get(myKey);
      const rank = myBest ? (sorted.findIndex(x=>x===myBest)+1) : '-';
      const modal = document.getElementById('result-modal');
      const scoreEl = document.getElementById('modal-score');
      const rankEl = document.getElementById('modal-rank');
      if(scoreEl) scoreEl.textContent = String(score);
      if(rankEl) rankEl.textContent = `#${rank}`;
      if(modal){ modal.classList.remove('hidden'); }
    }catch{}
    const best = findBestWord(rack);
    if(best){
      document.getElementById('best-result').textContent = `Best possible (from loaded list): ${best.word} = ${best.score}`;
    }
    // Keep submit enabled for multiple answers; tiles remain draggable
  });

  // Header menus: settings/help/player
  function toggle(id){ const el=document.getElementById(id); if(!el) return; el.classList.toggle('hidden'); }
  // Header sound toggle mirrors the Settings sound checkbox
  const soundBtn = document.getElementById('sound-btn');
  function syncSoundIcon(){
    const on = !!(soundToggle && soundToggle.checked);
    if(soundBtn){
      const span = soundBtn.querySelector('.icon');
      if(span) span.textContent = on ? '🔊' : '🔈';
      soundBtn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    }
  }
  if(soundToggle){
    soundToggle.addEventListener('change', ()=>{ syncSoundIcon(); });
  }
  if(soundBtn){
    soundBtn.addEventListener('click', ()=>{
      if(!soundToggle) return;
      soundToggle.checked = !soundToggle.checked;
  // Persist via existing UI state helpers
  try{ ui.sound = soundToggle.checked; saveUI(ui); }catch{}
      syncSoundIcon();
    });
  }
  syncSoundIcon();
  const helpBtn = document.getElementById('help-btn');
  if(helpBtn){ helpBtn.addEventListener('click', ()=> toggle('help-menu')); }
  const headerAv = document.getElementById('header-avatar');
  if(headerAv){ headerAv.addEventListener('click', ()=> toggle('player-menu')); }

  // Modal close handlers
  const modal = document.getElementById('result-modal');
  const modalClose = document.getElementById('modal-close');
  if(modalClose){ modalClose.addEventListener('click', ()=> modal.classList.add('hidden')); }
  if(modal){
    modal.addEventListener('click', (ev)=>{ if(ev.target === modal) modal.classList.add('hidden'); });
    window.addEventListener('keydown', (ev)=>{ if(ev.key==='Escape') modal.classList.add('hidden'); });
  }

  shareBtn.addEventListener('click', async ()=>{
    const played = loadPlay(dateKey);
    if(!played){ setMessage('Play first, then share.'); return; }
    const text = shareText(dateKey, rack, played.word, played.score);
    try{
      await navigator.clipboard.writeText(text);
      setMessage('Result copied to clipboard!');
    }catch{
      // fallback
      prompt('Copy your result:', text);
    }
  });
}

function updateSubmitGlow(){
  const btn = document.getElementById('submit-btn'); if(!btn) return;
  const filled = state.slotTileIds.filter(Boolean).length;
  const a = Math.min(0.6, 0.1 + filled * 0.08); // stronger glow as more tiles placed
  btn.style.setProperty('--glow-a', a.toFixed(2));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
