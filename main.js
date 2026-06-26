import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

// ---- eye icons (open = visible, closed = hidden) ----
const EYE_OPEN = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_CLOSED = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
const eyeIcon = (on) => on ? EYE_OPEN : EYE_CLOSED;

// ---- category definitions (order = panel order) ----
const CATEGORIES = [
  { id: 'soil',           label: 'Soil / Terrain',                 color: '#9c6b3f' },
  { id: 'piers',          label: 'Bored Pier — SPW6 / CB3',        color: '#7a7066' },
  { id: 'spw_1',          label: 'SPW Pile Wall — SPW1 RL 6.50',   color: '#9aa6b2' },
  { id: 'spw_2',          label: 'SPW2 Pile Wall',                 color: '#8f9aa6' },
  { id: 'spw_3',          label: 'SPW3 Pile Wall',                 color: '#848e99' },
  { id: 'spw_4',          label: 'SPW4 Pile Wall',                 color: '#79828c' },
  { id: 'spw_5',          label: 'SPW Pile Wall — SPW5 / CB1 RL 4.70', color: '#6e767f' },
  { id: 'spw_wall',       label: 'SPW Pile Walls',                 color: '#808080' },
  { id: 'retaining_wall', label: 'RTW1(O) Retaining Walls',        color: '#8c8c8c' },
  { id: 'capping_beam',   label: 'SPW2&3 Retention Walls',         color: '#9a9a96' },
  { id: 'slab',           label: 'Ground Slab',                    color: '#a0a09c' },
  { id: 'shotcrete_side', label: 'Shotcrete — Sides',              color: '#9a9088' },
  { id: 'shotcrete_back', label: 'Shotcrete — Back',               color: '#827a72' },
  { id: 'excavator',      label: 'Excavator',       color: '#d9b53d' },
  { id: 'neighbour',      label: 'Neighbour House', color: '#a8503c' },
  { id: 'other',          label: 'Other',           color: '#b0b0b0' },
];

// ---- scene setup ----
const viewport = document.getElementById('viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1e1f22);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

// ---- transform gizmo for manually placing the excavator ----
const gizmo = new TransformControls(camera, renderer.domElement);
gizmo.addEventListener('dragging-changed', (e) => { controls.enabled = !e.value; });
gizmo.addEventListener('objectChange', () => updateGizmoReadout());
scene.add(gizmo);

function updateGizmoReadout() {
  const box = document.getElementById('gizmoReadout');
  if (!box || !gizmo.object) return;
  const p = gizmo.object.position, q = gizmo.object.quaternion;
  const f = (n) => n.toFixed(3);
  const stageId = stagesList[stageIndex] ? stagesList[stageIndex].id : '?';
  box.querySelector('#grPos').textContent = `[${f(p.x)}, ${f(p.y)}, ${f(p.z)}]`;
  box.querySelector('#grQuat').textContent = `[${f(q.x)}, ${f(q.y)}, ${f(q.z)}, ${f(q.w)}]`;
  box.querySelector('#grStage').textContent = stageId;
  box.querySelector('#grJson').textContent =
    `"excavator": { "pos": [${f(p.x)}, ${f(p.y)}, ${f(p.z)}], "quat": [${f(q.x)}, ${f(q.y)}, ${f(q.z)}, ${f(q.w)}] }`;
}

// ---- level reference plane (movable datum, vertical only) ----
const levelPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ color: 0x4a8db0, transparent: true, opacity: 0.25,
                                side: THREE.DoubleSide, depthWrite: false })
);
levelPlane.rotation.x = -Math.PI / 2;          // horizontal, normal = +Y (up)
levelPlane.visible = false;
levelPlane.add(new THREE.LineSegments(
  new THREE.EdgesGeometry(levelPlane.geometry),
  new THREE.LineBasicMaterial({ color: 0x8fd0ec })
));
scene.add(levelPlane);

const levelCtrl = new TransformControls(camera, renderer.domElement);
levelCtrl.setMode('translate');
levelCtrl.showX = false; levelCtrl.showZ = false;   // vertical movement only
levelCtrl.addEventListener('dragging-changed', (e) => { controls.enabled = !e.value; });
levelCtrl.addEventListener('objectChange', updateLevelReadout);
levelCtrl.visible = false;
scene.add(levelCtrl);

let levelActive = false, levelInit = false;
function updateLevelReadout() {
  const el = document.getElementById('levelValue');
  if (el) el.textContent = levelPlane.position.y.toFixed(2) + ' m';
  const inp = document.getElementById('levelInput');
  if (inp && document.activeElement !== inp) inp.value = levelPlane.position.y.toFixed(2);
}
function sizeLevelPlane() {
  if (modelBounds.isEmpty()) return;
  const size = modelBounds.getSize(new THREE.Vector3());
  const c = modelBounds.getCenter(new THREE.Vector3());
  const s = Math.max(size.x, size.z) * 1.3;
  levelPlane.scale.set(s, s, 1);
  levelPlane.position.x = c.x; levelPlane.position.z = c.z;
  if (!levelInit) { levelPlane.position.y = Math.round(c.y); levelInit = true; }
}

let autoRotateCamera = true;
const AUTO_ROTATE_SPEED = 0.0012;
const ZOOM_IN_SCALE = 0.82;
const ZOOM_OUT_SCALE = 1.22;
const INITIAL_ZOOM_LEVELS = 0.45;

function stopAutoRotate() {
  autoRotateCamera = false;
}

renderer.domElement.addEventListener('pointerdown', stopAutoRotate);
renderer.domElement.addEventListener('wheel', stopAutoRotate, { passive: true });
renderer.domElement.addEventListener('touchstart', stopAutoRotate, { passive: true });

// lighting
scene.add(new THREE.HemisphereLight(0xffffff, 0x444448, 1.1));
const sun = new THREE.DirectionalLight(0xfff4e6, 1.6);
sun.position.set(60, 120, 80);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xaaccff, 0.5);
fill.position.set(-80, 40, -60);
scene.add(fill);

const grid = new THREE.GridHelper(400, 40, 0x3c3f45, 0x2c2e33);
scene.add(grid);

// ---- state ----
let groups = {};          // cat -> array of meshes (current stage)
let soilMats = [];        // soil materials to fade for x-ray
let modelBounds = new THREE.Box3();
let currentRoot = null;   // currently loaded gltf scene
let stagesList = [];      // manifest
let stageIndex = 0;
let firstLoad = true;
let prevStageCats = new Set();   // categories present in the previously loaded stage
const hidden = {};        // cat -> bool (persist layer visibility across stages)

// bump ASSET_V whenever model .glb files change, so browsers fetch the new ones
const ASSET_V = '18';
const bust = (url) => url + (url.includes('?') ? '&' : '?') + 'v=' + ASSET_V;

const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/');
loader.setDRACOLoader(draco);
const loadingEl = document.getElementById('loading');

// ---- overlays (lazy-loaded once, persist across stages) ----
const EXCAVATOR_FILE = 'models/excavator.glb';
const overlayRoots = {};   // file -> gltf scene
const overlayOn = {};      // file -> user wants it on

// Position/orient/show the excavator for the current stage.
// stage.excavator = { pos:[x,y,z], quat:[x,y,z,w] }, or null (stage has no excavator).
function updateExcavatorForStage() {
  const root = overlayRoots[EXCAVATOR_FILE];
  if (!root) return;
  const x = stagesList[stageIndex]?.excavator;
  if (x && x.pos) {
    root.position.set(x.pos[0], x.pos[1], x.pos[2]);
    if (x.quat) root.quaternion.set(x.quat[0], x.quat[1], x.quat[2], x.quat[3]);
    root.visible = !!overlayOn[EXCAVATOR_FILE];
  } else {
    root.visible = false;   // this stage has no excavator
  }
  refreshGizmoAttachment();
}

// ---- excavator move gizmo wiring ----
let gizmoActive = false;
function refreshGizmoAttachment() {
  const root = overlayRoots[EXCAVATOR_FILE];
  const readout = document.getElementById('gizmoReadout');
  if (gizmoActive && root && root.visible) {
    gizmo.attach(root); gizmo.visible = true;
    readout.style.display = 'block'; updateGizmoReadout();
  } else {
    gizmo.detach(); gizmo.visible = false;
    readout.style.display = 'none';
  }
}
function setGizmoMode(mode) {
  gizmo.setMode(mode);
  document.getElementById('gizmoMove').classList.toggle('active', mode === 'translate');
  document.getElementById('gizmoRotate').classList.toggle('active', mode === 'rotate');
}
document.getElementById('gizmoToggle').addEventListener('click', () => {
  gizmoActive = !gizmoActive;
  if (gizmoActive) autoRotateCamera = false;
  document.getElementById('gizmoToggle').classList.toggle('active', gizmoActive);
  document.getElementById('gizmoToggle').textContent = gizmoActive ? 'Disable Move Gizmo' : 'Enable Move Gizmo';
  // make sure the excavator is loaded + visible
  if (gizmoActive) {
    const cb = document.querySelector('.overlay-row[data-file="' + EXCAVATOR_FILE + '"] input');
    if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
  }
  refreshGizmoAttachment();
});
document.getElementById('gizmoMove').addEventListener('click', () => setGizmoMode('translate'));
document.getElementById('gizmoRotate').addEventListener('click', () => setGizmoMode('rotate'));
setGizmoMode('translate');

// ---- level plane toggle ----
document.getElementById('levelToggle').addEventListener('click', () => {
  levelActive = !levelActive;
  if (levelActive) { autoRotateCamera = false; sizeLevelPlane(); levelCtrl.attach(levelPlane); }
  else { levelCtrl.detach(); }
  levelPlane.visible = levelActive;
  levelCtrl.visible = levelActive;
  document.getElementById('levelReadout').style.display = levelActive ? 'block' : 'none';
  const btn = document.getElementById('levelToggle');
  btn.classList.toggle('active', levelActive);
  btn.textContent = levelActive ? 'Hide Level Plane' : 'Show Level Plane';
  updateLevelReadout();
});
document.getElementById('levelInput').addEventListener('input', () => {
  const v = parseFloat(document.getElementById('levelInput').value);
  if (!Number.isNaN(v)) { levelPlane.position.y = v; document.getElementById('levelValue').textContent = v.toFixed(2) + ' m'; }
});

document.querySelectorAll('.overlay-row').forEach(row => {
  const cb = row.querySelector('input');
  const file = row.dataset.file;
  cb.addEventListener('change', () => {
    const on = cb.checked;
    overlayOn[file] = on;
    row.querySelector('.eye').innerHTML = eyeIcon(on);
    row.classList.toggle('off', !on);
    if (on && !overlayRoots[file]) {
      loadingEl.textContent = 'Loading overlay…';
      loadingEl.style.display = 'flex';
      loader.load(bust(file), (g) => {
        overlayRoots[file] = g.scene;
        scene.add(g.scene);
        loadingEl.style.display = 'none';
        if (file === EXCAVATOR_FILE) updateExcavatorForStage();
      }, undefined, (err) => { loadingEl.textContent = 'Overlay failed: ' + err; });
    } else if (overlayRoots[file]) {
      overlayRoots[file].visible = on;
      if (file === EXCAVATOR_FILE) updateExcavatorForStage();
    }
  });
});

function disposeRoot(root) {
  root.traverse(o => {
    if (o.isMesh) {
      o.geometry?.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => m?.dispose());
    }
  });
  scene.remove(root);
}

function loadStage(idx) {
  const stage = stagesList[idx];
  if (!stage) return;
  stageIndex = idx;
  syncScrubber(idx);
  loadingEl.textContent = 'Loading ' + stage.label + '…';
  loadingEl.style.display = 'flex';

  loader.load(bust(stage.file), (gltf) => {
    if (currentRoot) disposeRoot(currentRoot);
    groups = {}; soilMats = [];
    CATEGORIES.forEach(c => groups[c.id] = []);

    const root = gltf.scene;
    root.traverse((o) => {
      if (!o.isMesh) return;
      const cat = (o.userData && o.userData.cat) || 'other';
      (groups[cat] || groups.other).push(o);
      if (cat === 'soil') {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => { m.transparent = true; soilMats.push(m); });
      }
    });
    scene.add(root);
    currentRoot = root;

    // re-apply persisted layer visibility + current soil opacity
    Object.keys(groups).forEach(cat => {
      if (hidden[cat]) groups[cat].forEach(m => m.visible = false);
    });
    applySoilOpacity();

    if (firstLoad) {
      modelBounds.setFromObject(root);
      frameView('iso', true);
      firstLoad = false;
    }
    // fade in only the elements newly appearing vs the previous stage
    const curCats = new Set(Object.keys(groups).filter(id => groups[id].length));
    const newCats = new Set([...curCats].filter(id => !prevStageCats.has(id)));
    prevStageCats = curCats;
    introReveal(newCats);
    buildLayerPanel();
    updateExcavatorForStage();
    loadingEl.style.display = 'none';
  }, undefined, (err) => {
    loadingEl.textContent = 'Failed to load: ' + err;
  });
}

// ---- stage scrubber (timeline slider at bottom of viewport) ----
const scrub = document.getElementById('stageScrub');
const scrubLabel = document.getElementById('scrubLabel');
const scrubTicks = document.getElementById('scrubTicks');

function setupScrubber(list) {
  scrub.max = String(list.length - 1);
  const lastIdx = Math.max(1, list.length - 1);
  // tick labels positioned at the exact thumb-center fraction (inset by half the thumb)
  scrubTicks.innerHTML = list.map((s, i) => {
    const short = (s.label.split('—')[0] || '').trim() || s.id;
    const frac = i / lastIdx;
    return `<span style="left:calc(var(--thumb,18px)/2 + (100% - var(--thumb,18px)) * ${frac})">${short}</span>`;
  }).join('');
  scrub.addEventListener('input', () => {
    const i = parseInt(scrub.value, 10);
    scrubLabel.textContent = stagesList[i] ? stagesList[i].label : 'Stage';
    updateScrubTicks(i);
    if (i !== stageIndex) loadStage(i);
  });
}

function updateScrubTicks(i) {
  [...scrubTicks.children].forEach((el, k) => el.classList.toggle('active', k === i));
}

function syncScrubber(idx) {
  if (!scrub) return;
  scrub.value = String(idx);
  scrubLabel.textContent = stagesList[idx] ? stagesList[idx].label : 'Stage';
  updateScrubTicks(idx);
  const frac = stagesList.length > 1 ? idx / (stagesList.length - 1) : 0;
  scrub.style.setProperty('--pct', `calc(var(--thumb,18px)/2 + (100% - var(--thumb,18px)) * ${frac})`);
}

// ---- load manifest, then first stage ----
fetch('models/stages.json?v=' + Date.now())
  .then(r => r.json())
  .then(list => {
    stagesList = list;
    setupScrubber(list);
    const initialStage = stagesList.findIndex(s => s.id === 'ngl');
    loadStage(initialStage >= 0 ? initialStage : 0);  // start on 00 - NGL
  })
  .catch(e => { loadingEl.textContent = 'Failed to load manifest: ' + e; });

// ---- layer panel ----
function buildLayerPanel() {
  const host = document.getElementById('layers');
  host.innerHTML = '';
  CATEGORIES.forEach(c => {
    const n = groups[c.id].length;
    if (n === 0) return;  // skip empty categories
    const row = document.createElement('label');
    row.className = 'layer';
    row.innerHTML = `
      <span class="swatch" style="background:${c.color}"></span>
      <span class="name">${c.label}</span>
      <span class="count">${n}</span>
      <span class="eye">${EYE_OPEN}</span>
      <input type="checkbox" checked />`;
    const cb = row.querySelector('input');
    cb.checked = !hidden[c.id];
    row.classList.toggle('off', !cb.checked);
    row.querySelector('.eye').innerHTML = eyeIcon(cb.checked);
    groups[c.id].forEach(m => m.visible = cb.checked);
    cb.addEventListener('change', () => {
      hidden[c.id] = !cb.checked;
      groups[c.id].forEach(m => m.visible = cb.checked);
      row.classList.toggle('off', !cb.checked);
      row.querySelector('.eye').innerHTML = eyeIcon(cb.checked);
    });
    host.appendChild(row);
  });
}

// ---- intro reveal: fade layers in sequentially, terrain last ----
// Robust to shared materials (e.g. all SPW walls share one material) and to
// fast scrubbing: every load first forces all current materials fully opaque,
// then fades ONLY the newly-appearing categories. Each material is faded at
// most once (global dedupe) so a shared material can never be left transparent.
const introTokenRef = { v: 0 };
function setMatOpaque(mat) {
  if (soilMats.includes(mat)) return;   // soil handled by the x-ray slider
  mat.opacity = 1; mat.transparent = false; mat.depthWrite = true;
}
function eachMat(mesh, fn) {
  (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => m && fn(m));
}

function introReveal(onlyCats) {
  const token = ++introTokenRef.v;   // cancels any in-flight fade

  // 1. baseline: everything in the current stage is fully visible
  Object.values(groups).forEach(arr => arr.forEach(m => eachMat(m, setMatOpaque)));
  applySoilOpacity();

  // 2. collect the materials to fade, per category, deduped globally
  const order = ['piers','spw_1','spw_2','spw_3','spw_4','spw_5','spw_wall',
                 'retaining_wall','capping_beam','slab','shotcrete_side','shotcrete_back','other','soil'];
  let present = order.filter(id => groups[id] && groups[id].length);
  if (onlyCats) present = present.filter(id => onlyCats.has(id));
  const seen = new Set();
  const steps = [];
  present.forEach(id => {
    const mats = [];
    groups[id].forEach(m => eachMat(m, mat => {
      if (!seen.has(mat)) { seen.add(mat); mats.push(mat); }
    }));
    if (mats.length) {
      mats.forEach(mat => { mat.transparent = true; mat.opacity = 0; mat.depthWrite = false; });
      steps.push({ id, mats });
    }
  });
  if (!steps.length) return;

  const FADE = 650, STAGGER = 340;
  const start = performance.now();
  function tick(now) {
    if (token !== introTokenRef.v) return;   // superseded by a newer load
    let done = true;
    steps.forEach((step, i) => {
      const p = Math.min(1, Math.max(0, (now - (start + i * STAGGER)) / FADE));
      const ease = p * (2 - p);  // easeOutQuad
      const target = (step.id === 'soil') ? (slider.value / 100) : 1;
      step.mats.forEach(mat => { mat.opacity = ease * target; });
      if (p < 1) done = false;
    });
    if (!done) { requestAnimationFrame(tick); return; }
    // settle to final state
    steps.forEach(step => step.mats.forEach(mat => {
      if (step.id === 'soil') { applySoilOpacity(); }
      else { mat.opacity = 1; mat.transparent = false; mat.depthWrite = true; }
    }));
  }
  requestAnimationFrame(tick);
}

// ---- soil x-ray slider ----
const slider = document.getElementById('soilOpacity');
const soilVal = document.getElementById('soilVal');
function applySoilOpacity() {
  const v = slider.value / 100;
  soilVal.textContent = slider.value + '%';
  soilMats.forEach(m => {
    m.opacity = v;
    m.depthWrite = v > 0.98;   // let geometry behind show through when faded
  });
}
slider.addEventListener('input', applySoilOpacity);

// ---- camera framing ----
function frameView(kind, keepAutoRotate = false) {
  if (!keepAutoRotate) stopAutoRotate();
  if (modelBounds.isEmpty()) return;
  const c = modelBounds.getCenter(new THREE.Vector3());
  const size = modelBounds.getSize(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z);
  const d = r * 1.6;
  const pos = {
    iso:   [c.x + d * 0.8, c.y + d * 0.7, c.z + d * 0.8],
    top:   [c.x + 0.01,    c.y + d * 1.6, c.z + 0.01],
    front: [c.x,           c.y + d * 0.2, c.z + d],
    side:  [c.x + d,       c.y + d * 0.2, c.z],
  }[kind] || [c.x + d, c.y + d, c.z + d];
  camera.position.set(...pos);
  if (keepAutoRotate && kind === 'iso') {
    camera.position.sub(c).applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI).add(c);
    const offset = camera.position.clone().sub(c).multiplyScalar(ZOOM_IN_SCALE ** INITIAL_ZOOM_LEVELS);
    camera.position.copy(c).add(offset);
  }
  controls.target.copy(c);
  controls.update();
}

document.querySelectorAll('[data-view]').forEach(b =>
  b.addEventListener('click', () => frameView(b.dataset.view)));
document.getElementById('resetBtn').addEventListener('click', () => frameView('iso'));

function zoomCamera(scale) {
  stopAutoRotate();
  const offset = camera.position.clone().sub(controls.target);
  const currentDistance = offset.length();
  if (currentDistance === 0) return;

  const nextDistance = THREE.MathUtils.clamp(currentDistance * scale, 4, 600);
  camera.position.copy(controls.target).add(offset.setLength(nextDistance));
  controls.update();
}

document.getElementById('zoomInBtn').addEventListener('click', () => zoomCamera(ZOOM_IN_SCALE));
document.getElementById('zoomOutBtn').addEventListener('click', () => zoomCamera(ZOOM_OUT_SCALE));

// ---- resize + render loop ----
function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function animate() {
  requestAnimationFrame(animate);
  if (autoRotateCamera && !modelBounds.isEmpty()) {
    camera.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), AUTO_ROTATE_SPEED).add(controls.target);
  }
  controls.update();
  renderer.render(scene, camera);
}
animate();
