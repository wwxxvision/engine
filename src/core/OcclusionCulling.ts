import * as THREE from 'three'

const _camera = new THREE.Camera()
const projectionViewMatrix = new THREE.Matrix4()

const depthMaterial = new THREE.ShaderMaterial({
  vertexShader: /* glsl */ `
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1);
    }
  `,
  fragmentShader: /* glsl */ `
    void main() {
      gl_FragColor = vec4(gl_FragCoord.z, 0, 0, 1);
    }
  `,
})

const geometry = new THREE.BufferGeometry()
geometry.setDrawRange(0, 3)
geometry.boundingSphere = new THREE.Sphere().set(new THREE.Vector3(), Infinity)
geometry.attributes = {
  radius: new THREE.BufferAttribute(new Float32Array(3), 1),
  position: new THREE.BufferAttribute(new Float32Array(9), 3),
  // TODO: only highp supported, use uint8
  visibility: new THREE.InstancedBufferAttribute(new Uint32Array(3), 1),
}
geometry.attributes.visibility.gpuType = THREE.IntType


const cullMaterial = new THREE.ShaderMaterial({
  uniforms: {
    projectionViewMatrix: new THREE.Uniform(projectionViewMatrix),
    mipmap: new THREE.Uniform(null),
  },
  vertexShader: /* glsl */ `
    uniform mat4 projectionViewMatrix;
    uniform sampler2D mipmap;

    in float radius;
    in vec3 position;
    flat out uint visibility;

    void main() {
       bool visible = true;

        mat4 frustum = transpose(projectionViewMatrix);
        vec4 planes[] = vec4[](
          frustum[3] - frustum[0], // left   (-w < +x)
          frustum[3] + frustum[0], // right  (+x < +w)
          frustum[3] - frustum[1], // bottom (-w < +y)
          frustum[3] + frustum[1], // top    (+y < +w)
          frustum[3] - frustum[2], // near   (-w < +z)
          frustum[3] + frustum[2]  // far    (+z < +w)
        );

        for (int i = 0; i < 6; i++) {
          float distance = dot(planes[i], vec4(position, 1));
          if (distance < -radius) {
            visible = false;
            break;
          }
        }

        // Write visibility
        visibility = visible ? 1u : 0u;
    }
  `,
  fragmentShader: /* glsl */ `
    void main() {
   
    }
  `,
  glslVersion: THREE.GLSL3,
})

const cullMesh = new THREE.Mesh(geometry, cullMaterial)


// Текстура глубины
const depthTarget = new THREE.WebGLRenderTarget(0, 0, {
    minFilter: THREE.NearestFilter,
    type: THREE.HalfFloatType,
    format: THREE.RedFormat,
  })
  




export class OcclusionCulling  {
    firstRender = true
    renderer = new THREE.WebGLRenderer()
    scene = new THREE.Scene()
    camera = new THREE.Camera()
    target = new THREE.Vector3()
  
      

    constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, target: THREE.Vector3) {
        this.renderer = renderer
        this.scene = scene
        this.camera = camera
        this.target = target

        this.onResize()
        window.addEventListener('resize', this.onResize)
    }

    onResize = () => {
        this.renderer.setSize(window.innerWidth, window.innerHeight)
       
        this.camera.aspect = window.innerWidth / window.innerHeight
        this.camera.updateProjectionMatrix()
      }
    
      
    private compute() {
      const gl = this.renderer.getContext() as WebGL2RenderingContext

      // gl.enable(gl.RASTERIZER_DISCARD);

      // cullMaterial.uniforms.mipmap.value = depthTarget.texture
      // this.renderer.render(cullMesh, _camera)
      // const materialProperties = this.renderer.properties.get(cullMaterial)
      // const compiled  = materialProperties.currentProgram
      // const program  = compiled.program as WebGLProgram

      // gl.getVertexAttrib()

      // const buffer = new  Uint8Array()
      // gl.getBufferSubData(gl.ARRAY_BUFFER,3, buffer)
      // gl.cullFace(gl.FRONT_AND_BACK);  

      // gl.disable(gl.RASTERIZER_DISCARD);
   

      // gl.linkProgram(program);
      // if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      //   throw new Error(gl.getProgramParameter(program));
      // }
      
      // console.log(buffer)


      // const compiled =this.renderer.compile()
      

      // gl.transformFeedbackVaryings()
  
    }


    update() {

      this.renderer.setRenderTarget(depthTarget)
      this.scene.overrideMaterial = depthMaterial
   
    
      // Render with culling
      this.renderer.render(this.scene, this.camera)
      this.scene.overrideMaterial = null

      this.renderer.setRenderTarget(null)

      this.camera.updateWorldMatrix()
      projectionViewMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse)

      this.compute()

      this.renderer.render(this.scene, this.camera)
    }



}

