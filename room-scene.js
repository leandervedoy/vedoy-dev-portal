import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { animate, createTimeline } from 'animejs';

export function mountRoom(root) {
  if (!root) return () => {};
  const canvasHost = root.querySelector('.room-canvas');
  const status = root.querySelector('[data-room-status]');
  const stage = root.querySelector('.room-stage');
  const journey = root.querySelector('.room-journey');
  const chapters = [...root.querySelectorAll('[data-room-chapter]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false, raf = 0, visible = true, previousTime = 0, activeChapter = -1, scrollTween;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    status.textContent = '3D is unavailable on this device. The chapter guides are still available below.';
    root.classList.add('room-no-webgl');
    return () => {};
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.25 : 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  canvasHost.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 80);
  const world = new THREE.Group();
  scene.add(world);
  const palettes = { floor: 0x123947, wall: 0x1d4d59, desk: 0x82d6d1, navy: 0x172e40, lime: 0xdafa71, coral: 0xf89c85, purple: 0xb0a4f5, light: 0xe0f8f4 };
  const material = (color, extras = {}) => new THREE.MeshStandardMaterial({ color, roughness: .6, ...extras });
  const box = (w, h, d, color, x, y, z, parent = world) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  box(8, .18, 6, palettes.floor, 0, -.12, 0);
  box(8, 3.9, .14, palettes.wall, 0, 1.85, -3);
  box(.14, 3.9, 6, palettes.wall, -4, 1.85, 0);
  // Thin lines give the original Vedøy room its architectural grid.
  const grid = new THREE.GridHelper(8, 16, 0x4b8992, 0x255361);
  grid.position.y = -.015; grid.scale.z = .75; world.add(grid);
  box(3.1, 1.7, .16, palettes.navy, -.9, 2.5, -2.86);
  box(2.85, 1.45, .18, palettes.purple, -.9, 2.5, -2.75);
  box(.06, 1.45, .21, palettes.wall, -.9, 2.5, -2.6);
  box(2.85, .06, .21, palettes.wall, -.9, 2.5, -2.6);
  const desk = new THREE.Group(); world.add(desk);
  box(3.5, .14, 1.8, palettes.desk, -1.4, 1.45, -.5, desk);
  for (const x of [-2.8, 0]) for (const z of [-1.15, .15]) box(.1, 1.4, .1, palettes.navy, x, .7, z, desk);
  box(.8, .12, .55, palettes.lime, -.6, 1.59, .12);
  box(.8, .05, .55, palettes.light, -.6, 1.68, .12);
  const phoneStand = new THREE.Group(); world.add(phoneStand);
  box(1.4, .8, 1.3, palettes.coral, 1.85, .4, 1.1, phoneStand);
  box(1.52, .08, 1.42, palettes.light, 1.85, .84, 1.1, phoneStand);
  const phoneHolder = new THREE.Group(); phoneHolder.position.set(1.85, 1.8, 1.1); phoneHolder.rotation.y = -.28; world.add(phoneHolder);
  const laptopHolder = new THREE.Group(); laptopHolder.position.set(-1.6, 1.5, -.65); world.add(laptopHolder);
  const characterHolder = new THREE.Group(); characterHolder.position.set(-2.5, 0, 1.1); characterHolder.rotation.y = .5; world.add(characterHolder);
  const apiRack = new THREE.Group(); apiRack.position.set(2.25, .3, -1.6); world.add(apiRack);
  const nodes = [];
  for (let i = 0; i < 4; i++) {
    const mesh = box(1.05, .36, .85, i % 2 ? palettes.lime : palettes.purple, 0, i * .44, 0, apiRack);
    mesh.userData.baseY = i * .44; nodes.push(mesh);
    box(.12, .05, .02, palettes.light, -.32, i * .44, .436, apiRack);
  }
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.38, 1), new THREE.MeshBasicMaterial({ color: palettes.lime, wireframe: true }));
  core.position.set(2.25, 2.75, -1.6); world.add(core);
  const plant = new THREE.Group(); plant.position.set(-3.1, .4, 1.9); world.add(plant);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(.3, .24, .6, 16), material(palettes.coral)); plant.add(pot);
  for (let i = 0; i < 5; i++) { const leaf = new THREE.Mesh(new THREE.SphereGeometry(.22, 12, 8), material(palettes.lime)); leaf.scale.set(.7, 2.8, .3); leaf.rotation.z = (i - 2) * .28; leaf.position.set((i - 2) * .1, .65, .05); plant.add(leaf); }
  const cable = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.2, .04, .8), new THREE.Vector3(.4, .04, .8), new THREE.Vector3(.4, .04, -1.6), new THREE.Vector3(2.25, .04, -1.6)]), new THREE.LineBasicMaterial({ color: palettes.lime })); world.add(cable);
  scene.add(new THREE.HemisphereLight(0xdbf9ff, 0x173d44, 2.6));
  const keyLight = new THREE.DirectionalLight(0xffeddb, 4); keyLight.position.set(3, 8, 5); keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024); keyLight.shadow.camera.left = -6; keyLight.shadow.camera.right = 6; keyLight.shadow.camera.top = 6; keyLight.shadow.camera.bottom = -6; keyLight.shadow.bias = -.001; scene.add(keyLight);
  const fill = new THREE.PointLight(0x81d8ff, 10, 15); fill.position.set(-2, 3.5, 1); scene.add(fill);

  const screenCanvas = document.createElement('canvas'); screenCanvas.width = 1024; screenCanvas.height = 640;
  const ctx = screenCanvas.getContext('2d');
  const texture = new THREE.CanvasTexture(screenCanvas); texture.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.15), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
  screen.position.set(-1.6, 2.65, -.44); world.add(screen);
  function drawScreen(chapter) {
    ctx.fillStyle = '#071925'; ctx.fillRect(0, 0, 1024, 640);
    ctx.fillStyle = '#93ead9'; ctx.font = '28px monospace'; ctx.fillText('VEDØY / WORKSPACE', 48, 64);
    ctx.fillStyle = '#3b6777'; ctx.fillRect(48, 88, 928, 2);
    const logs = [
      ['> npm run build', '✓ workspace ready', '✓ connect your first API', '  start with /api/v1/health'],
      ['POST /api/v1/messages', '{ from: "your-number",', '  to: "recipient",', '  text: "Hello from Vedøy" }'],
      ['GET /api/v1/models', 'Authorization: Bearer <key>', '', '{ "mode": "sandbox" }'],
      ['EVENT → HTTPS → YOUR APP', '1. verify signature', '2. check event ID', '3. process once'],
    ][chapter];
    logs.forEach((line, i) => { ctx.fillStyle = i === 0 ? '#daf570' : '#8bdde9'; ctx.font = '30px monospace'; ctx.fillText(line, 48, 174 + i * 70); });
    ctx.fillStyle = '#678c9b'; ctx.font = '21px monospace'; ctx.fillText('ILLUSTRATION / NO LIVE REQUEST', 48, 590); texture.needsUpdate = true;
  }
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const loadModel = async (url, holder, size, floor = false) => {
    const gltf = await loader.loadAsync(url);
    if (disposed) { disposeObjects(gltf.scene); return; }
    const bounds = new THREE.Box3().setFromObject(gltf.scene); const dimensions = bounds.getSize(new THREE.Vector3());
    const factor = size / Math.max(...dimensions.toArray()); gltf.scene.scale.setScalar(factor);
    gltf.scene.updateMatrixWorld(true); const next = new THREE.Box3().setFromObject(gltf.scene); const center = next.getCenter(new THREE.Vector3());
    gltf.scene.position.sub(center); if (floor) gltf.scene.position.y -= next.min.y - center.y;
    gltf.scene.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
    holder.add(gltf.scene);
  };
  Promise.allSettled([loadModel('/assets/models/laptop.glb', laptopHolder, 2.6, true), loadModel('/assets/models/phone.glb', phoneHolder, 1.5), loadModel('/assets/models/character.glb', characterHolder, 1.8, true)]).then(results => {
    if (disposed) return;
    const failed = results.filter(result => result.status === 'rejected').length;
    if (failed) { status.textContent = 'Workspace ready · some model files could not load'; if (!phoneHolder.children.length) box(.7, 1.4, .1, palettes.navy, 0, 0, 0, phoneHolder); if (!laptopHolder.children.length) { box(2, .08, 1.3, palettes.navy, 0, .05, 0, laptopHolder); box(2, 1.3, .07, palettes.navy, 0, .7, -.6, laptopHolder); } }
    else status.textContent = 'Workspace ready · scroll to explore';
  });

  const rig = { x: 8.8, y: 7, z: 10.5, tx: -.2, ty: 1.2, tz: 0, lift: 0, spread: 0, turn: 0 };
  const timeline = createTimeline({ autoplay: false, defaults: { duration: 1000, ease: 'inOutCubic' } })
    .add(rig, { x: 4.8, y: 3.7, z: 6, tx: 1.4, ty: 1.6, tz: .8, lift: .35, spread: .1, turn: -.25 }, 0)
    .add(rig, { x: -.2, y: 4.3, z: 5.4, tx: -1.4, ty: 2.3, tz: -1, lift: .1, spread: .55, turn: .2 }, 1000)
    .add(rig, { x: 8, y: 7.8, z: 9.8, tx: .15, ty: 1.4, tz: -.35, lift: .2, spread: 1.2, turn: -.1 }, 2000);
  const cursor = { progress: 0 };
  let scrollProgress = 0;
  function chapterAt(progress) { return Math.min(3, Math.floor(progress * 4)); }
  function updateLabels(progress) {
    const index = chapterAt(progress);
    if (index !== activeChapter) {
      activeChapter = index; drawScreen(index);
      root.querySelector('[data-room-counter]').textContent = `0${index + 1} / 04`;
      root.querySelector('[data-room-caption]').textContent = ['The workspace', 'Your phone app', 'Your API workspace', 'Connected events'][index];
      chapters.forEach((chapter, i) => chapter.classList.toggle('room-chapter-active', i === index));
      root.querySelectorAll('[data-room-jump]').forEach((button, i) => { button.classList.toggle('active', i === index); button.setAttribute('aria-pressed', String(i === index)); });
    }
    root.querySelector('.room-progress i').style.width = `${progress * 100}%`;
  }
  const setScroll = () => {
    const rect = journey.getBoundingClientRect(); const stageHeight = stage.getBoundingClientRect().height;
    scrollProgress = THREE.MathUtils.clamp(-rect.top / Math.max(1, journey.offsetHeight - stageHeight), 0, 1);
    updateLabels(scrollProgress);
    scrollTween?.cancel();
    if (reduced.matches) { cursor.progress = scrollProgress; timeline.seek(scrollProgress * timeline.duration); draw(); }
    else scrollTween = animate(cursor, { progress: scrollProgress, duration: 450, ease: 'outCubic', onUpdate: () => timeline.seek(cursor.progress * timeline.duration) });
  };
  function draw() {
    const portrait = canvasHost.clientWidth < 500;
    camera.position.set(rig.x * (portrait ? 1.35 : 1), rig.y * (portrait ? 1.25 : 1), rig.z * (portrait ? 1.35 : 1));
    camera.lookAt(rig.tx, rig.ty, rig.tz);
    phoneHolder.position.y = 1.8 + rig.lift; phoneHolder.rotation.y = -.28 + rig.turn;
    characterHolder.rotation.y = .5 + rig.turn * .35;
    nodes.forEach((node, index) => { node.position.y = node.userData.baseY + index * rig.spread * .3; node.position.x = index % 2 ? rig.spread * .18 : -rig.spread * .18; });
    renderer.render(scene, camera);
  }
  function tick(time) {
    if (disposed || !visible || document.hidden) { raf = 0; return; }
    const delta = Math.min((time - previousTime) / 1000, .04); previousTime = time;
    if (!reduced.matches) core.rotation.y += delta * .35;
    draw(); raf = requestAnimationFrame(tick);
  }
  function wake() { if (!disposed && visible && !document.hidden && !raf) { previousTime = performance.now(); raf = requestAnimationFrame(tick); } }
  function resize() { const w = canvasHost.clientWidth, h = canvasHost.clientHeight; if (!w || !h) return; const landing=root.classList.contains('developer-room-landing');const barHeight=landing?0:(document.querySelector('.topbar')?.getBoundingClientRect().height||64);stage.style.top=`${landing?18:Math.max(80,barHeight+16)}px`; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); setScroll(); draw(); }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvasHost);
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; wake(); }, { threshold: 0 }); intersection.observe(stage);
  window.addEventListener('scroll', setScroll, { passive: true });
  document.addEventListener('visibilitychange', wake);
  const motionChange = () => { setScroll(); wake(); }; reduced.addEventListener('change', motionChange);
  const jumps = [...root.querySelectorAll('[data-room-jump]')];
  const jumpHandlers = jumps.map((button, index) => { const handler = () => { const rect = journey.getBoundingClientRect(); const span = journey.offsetHeight - stage.offsetHeight; window.scrollTo({ top: scrollY + rect.top + span * (index / 3), behavior: reduced.matches ? 'auto' : 'smooth' }); }; button.addEventListener('click', handler); return handler; });
  const replay = root.querySelector('[data-room-replay]'); const replayHandler = () => { journey.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' }); }; replay.addEventListener('click', replayHandler);
  drawScreen(0); resize(); wake();
  return () => {
    disposed = true; cancelAnimationFrame(raf); scrollTween?.cancel(); timeline.cancel();
    resizeObserver.disconnect(); intersection.disconnect(); window.removeEventListener('scroll', setScroll); document.removeEventListener('visibilitychange', wake); reduced.removeEventListener('change', motionChange);
    jumps.forEach((button, i) => button.removeEventListener('click', jumpHandlers[i])); replay.removeEventListener('click', replayHandler);
    disposeObjects(world); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
  };
}

function disposeObjects(group) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  group.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(mat => { materials.add(mat); if (mat.map) textures.add(mat.map); }); });
  textures.forEach(texture => texture.dispose()); materials.forEach(mat => mat.dispose()); geometries.forEach(geometry => geometry.dispose());
}
