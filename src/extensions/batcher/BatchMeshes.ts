import { BatchedMesh,ShaderMaterial, BufferGeometry, Color, DataTexture, Group, MathUtils, MeshBasicMaterial, MeshStandardMaterial, RGBAFormat, SRGBColorSpace, Scene, ShaderLib, Texture, Vector2, GLSL3 } from "three";
import { GLTF } from "three/examples/jsm/Addons.js";
import { MeshBVH } from 'three-mesh-bvh';

const normalMaterial = new ShaderMaterial({
    vertexShader: /* glsl */ `
      in uint visibility;
      out vec3 vNormal;
  
      void main() {
        vNormal = normalMatrix * normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, visibility);
      }
    `,
    fragmentShader: /* glsl */ `
      in vec3 vNormal;
  
      void main() {
        gl_FragColor = vec4(normalize(vNormal) * 0.5 + 0.5, 1);
      }
    `,
  })

const generateUniqueColorID = (color: Color) => {
    color.setHex(Math.random() * 0xffffff);

    const r = Math.round(MathUtils.clamp(color.r * 255, 0, 255));
    const g = Math.round(MathUtils.clamp(color.g * 255, 0, 255));
    const b = Math.round(MathUtils.clamp(color.b * 255, 0, 255));
    
    return  (r << 16) | (g << 8) | b;
}


export class BatchMeshes extends Group {

    mapOfMeshes: Map<MeshBasicMaterial | MeshStandardMaterial, BufferGeometry[]> = new Map()
    batchedMeshesList = new Map<BatchedMesh, {[key: string]: {colorID: number}}>()
    
   
    
    constructor(models: GLTF[]) {
        super()

 
        this.name = 'BatchMeshes'

        models.forEach(model => {

            // const geometry = []
            model.scene.traverse(object  => {
                if (object?.geometry && object?.material) {

                  
                    if (!this.mapOfMeshes.has(object.material as MeshBasicMaterial))
                        this.mapOfMeshes.set(object.material as MeshBasicMaterial, [object.geometry as BufferGeometry])
                    else 
                        this.mapOfMeshes.set(object.material as MeshBasicMaterial, [...(this.mapOfMeshes.get(object.material as MeshBasicMaterial)?.values() ?? []),  object.geometry as BufferGeometry])
                    
                }
            })
        })

 

        for (const [material, geometries] of this.mapOfMeshes){
            
        
             const countVertices =  geometries.reduce((val, geometry) => val += geometry.attributes.position.itemSize * geometry.attributes.position.count, 0)
             const countIndices =  geometries.reduce((val, geometry) => val += (geometry.index?.count ?? 0) * (geometry?.index?.itemSize ?? 0), 0)

             material.onBeforeCompile = ((program) => {
              //  program.glslVersion = GLSL3
              //  program.vertexShader = `
              //   in uint visibility;
              //   out vec3 vNormal;
            
              //   void main() {
              //     vNormal = normalMatrix * normal;
              //     gl_Position = projectionMatrix * modelViewMatrix * vec4(position, visibility);
              //   }
              //  `
              //  program.fragmentShader = `
              //   in vec3 vNormal;

              //   void main() {
              //     gl_FragColor = vec4(normalize(vNormal) * 0.5 + 0.5, 1);
              //   }
              
              //  `
             })

             const batchedMesh = new BatchedMesh(geometries.length, countVertices, countIndices, material)



            //  const size =  window.innerWidth * 1
            //  const buffer = new Uint8Array(size * 4)


             
             
             geometries.forEach((geometry, index) => {

                // console.log(   geometry.boundsTree)
                const meshID = batchedMesh.addGeometry(geometry)
                // const colorID =  generateUniqueColorID(material.color.clone())

                // for ( let i = 0; i < size; i ++ ) {
                //     const startIndex = i * 4;
                //     buffer[startIndex] = (colorID >> 16) & 255;
                //     buffer[startIndex + 1] = (colorID >> 8) & 255;
                //     buffer[startIndex + 2] = colorID & 255;
                //     buffer[startIndex + 3] = 255; // Assuming alpha value is always 1.0 (fully opaque
                // }
                
              
                // const startIndex = index * 4;

                // // Fill the buffer with the RGBA values for the current geometry
                // buffer[startIndex] = (colorID >> 16) & 255;
                // buffer[startIndex + 1] = (colorID >> 8) & 255;
                // buffer[startIndex + 2] = colorID & 255;
                // buffer[startIndex + 3] = 255; // Assuming alpha value is always 1.0 (fully opaque)

                // buffer[offset] = (colorID >> 16) & 255
                // buffer[offset + 1] = (colorID >> 8) & 255
                // buffer[offset + 2] = colorID & 255
                // buffer[offset + 3] = 1.0
                // offset += 4
                
                // for (let i = 0; i < geometry.attributes.position.count; i += 4) {

                //     const r = (colorID >> 16) & 255;
                //     const g = (colorID >> 8) & 255;
                //     const b = colorID & 255;
                    
                //     buffer[i] = r ;
                //     buffer[i+ 1] = g ;
                //     buffer[i + 2] = b;

                //     buffer[i + 3] = 255;
                // }
                
                
                
                this.batchedMeshesList.set(batchedMesh, {...this.batchedMeshesList.get(batchedMesh), [meshID]: {
                    colorID: null,
                }} )
             })

             batchedMesh.geometry.computeBoundingBox()
            //  batchedMesh.geometry.boundsTree = new MeshBVH(  batchedMesh.geometry );
             
             
          
            // const texture = new DataTexture(buffer,window.innerWidth ,1, RGBAFormat)
            // texture.needsUpdate = true;
            // const shader = occlusionMaterial.clone()

            
            // shader.uniforms = { ...ShaderLib.basic.uniforms,textureSampler: {value: texture},   resolution: { value: new Vector2(window.innerWidth, window.innerHeight) } }// Pass the resolution }
            // shader.needsUpdate = true

            // batchedMesh.userData = {shader}
        }

        console.log('BatchedMeshes:', this.batchedMeshesList)

        for (const [batchMesh] of this.batchedMeshesList){
            // batchMesh.material =  batchMesh.userData.shader
            // batchMesh.material.needsUpdate = true
            this.add(batchMesh)   
       }
    }


}