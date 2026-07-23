import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CONFIG = {
  modelPath: 'dinosaur/source/dinosaur.glb',
  modelScale: 1,
  modelYOffset: -1,
  modelRotationY: Math.PI,
  cameraRadiusFar: 8,
  cameraRadiusNear: 4,
  cameraHeightBase: 1.2,
  flySpeed: 1.6,
  textZFrom: -600,
  textZTo: 900,
};

const canvas = document.getElementById('bg-canvas');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.set(0, CONFIG.cameraHeightBase, CONFIG.cameraRadiusFar);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const ambient = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xfff2d8, 1.4);
keyLight.position.set(5, 8, 5);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x88aaff, 0.6);
rimLight.position.set(-6, 2, -4);
scene.add(rimLight);

const dinoGroup = new THREE.Group();
scene.add(dinoGroup);

let mixer = null;
let flyAction = null;
let modelLoaded = false;
let usingFallbackModel = false;

const loader = new GLTFLoader();
const loaderStatus = document.getElementById('loader-status');
const enterBtn = document.getElementById('enter-btn');

loader.load(
  CONFIG.modelPath,
  (gltf) => {
    const model = gltf.scene;

    model.scale.setScalar(CONFIG.modelScale);
    model.position.y += CONFIG.modelYOffset;
    model.rotation.y = CONFIG.modelRotationY;

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });

    dinoGroup.add(model);

    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(model);

      const flyClip =
        gltf.animations.find((c) => /fly|flying|glide|soar/i.test(c.name)) ||
        gltf.animations[0];

      flyAction = mixer.clipAction(flyClip);
      flyAction.setLoop(THREE.LoopRepeat, Infinity);
      flyAction.play();
    }

    modelLoaded = true;
    onModelReady();
  },
  (xhr) => {
    if (xhr.lengthComputable && loaderStatus) {
      const pct = Math.min(100, Math.round((xhr.loaded / xhr.total) * 100));
      loaderStatus.textContent = `Loading model... ${pct}%`;
    }
  },
  (error) => {
    console.warn(
      'Could not load dinosaur.glb',
      error
    );

    modelLoaded = true;
    onModelReady();
  }
);



function onModelReady() {
  if (loaderStatus) {
    loaderStatus.textContent = usingFallbackModel
      ? 'not loaded'
      : 'Model loaded';
  }

  if (enterBtn) {
    enterBtn.disabled = false;
  }
}

const overlay = document.getElementById('enter-overlay');

enterBtn.addEventListener('click', () => {
  overlay.classList.add('hidden');
});

let scrollY = window.scrollY;

window.addEventListener(
  'scroll',
  () => {
    scrollY = window.scrollY;
  },
  { passive: true }
);

function getScrollProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;

  return max > 0
    ? Math.min(Math.max(scrollY / max, 0), 1)
    : 0;
}

function updateCamera(progress) {
  const distance =
    CONFIG.cameraRadiusFar +
    (CONFIG.cameraRadiusNear - CONFIG.cameraRadiusFar) * progress;

  camera.position.set(0, CONFIG.cameraHeightBase, distance);
  camera.lookAt(0, CONFIG.modelYOffset + 0.4, 0);

  dinoGroup.position.z = camera.position.z - 5;
}

const textSections = Array.from(document.querySelectorAll('.text-section'));

function updateTextSections() {
  const viewportH = window.innerHeight;
  const docScrollY = window.scrollY;

  textSections.forEach((section) => {
    const rect = section.getBoundingClientRect();
    const sectionTopAbs = rect.top + docScrollY;
    const sectionHeight = rect.height;

    const rangeStart = sectionTopAbs - viewportH;
    const rangeEnd = sectionTopAbs + sectionHeight;
    const span = rangeEnd - rangeStart;

    let progress = (docScrollY - rangeStart) / span;
    progress = Math.min(Math.max(progress, 0), 1);

    const z =
      CONFIG.textZFrom +
      (CONFIG.textZTo - CONFIG.textZFrom) * progress;

    let opacity;

    if (progress < 0.12) {
      opacity = progress / 0.12;
    } else if (progress > 0.85) {
      opacity = (1 - progress) / 0.15;
    } else {
      opacity = 1;
    }

    const textEls = section.querySelectorAll('.text-3d');

    textEls.forEach((el) => {
      const baseTransform = el.classList.contains('text-center')
        ? 'translate(-50%, -50%)'
        : 'translate(0, -50%)';

      el.style.transform = `${baseTransform} translateZ(${z}px)`;
      el.style.opacity = opacity.toFixed(3);
      el.style.pointerEvents = opacity > 0.05 ? 'auto' : 'none';
    });
  });
}

const clock = new THREE.Clock();

function updateFlying(elapsed, delta) {
   if (mixer) mixer.update(delta);

  dinoGroup.position.y =
    CONFIG.modelYOffset +
    Math.sin(elapsed * CONFIG.flySpeed) * 0.18;

  dinoGroup.rotation.z =
    Math.sin(elapsed * CONFIG.flySpeed * 0.5) * 0.05;

  dinoGroup.rotation.x =
    Math.sin(elapsed * CONFIG.flySpeed * 0.7) * 0.03;
}

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  updateFlying(elapsed, delta);

  const progress = getScrollProgress();

  updateCamera(progress);
  updateTextSections();

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});