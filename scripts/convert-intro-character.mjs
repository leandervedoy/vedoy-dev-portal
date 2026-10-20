import {readFile,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
const model=new OBJLoader().parse(await readFile(process.argv[2],'utf8'));
// The supplied archive contains geometry only; use original Vedøy materials.
model.rotation.x=-Math.PI/2;
model.traverse(node=>{if(node.isMesh){node.material=new THREE.MeshStandardMaterial({color:/Head|Hand/i.test(node.name)?0xf0b49c:0x74c9c4,roughness:.75});}});
model.updateMatrixWorld(true);
const bounds=new THREE.Box3().setFromObject(model);
model.scale.setScalar(1.8/Math.max(...bounds.getSize(new THREE.Vector3()).toArray()));
model.updateMatrixWorld(true);
const normalized=new THREE.Box3().setFromObject(model);
const center=normalized.getCenter(new THREE.Vector3());
model.position.set(-center.x,-normalized.min.y,-center.z);
const glb=await new GLTFExporter().parseAsync(model,{binary:true});
await writeFile('assets/models/character.glb',Buffer.from(glb));
console.log('Character GLB saved:',glb.byteLength,'bytes');
