import { readFile, mkdir, writeFile } from 'node:fs/promises';
import rhino3dm from 'rhino3dm';
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, simplify, prune, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';

// Usage: node scripts/convert-room-models.mjs <laptop.3dm> <phone.obj>
// Original files stay untouched. Only render meshes and neutral materials ship.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.(); }); }
};
const [laptopPath, phonePath] = process.argv.slice(2);
if (!laptopPath || !phonePath) throw new Error('Provide laptop .3dm and phone .obj paths.');
await mkdir('assets/models', { recursive: true });
const rhino = await rhino3dm();
const file = rhino.File3dm.fromByteArray(await readFile(laptopPath));
const geometries = [];
const parser = new THREE.BufferGeometryLoader();
const addMesh = mesh => {
  if (!mesh) return;
  const geometry = parser.parse(mesh.toThreejsJSON());
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  for (const key of Object.keys(flat.attributes)) if (key !== 'position') flat.deleteAttribute(key);
  geometries.push(flat);
};
for (let i = 0; i < file.objects().count; i++) {
  const geometry = file.objects().get(i).geometry();
  if (geometry instanceof rhino.Brep) {
    for (let j = 0; j < geometry.faces().count; j++) addMesh(geometry.faces().get(j).getMesh(rhino.MeshType.Any));
  } else if (geometry.getMesh) addMesh(geometry.getMesh(rhino.MeshType.Any));
}
if (!geometries.length) throw new Error('The Rhino file contains no embedded render meshes.');
const merged = mergeGeometries(geometries);
merged.computeVertexNormals();
const laptop = new THREE.Group();
const laptopMesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color: 0x364654, metalness: .5, roughness: .36 }));
laptopMesh.rotation.x = -Math.PI / 2;
laptop.add(laptopMesh);
const phone = new OBJLoader().parse(await readFile(phonePath, 'utf8'));
phone.traverse(object => {
  if (!object.isMesh) return;
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  object.material = materials.map(material => new THREE.MeshStandardMaterial({
    color: /Metallic|Mat\.2/i.test(material.name) ? 0x8eabb9 : 0x122531,
    metalness: .6, roughness: .28,
  }));
});
async function exportModel(object, name, size) {
  object.updateMatrixWorld(true);
  let bounds = new THREE.Box3().setFromObject(object);
  const dimensions = bounds.getSize(new THREE.Vector3());
  console.log(name, 'source dimensions', dimensions.toArray());
  object.scale.setScalar(size / Math.max(...dimensions.toArray()));
  object.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(object);
  const center = bounds.getCenter(new THREE.Vector3());
  object.position.sub(center);
  const binary = await new GLTFExporter().parseAsync(object, { binary: true });
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const document = await io.readBinary(new Uint8Array(binary));
  await document.transform(dedup(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: .35, error: .002 }), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const optimized = await io.writeBinary(document);
  await writeFile(`assets/models/${name}.glb`, optimized);
  console.log(name, 'optimized GLB bytes', optimized.byteLength);
}
await exportModel(laptop, 'laptop', 3.0);
await exportModel(phone, 'phone', 1.45);
