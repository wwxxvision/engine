import * as THREE from 'three'
import { DRACOLoader, GLTFLoader } from 'three/examples/jsm/Addons.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'



interface IProperties {
    assets: string[]
    boundingBox:THREE.Box3
}


const loader = new GLTFLoader()
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/public/dracov2/');
dracoLoader.setDecoderConfig({ type: "js" })
loader.setDRACOLoader(dracoLoader);
loader.setMeshoptDecoder(MeshoptDecoder)


const blackMaterial = new THREE.MeshBasicMaterial({color: new THREE.Color("black"), side: THREE.DoubleSide})


export class Tile extends THREE.Group {
    color = new THREE.Color()
    colorID = 0
    boundingBox = new THREE.Box3()

    geometry = new THREE.BufferGeometry()
    material = new THREE.LineBasicMaterial({color: new THREE.Color("red"), transparent: true, side: THREE.DoubleSide})
    meshesMap: string[] = []
    ready = false
    gltf = new THREE.Group()
    meshes: {[key: string]: THREE.Group} = {}

    constructor(boundingBox: THREE.Box3, meshesMap: string[] = []) {
        super()

        this.boundingBox = boundingBox
        this.gltf.name = 'gltf'
        this.add(this.gltf)

        this.color.setHex(Math.random() * 0xffffff);

        const r = Math.round(THREE.MathUtils.clamp(this.color.r * 255, 0, 255));
        const g = Math.round(THREE.MathUtils.clamp(this.color.g * 255, 0, 255));
        const b = Math.round(THREE.MathUtils.clamp(this.color.b * 255, 0, 255));
        
        this.colorID = (r << 16) | (g << 8) | b;

        this.material.color = this.color
        

        // const delta = new THREE.Vector3().subVectors(this.boundingBox.min, this.boundingBox.max)
        // const gltf = new THREE.Mesh(new THREE.BoxGeometry(delta.x, delta.y,delta.z), this.material)
    
        // gltf.name = 'gltf'
        // this.add(gltf)

        this.meshesMap = meshesMap
        this.matrixAutoUpdate = false
        this.matrixWorldAutoUpdate = false
    
        if (meshesMap) this.uploadMeshes()

    }


    uploadMeshes() {
        const self = this
   
        self.meshesMap.map(meshName => {
           return loader.load(
                `/public/converter_source/test/${meshName}.glb`,
                function (gltf) {
                    gltf.scene.traverse(object => {
                        object.matrixAutoUpdate = false
                        if (object.isMesh) {
                            object.material =self.material
                      
                        }
                    })

              
                
                    self.ready = true
                    self.gltf.add(gltf.scene)
               

                    console.log(`${meshName}.glb ready`)
                },
                function () {
                    console.log(`${meshName}.glb loading...`)
                },
                function (error) {
                    console.error(error);
                }
            );
        })
    }

    render() {
         // Create a BoxGeometry

        //  Object.values(this.meshes).forEach(mesh => {
        //     if(mesh.isMesh) {
        //         mesh.material.opacity = 1
        //     }
        // })

     
    }

    dispose() {
        // Object.values(this.meshes).forEach(mesh => {
        //     if(mesh.isMesh) {
        //         mesh.material.opacity = 0
        //        }
        // })
    }

    
}