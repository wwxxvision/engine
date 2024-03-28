import * as THREE from 'three';
import {Tile} from './Tile'
import { OcclusionCulling } from '../core/OcclusionCulling';




interface TileOptions {
    tilesTree: TilesTree;
    tileMesh: THREE.Mesh;
}

interface TilesTree {
    children: TilesTree[] | null;
    max: [number, number, number];
    meshes: number[] | null;
    min: [number, number, number];
}


const lineMaterial = new THREE.LineDashedMaterial({color: new THREE.Color("red")})


export class TileManager {
    private tilesTree: TilesTree;
    boxes = new THREE.Group()
    tiles = new THREE.Group()
    occlusionCulling = new OcclusionCulling()
    firstRender = true
    hiddenScene = new THREE.Scene()


    constructor(options: TileOptions) {
        this.tilesTree = options.tilesTree;
 
        this.buildTiles(this.tilesTree);

        this.tiles.children.forEach(tile => {
    
            // if (!tile?.meshesMap?.length ) return

     
          
            const delta = new THREE.Vector3().subVectors(tile.boundingBox.min, tile.boundingBox.max)
            const aabb = new THREE.Mesh(new THREE.BoxGeometry(delta.x, delta.y,delta.z), tile.material)
            aabb.position.copy(new THREE.Vector3().addVectors(tile.boundingBox.min, tile.boundingBox.max).divideScalar(2))
  
            this.hiddenScene.add(aabb)
  
        })
    }

    get aabb() {
        const box3 = new THREE.Box3()
        box3.setFromObject(this.tiles)

        return box3
    }

    private buildTiles(node: TilesTree) {
   


        if (!node?.meshes?.length) {
            if (node?.children) node.children.forEach(childNode => this.buildTiles(childNode))
            return 
        }


  
        if (node?.min && node?.max){
            const minVector3 = new THREE.Vector3().fromArray(node.min)
            const maxVector3 = new THREE.Vector3().fromArray(node.max)
            

           
            const tile = new Tile(new THREE.Box3(minVector3, maxVector3), node?.meshes)
            this.tiles.add(tile)
            
            
            // // Create a BoxGeometry
            // const boxGeometry = new THREE.BoxGeometry(delta.x, delta.y, delta.z);
            // const lineGeometry = new THREE.EdgesGeometry(boxGeometry)
            // const box =new THREE.LineSegments(lineGeometry, lineMaterial)

            // this.boxes.add(box)

        }

        if (node?.children) node.children.forEach(childNode => this.buildTiles(childNode))
    
    }

    public addToScene(scene: THREE.Scene) {
          scene.add(this.tiles);
        
    }

    public removeFromScene(scene: THREE.Scene) {
        scene.remove(this.tiles);
    }


    public renderTiles(scene: THREE.Scene, renderer: THREE.WebGLRenderer, camera: THREE.Camera) {

            this.occlusionCulling.update(scene,this.hiddenScene, renderer, camera)

           console.log('List tiles')
       
            this.tiles.traverse(tile => {
                if (tile instanceof Tile) {
                    if (!tile.ready) return
                    
                    tile.visible  = Boolean(this.occlusionCulling.hasID(tile.colorID))
                }
            })

            console.table([...this.tiles.children.map(child => ({uuid: child.uuid, visible: child.visible}))])   
    }

}