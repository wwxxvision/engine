import * as THREE from 'three'
import { OrbitControls } from 'three/addons'

const VARYING_REGEX = /[^\w](?:varying|out)\s+\w+\s+(\w+)\s*;/g

/** @type {WebGLTransformFeedback | null} */
let _transformFeedback = null

/** @type {WeakMap<THREE.ShaderMaterial, THREE.ShaderMaterial>} */
const _compiled = new WeakMap()
const _camera = new THREE.Camera()

const DEFAULT_FRAGMENT = new THREE.ShaderMaterial().fragmentShader // default_fragment

/**
 *
 * @param {THREE.Mesh} node
 */
THREE.WebGLRenderer.prototype.compute = function (node) {
  const skipRaster = node.material.fragmentShader === DEFAULT_FRAGMENT

  /** @type {WebGL2RenderingContext} */
  const gl = this.getContext()

  // Create memoized compute material
  let oldMaterial = node.material
  let material = _compiled.get(node.material)
  if (!material) {
    material = node.material.clone()
    material.vertexShader = node.material.computeShader
    if (skipRaster) material.fragmentShader = 'out lowp vec4 c;void main(){c=vec4(0);}'
    material.uniforms = node.material.uniforms
    _compiled.set(node.material, material)
  }
  node.material = material

  // Prime and get compiled program
  // NOTE: compile doesn't populate this.attributes
  // https://github.com/mrdoob/three.js/pull/26777
  this.render(node, _camera)
  const materialProperties = this.properties.get(material)
  const compiled = materialProperties.currentProgram
  const program = compiled.program

  _transformFeedback ??= gl.createTransformFeedback()
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, _transformFeedback)

  if (!compiled.outputs) {
    compiled.outputs = []

    // Get compiled source with resolved shader chunks
    const vertexShader = gl.getShaderSource(compiled.vertexShader)

    // Feedback shader outputs from source
    // TODO: interleave attributes for limits
    for (const [, output] of vertexShader.matchAll(VARYING_REGEX)) {
      const attribute = node.geometry.attributes[output]
      const { buffer } = this.attributes.get(attribute)
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, compiled.outputs.length, buffer)
      compiled.outputs.push(output)
    }

    gl.transformFeedbackVaryings(program, compiled.outputs, gl.SEPARATE_ATTRIBS)
    gl.linkProgram(program)

    const error = gl.getProgramInfoLog(program)
    if (error) throw new Error(error)

    // Force reset uniforms after relink
    for (const uniform of materialProperties.uniformsList) {
      uniform.addr = gl.getUniformLocation(program, uniform.id)
      uniform.cache = []
    }
  }

  if (!skipRaster) gl.enable(gl.RASTERIZER_DISCARD)

  gl.beginTransformFeedback(gl.TRIANGLES)
  this.render(node, _camera)
  gl.endTransformFeedback()

  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null)
  if (!skipRaster) gl.disable(gl.RASTERIZER_DISCARD)
  node.material = oldMaterial

  // Debug CPU readback
  // for (const output of compiled.outputs) {
  //   const attribute = node.geometry.attributes[output]
  //   const { buffer } = this.attributes.get(attribute)

  //   gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  //   gl.getBufferSubData(gl.ARRAY_BUFFER, 0, attribute.array)
  //   gl.bindBuffer(gl.ARRAY_BUFFER, null)

  //   console.log(output, ...Array.from(attribute.array))
  // }
}

THREE.ShaderMaterial.prototype.computeShader = ''


// geometry.setDrawRange(0, 3)
// geometry.boundingSphere = new THREE.Sphere().set(new THREE.Vector3(), Infinity)
// geometry.attributes = {
//   radius: new THREE.BufferAttribute(new Float32Array(3), 1),
//   position: new THREE.BufferAttribute(new Float32Array(9), 3),
//   // TODO: only highp supported, use uint8
//   visibility: new THREE.InstancedBufferAttribute(new Uint32Array(3), 1),
// }
// geometry.attributes.visibility.gpuType = THREE.IntType

// const projectionViewMatrix = new THREE.Matrix4()


const cullMesh = new THREE.Mesh(geometry, cullMaterial)

const normalMaterial = new THREE.ShaderMaterial({
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

const meshGeometry = new THREE.BoxGeometry()
meshGeometry.setAttribute('visibility', geometry.attributes.visibility)
meshGeometry.computeBoundingSphere()

const cube = new THREE.InstancedMesh(meshGeometry, normalMaterial, 1)
geometry.attributes.radius.array[0] = meshGeometry.boundingSphere.radius
scene.add(cube)

const plane = new THREE.Mesh(meshGeometry, new THREE.MeshNormalMaterial())
plane.position.z = 1
plane.scale.set(2, 2, 0.001)
plane.material.transparent = true
plane.material.opacity = 0.2
scene.add(plane)

const downsampleMaterial = new THREE.ShaderMaterial({
  uniforms: {
    tDepth: new THREE.Uniform(null),
  },
  vertexShader: /* glsl */ `
    out vec2 vUv;

    void main() {
      vUv = vec2(gl_VertexID << 1 & 2, gl_VertexID & 2);
      gl_Position = vec4(vUv * 2.0 - 1.0, 0, 1);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDepth;
    in vec2 vUv;

    vec4 textureGather(sampler2D tex, vec2 uv, int comp) {
      vec2 res = vec2(textureSize(tex, 0));
      ivec2 p = ivec2((uv * res) - 0.5);
      return vec4(
        texelFetchOffset(tex, p, 0, ivec2(0, 1))[comp],
        texelFetchOffset(tex, p, 0, ivec2(1, 1))[comp],
        texelFetchOffset(tex, p, 0, ivec2(1, 0))[comp],
        texelFetchOffset(tex, p, 0, ivec2(0, 0))[comp]
      );
    }

    void main() {
      vec4 tile = textureGather(tDepth, vUv, 0);
      float depth = max(max(tile.x, tile.y), max(tile.z, tile.w));
      gl_FragColor = vec4(depth, 0, 0, 1);
    }
  `,
})
const downsamplePass = new THREE.Mesh(geometry, downsampleMaterial)

const depthTarget = new THREE.WebGLRenderTarget(0, 0, {
  minFilter: THREE.NearestFilter,
  type: THREE.HalfFloatType,
  format: THREE.RedFormat,
})

let NUM_MIPS = 0
const mipmaps = [depthTarget]

const onResize = () => {
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.getDrawingBufferSize(cullMaterial.uniforms.resolution.value)

  // TODO: use POT and TEXTURE_BASE_LEVEL
  // https://bugs.chromium.org/p/chromium/issues/detail?id=1383129
  NUM_MIPS = 1 + Math.min(5, Math.floor(Math.log2(Math.max(window.innerWidth, window.innerHeight))))
  cullMaterial.defines.NUM_MIPS = NUM_MIPS
  // cullMaterial.computeShader = cullMaterial.computeShader.replace(
  //   mipSelectCode,
  //   (mipSelectCode = /* glsl */ `vec4 tile;${Array.from(
  //     { length: NUM_MIPS },
  //     (_, i) => `if (mip == ${i}) tile = textureGather(mipmaps[${i}], uv, 0);`,
  //   ).join('\n')}`),
  // )
  cullMaterial.dispose()

  cullMaterial.vertexShader.replace()

  for (let i = 0; i < NUM_MIPS; i++) {
    mipmaps[i] ??= depthTarget.clone()
    mipmaps[i].setSize(window.innerWidth >> i, window.innerHeight >> i)
  }

  cullMaterial.uniforms.mipmaps.value = mipmaps.slice(0, NUM_MIPS).map((mipmap) => mipmap.texture)

  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}
onResize()
window.addEventListener('resize', onResize)

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

renderer.setAnimationLoop(() => {
  controls.update()

  // Create Hi-Z mip-chain
  for (let i = 0; i < NUM_MIPS; i++) {
    renderer.setRenderTarget(mipmaps[i])

    if (i === 0) {
      // Gather initial depth
      scene.overrideMaterial = depthMaterial
      renderer.render(scene, camera)
      scene.overrideMaterial = null
    } else {
      // Downsample previous level
      downsampleMaterial.uniforms.tDepth.value = mipmaps[i - 1].texture
      renderer.render(downsamplePass, camera)
    }
  }
  renderer.setRenderTarget(null)

  // Perform occlusion culling
  camera.updateWorldMatrix()
  projectionViewMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  renderer.compute(cullMesh)

  // Render with culling
  renderer.render(scene, camera)
})