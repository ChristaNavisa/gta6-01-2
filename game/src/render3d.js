// VERDE BAY v9 — three.js rendering: the renderer, the chase camera, the
// sun and sky that drive the day/night cycle, and the mesh builders for cars,
// pedestrians and the police helicopter.
import { clamp, lerp } from './util.js';

const THREE = window.THREE;

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5d9);
  scene.fog = new THREE.Fog(0x87b5d9, 180, 520);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.6);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 600;
  scene.add(sun);
  scene.add(sun.target);
  return { scene, sun, hemi };
}

// timeOfDay: 0..24. Returns true when it is night (for streetlights).
export function applyTimeOfDay(env, timeOfDay) {
  const { scene, sun, hemi } = env;
  const t = timeOfDay / 24;
  const sunAngle = (t - 0.25) * Math.PI * 2; // noon = overhead
  const elevation = Math.sin(sunAngle);
  sun.position.set(Math.cos(sunAngle) * 220, Math.max(elevation, -0.15) * 220 + 20, 80);
  const day = clamp(elevation * 1.6 + 0.25, 0, 1);
  const dusk = clamp(1 - Math.abs(elevation) * 3, 0, 1) * (elevation > 0 ? 1 : 0);
  const skyDay = new THREE.Color(0x87b5d9);
  const skyDusk = new THREE.Color(0xe88a5a);
  const skyNight = new THREE.Color(0x0e1a2e);
  const sky = skyDay.clone().lerp(skyDusk, dusk * 0.8).lerp(skyNight, 1 - day);
  scene.background.copy(sky);
  scene.fog.color.copy(sky);
  sun.intensity = 0.15 + day * 1.5;
  hemi.intensity = 0.25 + day * 0.65;
  return day < 0.35;
}

export function makeCarMesh(color, kind) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2b3a });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const long = kind === 'truck' ? 5.6 : kind === 'sport' || kind === 'muscle' ? 4.6 : 4.2;
  const wide = kind === 'truck' ? 2.4 : 2.0;
  const body = new THREE.Mesh(new THREE.BoxGeometry(wide, 0.75, long), bodyMat);
  body.position.y = 0.65;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(wide * 0.82, 0.65, long * (kind === 'truck' ? 0.3 : 0.48)),
    kind === 'truck' ? bodyMat : glassMat,
  );
  cabin.position.set(0, 1.3, kind === 'truck' ? -long * 0.28 : -long * 0.05);
  cabin.castShadow = true;
  g.add(cabin);
  if (kind === 'truck') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(wide * 0.9, 0.9, long * 0.5), darkMat);
    bed.position.set(0, 1.15, long * 0.22);
    g.add(bed);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-wide / 2, long * 0.32], [wide / 2, long * 0.32], [-wide / 2, -long * 0.32], [wide / 2, -long * 0.32]]) {
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.position.set(wx, 0.38, wz);
    g.add(wheel);
    wheels.push(wheel);
  }
  // Headlights and taillights so cars read at night.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const s of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), headMat);
    head.position.set(s * (wide / 2 - 0.35), 0.7, -long / 2 - 0.02);
    g.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
    tail.position.set(s * (wide / 2 - 0.35), 0.7, long / 2 + 0.02);
    g.add(tail);
  }
  g.userData.wheels = wheels;
  g.userData.long = long;
  return g;
}

export function makePoliceMesh() {
  const g = makeCarMesh(0x1a1a22, 'sedan');
  const barMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.3), barMat);
  bar.position.set(0, 1.75, 0);
  g.add(bar);
  g.userData.lightBar = bar;
  return g;
}

export function makeHelicopterMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 5), new THREE.MeshLambertMaterial({ color: 0x223344 }));
  body.castShadow = true;
  g.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 1.6), new THREE.MeshLambertMaterial({ color: 0x9fd8ff }));
  glass.position.set(0, 0.3, -1.8);
  g.add(glass);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  rotor.position.y = 1.0;
  g.add(rotor);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4), new THREE.MeshLambertMaterial({ color: 0x223344 }));
  tail.position.set(0, 0.2, 4.2);
  g.add(tail);
  const spot = new THREE.SpotLight(0xfff2c0, 60, 90, 0.35, 0.5);
  spot.position.set(0, -0.5, 0);
  spot.target.position.set(0, -30, 0);
  g.add(spot);
  g.add(spot.target);
  g.userData.rotor = rotor;
  g.userData.spot = spot;
  return g;
}

export function makePedMesh(color) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const shirt = new THREE.MeshLambertMaterial({ color });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), new THREE.MeshLambertMaterial({ color: 0x2a2d33 }));
  legs.position.y = 0.4;
  g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.36), shirt);
  torso.position.y = 1.15;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.78;
  g.add(head);
  return g;
}

export function makePlayerMesh() {
  const g = makePedMesh(0x2fa8a0);
  const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.4, 0.42), new THREE.MeshLambertMaterial({ color: 0x1a1a22 }));
  jacket.position.y = 1.35;
  g.add(jacket);
  return g;
}

// Third-person chase camera: behind and above the target, smoothed.
export function updateChaseCamera(camera, targetPos, heading, speed, dt, state) {
  const back = 9 + Math.min(speed * 0.12, 4);
  const height = 4.2 + Math.min(speed * 0.04, 1.6);
  const cx = targetPos.x - Math.sin(heading) * back;
  const cz = targetPos.z - Math.cos(heading) * back;
  const k = 1 - Math.pow(0.0001, dt);
  camera.position.x = lerp(camera.position.x, cx, k);
  camera.position.y = lerp(camera.position.y, height, k);
  camera.position.z = lerp(camera.position.z, cz, k);
  camera.lookAt(targetPos.x, 1.6, targetPos.z);
  void state;
}
