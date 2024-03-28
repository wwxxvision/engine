import * as THREE from 'three';
import CameraControls from 'camera-controls';

import { TileManager } from './extensions/TileManager';



import tilesTree from '/public/converter_source/test/tree.json'

import './style.css'

CameraControls.install( { THREE: THREE } );




const clock = new THREE.Clock();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 1000 );

scene.background = 	new THREE.Color("white")

const renderer = new THREE.WebGLRenderer({preserveDrawingBuffer: false, antialias: true});
renderer.setSize( window.innerWidth, window.innerHeight );
document.getElementById('app')?.appendChild( renderer.domElement );

const cameraControls = new CameraControls( camera, renderer.domElement, scene );




const tileManager = new TileManager({tilesTree})
tileManager.addToScene(scene);


cameraControls.fitToBox(tileManager.aabb, true, {cover: true});

// cameraControls.moveTo(-1, 0, -1);
window.engineCore = {camera, cameraControls, tileManager, renderer, scene};




( function anim () {

	// snip
	const delta = clock.getDelta();
	const hasControlsUpdated = cameraControls.update( delta );
	

	requestAnimationFrame( anim );

	// you can skip this condition to render though
	if ( hasControlsUpdated ) {

		tileManager.renderTiles(scene, renderer, camera)
		
	}

} )();

