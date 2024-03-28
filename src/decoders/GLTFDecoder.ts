import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const dracoLoader = new DRACOLoader();
const gltfLoader = new GLTFLoader()

gltfLoader.setDRACOLoader(dracoLoader);



export class GLTFDecoder {
    gltf: GLTF | null = null;
    
 
    load = async(url: string) => {
        console.time(`Starting to load ifc file: ${url}`)
        const gltf = await gltfLoader.loadAsync(url, console.error)
        console.timeEnd(`Loaded ifc file: ${url}`)
        this.gltf = gltf
    }
}

