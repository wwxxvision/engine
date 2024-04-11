import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

const dracoLoader = new DRACOLoader();
const gltfLoader = new GLTFLoader()

gltfLoader.setDRACOLoader(dracoLoader);

dracoLoader.setDecoderPath('/public/dracov2/');
dracoLoader.setDecoderConfig({ type: "js" })
gltfLoader.setDRACOLoader(dracoLoader);
gltfLoader.setMeshoptDecoder(MeshoptDecoder)

export class GLTFDecoder {

    
 
    load = async(url: string) => {
        const now = performance.now();
        console.log(`Starting to load ifc file: ${url}`)
        const gltf = await gltfLoader.loadAsync(url)
        const end = performance.now();
        console.log(`Loaded ifc file: ${url}, in time: ${end - now}`)
        
        return gltf
    }
}

