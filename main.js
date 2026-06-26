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
renderer.autoClear = false;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

// ---- viewport orientation gizmo ----
const viewGizmoScene = new THREE.Scene();
const viewGizmoCamera = new THREE.OrthographicCamera(-1.65, 1.65, 1.65, -1.65, 0.1, 10);
viewGizmoCamera.position.set(0, 0, 5);
const viewGizmoRoot = new THREE.Group();
viewGizmoScene.add(viewGizmoRoot);
const viewGizmoSpheres = [];
const viewGizmoTooltip = document.getElementById('gizmoTooltip');
let viewGizmoDragging = false;
let viewGizmoStart = null;
let viewGizmoLast = null;
let viewGizmoMoved = false;

function makeAxisLabel(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(32, 32, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1e1f22';
  ctx.font = '700 28px -apple-system, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 32, 33);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false }));
  sprite.scale.set(0.64, 0.64, 1);
  sprite.renderOrder = 4;
  return sprite;
}
function addViewGizmoAxis(name, direction, color, view) {
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), direction.clone().multiplyScalar(1.05)]),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false })
  );
  viewGizmoRoot.add(line);

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 24, 16),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthTest: false })
  );
  sphere.position.copy(direction).multiplyScalar(1.22);
  sphere.userData.view = view;
  sphere.userData.tooltip = `${name} view`;
  viewGizmoRoot.add(sphere);
  viewGizmoSpheres.push(sphere);

  const label = makeAxisLabel(name, '#' + new THREE.Color(color).getHexString());
  label.position.copy(sphere.position);
  label.userData.view = view;
  label.userData.tooltip = `${name} view`;
  viewGizmoRoot.add(label);
  viewGizmoSpheres.push(label);
}
addViewGizmoAxis('X', new THREE.Vector3(1, 0, 0), 0xbc4050, 'side');
addViewGizmoAxis('Y', new THREE.Vector3(0, 1, 0), 0x9bd13d, 'top');
addViewGizmoAxis('Z', new THREE.Vector3(0, 0, 1), 0x4fa3f7, 'front');
const isoSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.28, 24, 16),
  new THREE.MeshBasicMaterial({ color: 0x4a8db0, transparent: true, opacity: 0.65, depthTest: false })
);
isoSphere.position.set(-0.8, -0.85, 0);
isoSphere.userData.view = 'iso';
isoSphere.userData.tooltip = 'Iso view';
viewGizmoRoot.add(isoSphere);
viewGizmoSpheres.push(isoSphere);

function getViewGizmoBox() {
  const size = viewport.clientWidth <= 760 ? 116 : 132;
  const margin = viewport.clientWidth <= 760 ? 10 : 16;
  return { left: viewport.clientWidth - margin - size, top: margin, size };
}
function eventInViewGizmo(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const box = getViewGizmoBox();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  return x >= box.left && x <= box.left + box.size && y >= box.top && y <= box.top + box.size;
}
function pickViewGizmo(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const box = getViewGizmoBox();
  const x = event.clientX - rect.left - box.left;
  const y = event.clientY - rect.top - box.top;
  viewGizmoRoot.updateMatrixWorld(true);

  let nearest = null;
  let nearestDistance = Infinity;
  const worldPos = new THREE.Vector3();
  const screenPos = new THREE.Vector3();
  viewGizmoSpheres.forEach(obj => {
    obj.getWorldPosition(worldPos);
    screenPos.copy(worldPos).project(viewGizmoCamera);
    const sx = (screenPos.x * 0.5 + 0.5) * box.size;
    const sy = (-screenPos.y * 0.5 + 0.5) * box.size;
    const d = Math.hypot(x - sx, y - sy);
    if (d < nearestDistance) {
      nearestDistance = d;
      nearest = obj;
    }
  });
  return nearestDistance <= 55 ? nearest : null;
}
function updateViewGizmoTooltip(event) {
  if (!viewGizmoTooltip || viewGizmoDragging) return;
  if (!eventInViewGizmo(event)) {
    viewGizmoTooltip.style.display = 'none';
    return;
  }
  const picked = pickViewGizmo(event);
  const rect = renderer.domElement.getBoundingClientRect();
  viewGizmoTooltip.textContent = picked?.userData.tooltip || 'Drag to rotate view';
  viewGizmoTooltip.style.left = `${event.clientX - rect.left}px`;
  viewGizmoTooltip.style.top = `${event.clientY - rect.top - 10}px`;
  viewGizmoTooltip.style.display = 'block';
}
function rotateMainCamera(dx, dy) {
  stopAutoRotate();
  const offset = camera.position.clone().sub(controls.target);
  const spherical = new THREE.Spherical().setFromVector3(offset);
  spherical.theta -= dx * 0.01;
  spherical.phi -= dy * 0.01;
  spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.08, Math.PI - 0.08);
  offset.setFromSpherical(spherical);
  camera.position.copy(controls.target).add(offset);
  controls.update();
}

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
// ---- building/slab footprint outline that rides on the level plane ----
// Points are the concrete-slab perimeter in gltf X/Z (from the model's Slab).
const SLAB_FOOTPRINT = [
  [7.30,0.75],[7.30,0.30],[7.31,-0.70],[7.32,-1.69],[8.10,-5.27],[8.89,-8.87],
  [9.68,-12.46],[10.47,-16.04],[10.93,-16.03],[29.64,-16.08],[29.61,-15.34],
  [29.62,-14.74],[32.32,-14.74],[32.32,-7.48],[28.40,-7.49],[28.40,-0.45],
  [20.49,-0.45],[20.49,0.22],[12.26,0.23],[12.26,0.68],[7.75,0.75]
];
const fpGeo = new THREE.BufferGeometry().setFromPoints(
  SLAB_FOOTPRINT.map(p => new THREE.Vector3(p[0], 0, p[1])));
const slabOutline = new THREE.LineLoop(
  fpGeo,
  new THREE.LineBasicMaterial({ color: 0x8fd0ec, transparent: true, opacity: 0.75, depthTest: false })
);
slabOutline.visible = false;
slabOutline.renderOrder = 15;
scene.add(slabOutline);
const fpShape = new THREE.Shape(SLAB_FOOTPRINT.map(p => new THREE.Vector2(p[0], p[1])));
const fillMesh = new THREE.Mesh(
  new THREE.ShapeGeometry(fpShape),
  new THREE.MeshBasicMaterial({ color: 0x8fd0ec, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false, depthTest: false }));
fillMesh.rotation.x = Math.PI / 2;
slabOutline.add(fillMesh);

const levelIntersection = new THREE.LineSegments(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.95, depthTest: false })
);
levelIntersection.visible = false;
levelIntersection.renderOrder = 20;
scene.add(levelIntersection);

const LEVEL_EPS = 1e-5;
const levelV1 = new THREE.Vector3();
const levelV2 = new THREE.Vector3();
const levelV3 = new THREE.Vector3();

function visibleInHierarchy(obj) {
  for (let node = obj; node; node = node.parent) {
    if (!node.visible) return false;
  }
  return true;
}
function addUniquePoint(points, point) {
  if (!points.some(p => p.distanceToSquared(point) < LEVEL_EPS * LEVEL_EPS)) {
    points.push(point.clone());
  }
}
function collectEdgeHit(a, b, y, hits) {
  const da = a.y - y;
  const db = b.y - y;
  if (Math.abs(da) <= LEVEL_EPS && Math.abs(db) <= LEVEL_EPS) return;
  if (Math.abs(da) <= LEVEL_EPS) { addUniquePoint(hits, a); return; }
  if (Math.abs(db) <= LEVEL_EPS) { addUniquePoint(hits, b); return; }
  if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
    addUniquePoint(hits, a.clone().lerp(b, Math.abs(da) / Math.abs(db - da)));
  }
}
function updateLevelIntersection() {
  const positions = [];
  if (levelActive && currentRoot) {
    const y = levelPlane.position.y;
    currentRoot.updateMatrixWorld(true);
    currentRoot.traverse(mesh => {
      const pos = mesh.geometry?.attributes?.position;
      if (!mesh.isMesh || !pos || !visibleInHierarchy(mesh)) return;
      const idx = mesh.geometry.index;
      const triCount = idx ? Math.floor(idx.count / 3) : Math.floor(pos.count / 3);
      for (let i = 0; i < triCount; i++) {
        const ia = idx ? idx.getX(i * 3) : i * 3;
        const ib = idx ? idx.getX(i * 3 + 1) : i * 3 + 1;
        const ic = idx ? idx.getX(i * 3 + 2) : i * 3 + 2;
        levelV1.fromBufferAttribute(pos, ia).applyMatrix4(mesh.matrixWorld);
        levelV2.fromBufferAttribute(pos, ib).applyMatrix4(mesh.matrixWorld);
        levelV3.fromBufferAttribute(pos, ic).applyMatrix4(mesh.matrixWorld);

        const hits = [];
        collectEdgeHit(levelV1, levelV2, y, hits);
        collectEdgeHit(levelV2, levelV3, y, hits);
        collectEdgeHit(levelV3, levelV1, y, hits);
        if (hits.length >= 2) {
          positions.push(
            hits[0].x, hits[0].y + 0.015, hits[0].z,
            hits[1].x, hits[1].y + 0.015, hits[1].z
          );
        }
      }
    });
  }
  levelIntersection.geometry.dispose();
  levelIntersection.geometry = new THREE.BufferGeometry();
  levelIntersection.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  levelIntersection.visible = levelActive && positions.length > 0;
}
function updateLevelReadout() {
  const el = document.getElementById('levelValue');
  if (el) el.textContent = levelPlane.position.y.toFixed(2) + ' m';
  const inp = document.getElementById('levelInput');
  if (inp && document.activeElement !== inp) inp.value = levelPlane.position.y.toFixed(2);
  slabOutline.position.y = levelPlane.position.y + 0.01;
  updateLevelIntersection();
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

// ---- point-to-point measuring tool ----
const measureGroup = new THREE.Group();
scene.add(measureGroup);
const measureLineMat = new THREE.MeshBasicMaterial({ color: 0xffcc44, depthTest: false, depthWrite: false });
const measureLine = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1, 12), measureLineMat);
measureLine.visible = false;
measureLine.renderOrder = 30;
measureGroup.add(measureLine);
const measureMarkerGeo = new THREE.SphereGeometry(0.32, 16, 12);
const measureMarkerMat = new THREE.MeshBasicMaterial({ color: 0xffcc44, depthTest: false, depthWrite: false });
const measureMarkers = [
  new THREE.Mesh(measureMarkerGeo, measureMarkerMat),
  new THREE.Mesh(measureMarkerGeo, measureMarkerMat)
];
measureMarkers.forEach(marker => {
  marker.visible = false;
  marker.renderOrder = 31;
  measureGroup.add(marker);
});

const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const measurePoints = [];
const measureMidpoint = new THREE.Vector3();
const measureScreenPoint = new THREE.Vector3();
const measureScreenA = new THREE.Vector3();
const measureScreenB = new THREE.Vector3();
const measureDirection = new THREE.Vector3();
const measureUp = new THREE.Vector3(0, 1, 0);
let measureActive = false;
let measurePointerStart = null;

function measureStatusText(text) {
  const el = document.getElementById('measureStatus');
  if (el) el.textContent = text;
}
function clearMeasurement(updateStatus = true) {
  measurePoints.length = 0;
  measureLine.visible = false;
  measureMarkers.forEach(marker => { marker.visible = false; });
  document.getElementById('measureOverlay').style.display = 'none';
  document.getElementById('measureLabel').style.display = 'none';
  if (updateStatus) measureStatusText(measureActive ? 'Click first point' : 'Click two points on the model');
}
function collectMeasurementTargets(root, targets) {
  if (!root || !root.visible) return;
  root.traverse(obj => {
    if (obj.isMesh && obj.geometry?.attributes?.position && visibleInHierarchy(obj)) targets.push(obj);
  });
}
function getMeasurementHit(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);

  const targets = [];
  collectMeasurementTargets(currentRoot, targets);
  Object.values(overlayRoots).forEach(root => collectMeasurementTargets(root, targets));
  const hits = raycaster.intersectObjects(targets, false);
  return hits[0] || null;
}
function updateMeasurementDisplay() {
  measureMarkers.forEach((marker, i) => {
    marker.visible = !!measurePoints[i];
    if (measurePoints[i]) marker.position.copy(measurePoints[i]);
  });

  if (measurePoints.length < 2) {
    measureLine.visible = false;
    document.getElementById('measureLabel').style.display = 'none';
    measureStatusText(measureActive && measurePoints.length === 1 ? 'Click second point' : 'Click first point');
    updateMeasureLabelPosition();
    return;
  }

  const distance = measurePoints[0].distanceTo(measurePoints[1]);
  measureMidpoint.copy(measurePoints[0]).add(measurePoints[1]).multiplyScalar(0.5);
  measureDirection.copy(measurePoints[1]).sub(measurePoints[0]).normalize();
  measureLine.position.copy(measureMidpoint);
  measureLine.scale.set(1, distance, 1);
  measureLine.quaternion.setFromUnitVectors(measureUp, measureDirection);
  measureLine.visible = true;
  measureStatusText(distance.toFixed(2) + ' m');
  updateMeasureLabelPosition();
}
function addMeasurePoint(point) {
  if (measurePoints.length >= 2) clearMeasurement(false);
  measurePoints.push(point.clone());
  updateMeasurementDisplay();
}
function updateMeasureLabelPosition() {
  const label = document.getElementById('measureLabel');
  const overlay = document.getElementById('measureOverlay');
  if (!label || !overlay || measurePoints.length === 0) return;

  measureScreenA.copy(measurePoints[0]).project(camera);
  const startVisible = measureScreenA.z >= -1 && measureScreenA.z <= 1;
  const x1 = (measureScreenA.x * 0.5 + 0.5) * viewport.clientWidth;
  const y1 = (-measureScreenA.y * 0.5 + 0.5) * viewport.clientHeight;
  overlay.style.display = startVisible ? 'block' : 'none';
  if (!startVisible) {
    label.style.display = 'none';
    return;
  }

  const line = document.getElementById('measureOverlayLine');
  const start = document.getElementById('measureOverlayStart');
  const end = document.getElementById('measureOverlayEnd');
  const startLabel = document.getElementById('measureOverlayStartLabel');
  const endLabel = document.getElementById('measureOverlayEndLabel');
  start.classList.remove('hidden');
  start.setAttribute('transform', `translate(${x1} ${y1})`);
  startLabel.classList.remove('hidden');
  startLabel.setAttribute('x', x1 + 12);
  startLabel.setAttribute('y', y1 - 25);

  if (measurePoints.length < 2) {
    line.classList.add('pending');
    end.classList.add('hidden');
    endLabel.classList.add('hidden');
    label.style.display = 'none';
    return;
  }

  measureMidpoint.copy(measurePoints[0]).add(measurePoints[1]).multiplyScalar(0.5);
  measureScreenPoint.copy(measureMidpoint).project(camera);
  measureScreenB.copy(measurePoints[1]).project(camera);
  const endVisible = measureScreenB.z >= -1 && measureScreenB.z <= 1;
  const labelVisible = measureScreenPoint.z >= -1 && measureScreenPoint.z <= 1 && endVisible;
  label.style.display = labelVisible ? 'block' : 'none';
  if (!endVisible) return;

  const x2 = (measureScreenB.x * 0.5 + 0.5) * viewport.clientWidth;
  const y2 = (-measureScreenB.y * 0.5 + 0.5) * viewport.clientHeight;
  line.classList.remove('pending');
  line.setAttribute('x1', x1);
  line.setAttribute('y1', y1);
  line.setAttribute('x2', x2);
  line.setAttribute('y2', y2);
  end.classList.remove('hidden');
  endLabel.classList.remove('hidden');
  end.setAttribute('transform', `translate(${x2} ${y2})`);
  endLabel.setAttribute('x', x2 + 12);
  endLabel.setAttribute('y', y2 - 25);

  const distance = measurePoints[0].distanceTo(measurePoints[1]);
  label.textContent = distance.toFixed(2) + ' m';
  label.style.left = ((measureScreenPoint.x * 0.5 + 0.5) * viewport.clientWidth) + 'px';
  label.style.top = ((-measureScreenPoint.y * 0.5 + 0.5) * viewport.clientHeight) + 'px';
}
function setMeasureActive(on) {
  measureActive = on;
  if (measureActive) autoRotateCamera = false;
  const btn = document.getElementById('measureToggle');
  btn.classList.toggle('active', measureActive);
  btn.setAttribute('aria-label', measureActive ? 'Stop measuring' : 'Start measuring');
  btn.title = measureActive ? 'Stop measuring' : 'Measure distance';
  measureStatusText(measureActive ? (measurePoints.length ? 'Click second point' : 'Click first point') : 'Click two points on the model');
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
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (!eventInViewGizmo(event)) return;
  event.preventDefault();
  event.stopPropagation();
  if (viewGizmoTooltip) viewGizmoTooltip.style.display = 'none';
  viewGizmoDragging = true;
  viewGizmoMoved = false;
  viewGizmoStart = { x: event.clientX, y: event.clientY };
  viewGizmoLast = { x: event.clientX, y: event.clientY };
  controls.enabled = false;
  renderer.domElement.setPointerCapture?.(event.pointerId);
}, true);
renderer.domElement.addEventListener('pointermove', updateViewGizmoTooltip);
renderer.domElement.addEventListener('pointerleave', () => {
  if (viewGizmoTooltip) viewGizmoTooltip.style.display = 'none';
});
window.addEventListener('pointermove', (event) => {
  if (!viewGizmoDragging || !viewGizmoLast) return;
  event.preventDefault();
  const dx = event.clientX - viewGizmoLast.x;
  const dy = event.clientY - viewGizmoLast.y;
  if (Math.hypot(event.clientX - viewGizmoStart.x, event.clientY - viewGizmoStart.y) > 3) {
    viewGizmoMoved = true;
  }
  rotateMainCamera(dx, dy);
  viewGizmoLast = { x: event.clientX, y: event.clientY };
}, { capture: true });
window.addEventListener('pointerup', (event) => {
  if (!viewGizmoDragging) return;
  event.preventDefault();
  const wasClick = !viewGizmoMoved && viewGizmoStart &&
    Math.hypot(event.clientX - viewGizmoStart.x, event.clientY - viewGizmoStart.y) <= 3;
  viewGizmoDragging = false;
  viewGizmoStart = null;
  viewGizmoLast = null;
  controls.enabled = true;
  renderer.domElement.releasePointerCapture?.(event.pointerId);
  if (wasClick) {
    const picked = pickViewGizmo(event);
    if (picked?.userData.view) frameView(picked.userData.view);
  }
}, { capture: true });
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (!measureActive || event.button !== 0) return;
  measurePointerStart = { x: event.clientX, y: event.clientY };
});
renderer.domElement.addEventListener('pointerup', (event) => {
  if (!measureActive || event.button !== 0 || !measurePointerStart) return;
  const dx = event.clientX - measurePointerStart.x;
  const dy = event.clientY - measurePointerStart.y;
  measurePointerStart = null;
  if (gizmo.dragging || levelCtrl.dragging) return;
  if (Math.hypot(dx, dy) > 5) return;
  const hit = getMeasurementHit(event);
  if (hit) addMeasurePoint(hit.point);
});

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
const ASSET_V = '23';
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

// ---- onboarding / help tour ----
const TOUR_STORAGE_KEY = 'kingstonViewerOnboardingSeen';
const tourEl = document.getElementById('onboarding');
const tourSpotlight = document.getElementById('tourSpotlight');
const tourCard = document.getElementById('tourCard');
const tourCount = document.getElementById('tourCount');
const tourTitle = document.getElementById('tourTitle');
const tourBody = document.getElementById('tourBody');
const tourBack = document.getElementById('tourBack');
const tourNext = document.getElementById('tourNext');
const tourSkip = document.getElementById('tourSkip');
const tourSteps = [
  {
    target: '#viewport',
    title: '3D model workspace',
    body: 'Drag to orbit the excavation model, scroll to zoom, and right-drag to pan around the site.'
  },
  {
    target: '#layers',
    title: 'Layers',
    body: 'Turn construction elements on or off to isolate soil, walls, slabs, piers, and other model groups.'
  },
  {
    target: '.overlay-row',
    title: 'Overlays',
    body: 'Add contextual models such as the excavator, neighbouring house, retaining wall, or fence when needed.'
  },
  {
    target: '#scrubber',
    title: 'Stage timeline',
    body: 'Move through excavation stages with the timeline. The model reloads to show the selected stage.'
  },
  {
    target: '#resetBtn',
    title: 'View controls',
    body: 'Use zoom, reset, measure, and level shortcuts from the floating toolbar beside the orientation cube.'
  },
  {
    target: '#measureToggle',
    title: 'Measure distance',
    body: 'Start measuring, then click two model points to display a distance directly in the viewport.'
  },
  {
    target: '#levelToolToggle',
    title: 'Level plane',
    body: 'Show a movable level plane to read heights and inspect where the model intersects a selected level.'
  },
  {
    target: '#soilOpacity',
    title: 'Soil X-ray',
    body: 'Fade the soil layer to reveal retained structures and staged work hidden below the terrain.'
  },
  {
    target: '#helpTourToggle',
    title: 'Help',
    body: 'Open this walkthrough again any time from the question-mark button.'
  }
];
let tourIndex = 0;
let tourOpen = false;

function hasSeenTour() {
  try { return localStorage.getItem(TOUR_STORAGE_KEY) === '1'; }
  catch { return false; }
}
function markTourSeen() {
  try { localStorage.setItem(TOUR_STORAGE_KEY, '1'); }
  catch {}
}
function visibleTourSteps() {
  return tourSteps.filter(step => {
    const el = document.querySelector(step.target);
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}
function clampTourCard(left, top) {
  const margin = 14;
  const rect = tourCard.getBoundingClientRect();
  const maxLeft = window.innerWidth - rect.width - margin;
  const maxTop = window.innerHeight - rect.height - margin;
  tourCard.style.left = `${THREE.MathUtils.clamp(left, margin, Math.max(margin, maxLeft))}px`;
  tourCard.style.top = `${THREE.MathUtils.clamp(top, margin, Math.max(margin, maxTop))}px`;
}
function positionTour(step) {
  const target = document.querySelector(step.target);
  if (!target) return;

  target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
  const rect = target.getBoundingClientRect();
  const pad = 8;
  tourSpotlight.style.left = `${Math.max(8, rect.left - pad)}px`;
  tourSpotlight.style.top = `${Math.max(8, rect.top - pad)}px`;
  tourSpotlight.style.width = `${Math.min(window.innerWidth - 16, rect.width + pad * 2)}px`;
  tourSpotlight.style.height = `${Math.min(window.innerHeight - 16, rect.height + pad * 2)}px`;

  const cardRect = tourCard.getBoundingClientRect();
  const gap = 14;
  let left = rect.right + gap;
  let top = rect.top;
  if (left + cardRect.width > window.innerWidth - gap) {
    left = rect.left - cardRect.width - gap;
  }
  if (left < gap) {
    left = Math.min(Math.max(gap, rect.left), window.innerWidth - cardRect.width - gap);
    top = rect.bottom + gap;
  }
  if (top + cardRect.height > window.innerHeight - gap) {
    top = rect.top - cardRect.height - gap;
  }
  clampTourCard(left, top);
}
function renderTour() {
  const steps = visibleTourSteps();
  if (!tourOpen || !steps.length) return;
  tourIndex = THREE.MathUtils.clamp(tourIndex, 0, steps.length - 1);
  const step = steps[tourIndex];
  tourCount.textContent = `${tourIndex + 1} of ${steps.length}`;
  tourTitle.textContent = step.title;
  tourBody.textContent = step.body;
  tourBack.disabled = tourIndex === 0;
  tourNext.textContent = tourIndex === steps.length - 1 ? 'Done' : 'Next';
  requestAnimationFrame(() => positionTour(step));
}
function closeTour(saveSeen = true) {
  tourOpen = false;
  tourEl.hidden = true;
  if (saveSeen) markTourSeen();
}
function openTour(startIndex = 0) {
  tourIndex = startIndex;
  tourOpen = true;
  tourEl.hidden = false;
  stopAutoRotate();
  renderTour();
}
function maybeOpenFirstRunTour() {
  if (hasSeenTour()) return;
  setTimeout(() => openTour(0), 350);
}

document.getElementById('helpTourToggle').addEventListener('click', () => openTour(0));
tourBack.addEventListener('click', () => { tourIndex -= 1; renderTour(); });
tourNext.addEventListener('click', () => {
  const steps = visibleTourSteps();
  if (tourIndex >= steps.length - 1) closeTour();
  else { tourIndex += 1; renderTour(); }
});
tourSkip.addEventListener('click', () => closeTour());
window.addEventListener('resize', () => { if (tourOpen) renderTour(); });
window.addEventListener('keydown', (event) => {
  if (tourOpen && event.key === 'Escape') closeTour();
});

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

function setLevelActive(on) {
  levelActive = on;
  if (levelActive) { autoRotateCamera = false; sizeLevelPlane(); levelCtrl.attach(levelPlane); }
  else { levelCtrl.detach(); }
  levelPlane.visible = levelActive;
  levelCtrl.visible = levelActive;
  slabOutline.visible = levelActive;
  document.getElementById('levelReadout').style.display = levelActive ? 'block' : 'none';
  const btn = document.getElementById('levelToggle');
  btn.classList.toggle('active', levelActive);
  btn.textContent = levelActive ? 'Hide Level Plane' : 'Show Level Plane';
  const iconBtn = document.getElementById('levelToolToggle');
  iconBtn.classList.toggle('active', levelActive);
  iconBtn.setAttribute('aria-label', levelActive ? 'Hide level plane' : 'Show level plane');
  iconBtn.title = levelActive ? 'Hide level plane' : 'Show level plane';
  updateLevelReadout();
}

// ---- level plane toggle ----
document.getElementById('levelToggle').addEventListener('click', () => setLevelActive(!levelActive));
document.getElementById('levelToolToggle').addEventListener('click', () => setLevelActive(!levelActive));
document.getElementById('levelInput').addEventListener('input', () => {
  const v = parseFloat(document.getElementById('levelInput').value);
  if (!Number.isNaN(v)) { levelPlane.position.y = v; updateLevelReadout(); }
});

document.getElementById('measureToggle').addEventListener('click', () => setMeasureActive(!measureActive));
document.getElementById('measureClear').addEventListener('click', () => clearMeasurement());

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
  const shouldRunFirstTour = firstLoad && !hasSeenTour();
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
    clearMeasurement();

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
    updateLevelIntersection();
    loadingEl.style.display = 'none';
    if (shouldRunFirstTour) maybeOpenFirstRunTour();
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
      updateLevelIntersection();
      clearMeasurement();
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
  updateMeasureLabelPosition();
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, viewport.clientWidth, viewport.clientHeight);
  renderer.clear();
  renderer.render(scene, camera);

  viewGizmoRoot.quaternion.copy(camera.quaternion).invert();
  const gizmoBox = getViewGizmoBox();
  renderer.clearDepth();
  renderer.setScissor(gizmoBox.left, viewport.clientHeight - gizmoBox.top - gizmoBox.size, gizmoBox.size, gizmoBox.size);
  renderer.setViewport(gizmoBox.left, viewport.clientHeight - gizmoBox.top - gizmoBox.size, gizmoBox.size, gizmoBox.size);
  renderer.setScissorTest(true);
  renderer.render(viewGizmoScene, viewGizmoCamera);
  renderer.setScissorTest(false);
}
animate();
