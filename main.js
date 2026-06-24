import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// ---- category definitions (order = panel order) ----
const CATEGORIES = [
  { id: 'soil',           label: 'Soil / Terrain',  color: '#9c6b3f' },
  { id: 'piers',          label: 'Bored Piers',     color: '#7a7066' },
  { id: 'spw_wall',       label: 'SPW Pile Walls',  color: '#808080' },
  { id: 'retaining_wall', label: 'Retaining Walls', color: '#8c8c8c' },
  { id: 'capping_beam',   label: 'Capping Beams',   color: '#9a9a96' },
  { id: 'slab',           label: 'Slab',            color: '#a0a09c' },
  { id: 'shotcrete',      label: 'Shotcrete',       color: '#999990' },
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
const hidden = {};        // cat -> bool (persist layer visibility across stages)

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
}

document.querySelectorAll('.overlay-row').forEach(row => {
  const cb = row.querySelector('input');
  const file = row.dataset.file;
  cb.addEventListener('change', () => {
    const on = cb.checked;
    overlayOn[file] = on;
    row.querySelector('.eye').textContent = on ? '●' : '○';
    row.classList.toggle('off', !on);
    if (on && !overlayRoots[file]) {
      loadingEl.textContent = 'Loading overlay…';
      loadingEl.style.display = 'flex';
      loader.load(file, (g) => {
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
  document.getElementById('stageSelect').value = stage.id;
  loadingEl.textContent = 'Loading ' + stage.label + '…';
  loadingEl.style.display = 'flex';

  loader.load(stage.file, (gltf) => {
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
    buildLayerPanel();
    updateExcavatorForStage();
    loadingEl.style.display = 'none';
  }, undefined, (err) => {
    loadingEl.textContent = 'Failed to load: ' + err;
  });
}

// ---- load manifest, then first stage ----
fetch('models/stages.json?v=' + Date.now())
  .then(r => r.json())
  .then(list => {
    stagesList = list;
    const sel = document.getElementById('stageSelect');
    sel.innerHTML = list.map(s => `<option value="${s.id}">${s.label}</option>`).join('');
    sel.addEventListener('change', () => {
      const i = stagesList.findIndex(s => s.id === sel.value);
      if (i >= 0) loadStage(i);
    });
    document.getElementById('prevStage').addEventListener('click',
      () => loadStage(Math.max(0, stageIndex - 1)));
    document.getElementById('nextStage').addEventListener('click',
      () => loadStage(Math.min(stagesList.length - 1, stageIndex + 1)));
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
      <span class="eye">●</span>
      <input type="checkbox" checked />`;
    const cb = row.querySelector('input');
    cb.checked = !hidden[c.id];
    row.classList.toggle('off', !cb.checked);
    row.querySelector('.eye').textContent = cb.checked ? '●' : '○';
    groups[c.id].forEach(m => m.visible = cb.checked);
    cb.addEventListener('change', () => {
      hidden[c.id] = !cb.checked;
      groups[c.id].forEach(m => m.visible = cb.checked);
      row.classList.toggle('off', !cb.checked);
      row.querySelector('.eye').textContent = cb.checked ? '●' : '○';
    });
    host.appendChild(row);
  });
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
