import * as THREE from 'three';
import CameraControls from 'camera-controls';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { BatchMeshes } from './extensions/batcher/BatchMeshes';


import './style.css'
import { GLTFDecoder } from './decoders/GLTFDecoder';
import { OcclusionCulling } from './core/OcclusionCulling';


const stats = new Stats();
stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
stats.showPanel( 2 ); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild( stats.dom );


CameraControls.install( { THREE: THREE } );




const clock = new THREE.Clock();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 100 );
const light = new THREE.AmbientLight(new THREE.Color("white"))
const dirLight = new THREE.DirectionalLight(new THREE.Color("white"), 0.6)
scene.add( light );
scene.add(dirLight)

scene.background = 	new THREE.Color("white")

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize( window.innerWidth, window.innerHeight );
document.getElementById('app')?.appendChild( renderer.domElement );

const cameraControls = new CameraControls( camera, renderer.domElement, scene );
const occlusionCulling  = new OcclusionCulling(renderer, scene, camera, cameraControls.getTarget(new THREE.Vector3()))

async function loadModels() {
	const loader = new  GLTFDecoder()

	const root = '/public'
	const count = 1
	const gltfLoad = []

	
	// for (let i = 0; i < count; i++) {

	
	// 	gltfLoad.push(loader.load(`${root}/d41d8cd98f00b204e9800998ecf8427e.glb`))
	// }

	gltfLoad.push(loader.load(`${root}/d41d8cd98f00b204e9800998ecf8427e.glb`))
	const models =  await Promise.all(gltfLoad)

	const batchMeshes = new BatchMeshes(models.map(model => model))

	const aabb = new THREE.Box3().setFromObject(batchMeshes)
	cameraControls.fitToBox(aabb, true, {cover: true});



	scene.add(batchMeshes)
}





// const tileManager = new TileManager({tilesTree})
// tileManager.addToScene(scene);


// cameraControls.fitToBox(tileManager.aabb, true, {cover: true});

// cameraControls.moveTo(-1, 0, -1);
// window.engineCore = {camera, cameraControls, tileManager, renderer, scene};




loadModels();





( function anim () {

	stats.begin();
	// snip
	const delta = clock.getDelta();
	const hasControlsUpdated = cameraControls.update( delta );


	requestAnimationFrame( anim );

	stats.end();

	// you can skip this condition to render though
	if ( hasControlsUpdated ) {
		// renderer.render(scene, camera)
		occlusionCulling.update()
		// tileManager.renderTiles(scene, renderer, camera)
		
	}

} )();

