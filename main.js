import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';
import { TouchControls } from './controls.js';
import { Aircraft } from './physics.js';

const leftHud = document.getElementById('leftHud');
const centerHud = document.getElementById('centerHud');
const rightHud = document.getElementById('rightHud');
const pauseBtn = document.getElementById('pauseBtn');
const installHint = document.getElementById('installHint');

// Detect standalone (installed) mode
if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
  installHint.style.display = 'none';
} else {
  installHint.style.display = 'block';
}

// Renderer & scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Gradient sky
const skyTop = new THREE.Color(0x0b1020), skyBottom = new THREE.Color(0x20305a);
const skyGeo = new THREE.SphereGeometry(50000, 16, 16);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: { top:{value:skyTop}, bottom:{value:skyBottom} },
  vertexShader:`varying vec3 vPos; void main(){ vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader:`uniform vec3 top; uniform vec3 bottom; varying vec3 vPos; void main(){ float h = normalize(vPos).y*0.5+0.5; gl_FragColor = vec4(mix(bottom, top, h), 1.0); }`
});
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

// Ground
const groundGeo = new THREE.PlaneGeometry(200000, 200000, 200, 200);
const groundMat = new THREE.MeshLambertMaterial({ color: 0x224422 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI/2;
scene.add(ground);

// Simple runway
const runwayGeo = new THREE.PlaneGeometry(3000, 60);
const runwayMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
const runway = new THREE.Mesh(runwayGeo, runwayMat);
runway.position.set(0, 0.01, 0);
runway.rotation.x = -Math.PI/2;
scene.add(runway);

// Lights
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(500, 1000, 500);
scene.add(sun);
scene.add(new THREE.AmbientLight(0x808080));

// Camera
const camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.1, 100000);
camera.position.set(0, 3, -10);

// Aircraft visual
function makePlaneMesh() {
  const g = new THREE.Group();
  // Fuselage
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 8, 16), new THREE.MeshPhongMaterial({color:0x0f6aa6, shininess:80}));
  body.rotation.z = Math.PI/2;
  g.add(body);
  // Nose cone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.5, 16), new THREE.MeshPhongMaterial({color:0x111111}));
  nose.position.x = 4.75;
  nose.rotation.z = Math.PI/2;
  g.add(nose);
  // Wings
  const wing = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 1.2), new THREE.MeshPhongMaterial({color:0x135e35}));
  wing.position.set(0, 0.3, 0);
  g.add(wing);
  // Tail
  const htail = new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, 0.8), new THREE.MeshPhongMaterial({color:0x135e35}));
  htail.position.set(-3.2, 0.6, 0);
  g.add(htail);
  const vtail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 1.0), new THREE.MeshPhongMaterial({color:0x135e35}));
  vtail.position.set(-3.2, 1.1, 0);
  vtail.rotation.z = Math.PI/2;
  g.add(vtail);
  // Gear (simple)
  const gearMat = new THREE.MeshPhongMaterial({color:0x222222});
  const w1 = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.12, 8, 16), gearMat); w1.position.set(1.2, -0.6, -0.9);
  const w2 = w1.clone(); w2.position.z = 0.9;
  const w3 = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 8, 16), gearMat); w3.position.set(-2.8, -0.55, 0);
  g.add(w1); g.add(w2); g.add(w3);
  return g;
}

const planeMesh = makePlaneMesh();
scene.add(planeMesh);

// Physics
const aircraft = new Aircraft();

// Controls
const controls = new TouchControls(
  document.getElementById('stickL'),
  document.getElementById('stickR'),
  document.getElementById('nubL'),
  document.getElementById('nubR')
);

// Keyboard fallback
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase() === 'g') gearToggle();
});
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

function gearToggle(){
  aircraft.gearDown = !aircraft.gearDown;
}

// Pause
let paused = false;
pauseBtn.addEventListener('click', ()=> paused = !paused);

// Resize
window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Main loop
let last = performance.now();
function loop() {
  const now = performance.now();
  const dt = Math.min(0.033, (now - last)/1000);
  last = now;

  // keyboard mapping
  const k = (kk) => (keys[kk] ? 1 : 0);
  const kbPitch = (k('arrowup') - k('arrowdown')) + (k('w') - k('s'));
  const kbRoll  = (k('arrowright') - k('arrowleft')) + (k('d') - k('a'));
  const kbYaw   = (k('e') - k('q'));
  const kbThr   = Math.min(1, Math.max(0, (keys['shift']?1:0) * 1 + (controls.state.throttle||0)));

  const ctrl = {
    pitch: THREE.MathUtils.clamp(controls.state.pitch + 0.8*kbPitch, -1, 1),
    roll:  THREE.MathUtils.clamp(controls.state.roll  + 0.8*kbRoll,  -1, 1),
    yaw:   THREE.MathUtils.clamp(controls.state.yaw   + 0.8*kbYaw,   -1, 1),
    throttle: THREE.MathUtils.clamp(controls.state.throttle, 0, 1)
  };

  if (!paused) {
    aircraft.step(dt, ctrl);
  }

  // Update visuals: place plane mesh
  planeMesh.position.set(aircraft.pos.x, aircraft.pos.y, aircraft.pos.z);
  planeMesh.rotation.set(aircraft.ang.pitch, aircraft.ang.yaw, aircraft.ang.roll);

  // Third-person chase camera
  const camDist = 12, camHeight = 3;
  const forward = new THREE.Vector3(1,0,0).applyEuler(planeMesh.rotation);
  const up = new THREE.Vector3(0,1,0).applyEuler(planeMesh.rotation);
  const camPos = new THREE.Vector3().copy(planeMesh.position)
    .addScaledVector(forward, -camDist)
    .addScaledVector(up, camHeight);
  camera.position.copy(camPos);
  camera.lookAt(planeMesh.position.clone().addScaledVector(forward, 5));

  // Ground scrolling texture illusion by moving runway/ground relative to plane
  ground.position.set(aircraft.pos.x, 0, aircraft.pos.z);
  runway.position.set(aircraft.pos.x, 0.01, aircraft.pos.z);

  // HUD
  const ms2kt = 1.94384;
  const speed = Math.hypot(aircraft.vel.x, aircraft.vel.y, aircraft.vel.z)*ms2kt;
  leftHud.innerHTML = `Höjd: ${aircraft.pos.y.toFixed(0)} m<br>Fart: ${speed.toFixed(0)} kt`;
  centerHud.textContent = `Pitch ${(THREE.MathUtils.radToDeg(aircraft.ang.pitch)).toFixed(0)}° | Roll ${(THREE.MathUtils.radToDeg(aircraft.ang.roll)).toFixed(0)}° | Yaw ${(THREE.MathUtils.radToDeg(aircraft.ang.yaw)).toFixed(0)}°`;
  rightHud.textContent = `Motoreffekt: ${(ctrl.throttle*100).toFixed(0)}%`;

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();
