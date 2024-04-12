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
let NUM_MIPS = 0

const geometry = new THREE.BufferGeometry()
const vertices = new Float32Array( [
	-1, -1.0,  0.0, // v0
	 -0.8, -1.0,  0.0, // v1
	 -0.8,  1.0,  0.0, // v2
	-1,  1.0,  0.0, // v3
] );

const indices = [
	0, 1, 2,
	2, 3, 0,
];


var firsUpdateFuckingCostyl = true;
var positionsTexture = new THREE.DataTexture(
            new Float32Array(1),
            1,
            1,
            THREE.RedFormat,
            THREE.FloatType
        )

geometry.setIndex( indices );
geometry.setAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
geometry.boundingSphere = new THREE.Sphere().set(new THREE.Vector3(), Infinity)
//geometry.attributes = {
//  radius: new THREE.BufferAttribute(new Float32Array(3), 1),
//  position: new THREE.BufferAttribute(new Float32Array(9), 3),
//  // TODO: only highp supported, use uint8
//  visibility: new THREE.InstancedBufferAttribute(new Uint32Array(3), 1),
//}
//geometry.attributes.visibility.gpuType = THREE.IntType

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
const _compiled = new WeakMap()

const downsamplePass = new THREE.Mesh(geometry, downsampleMaterial)
const DEFAULT_FRAGMENT = new THREE.ShaderMaterial().fragmentShader // default_fragment
const cullMaterial = new THREE.RawShaderMaterial({
  defines: {
    NUM_MIPS: 0,
  },
  uniforms: {
    projectionViewMatrix: new THREE.Uniform(projectionViewMatrix),
    resolution: new THREE.Uniform(new THREE.Vector2()),
    mipmaps: new THREE.Uniform(null),
	sourceData : new THREE.Uniform(null),
  },
  vertexShader: /* glsl */ `
	in vec3 position;
    out vec2 uv;
	void main() {
      gl_Position = vec4(position, 1);
	  uv = vec2(position.x/2. +0.5, position.y/2. +0.5);
    }
  `,
  fragmentShader: /* glsl */ `

precision highp float;
precision highp sampler2D;
    uniform mat4 projectionViewMatrix;
    uniform vec2 resolution;
    uniform sampler2D[NUM_MIPS] mipmaps;
	
	uniform sampler2D sourceData;
	in vec2 uv;               

    out vec4 color;

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
    vec4 textureGatherLevel(sampler2D[NUM_MIPS] tex, vec2 uv, int level, int comp) {
      // TODO: implement RT mips and TEXTURE_BASE_LEVEL for Hi-Z feedback
      if (level < 1) return textureGather(tex[0], uv, comp);
      if (level == 1) return textureGather(tex[1], uv, comp);
      if (level == 2) return textureGather(tex[2], uv, comp);
      if (level == 3) return textureGather(tex[3], uv, comp);
      if (level == 4) return textureGather(tex[4], uv, comp);
      return textureGather(tex[5], uv, comp);
    }

    void main() {
      bool visible = true;
	  vec3 position;
	  position = texture(sourceData, uv).rgb;
	  float radius = texture(sourceData, uv).a;
	  
	  float frustumCull = 0.;

      // Frustum cull
      if (visible) {
        // http://cs.otago.ac.nz/postgrads/alexis/planeExtraction.pdf
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
			frustumCull = 1.;
            break;
          }
        }
      }
	float depth;
	vec4 tile;
	vec4 ndc;
	int mip;
      // Occlusion cull
      if (visible) {
        // Calculate sphere NDC from projected position
        ndc = projectionViewMatrix * vec4(position.xy, position.z - radius, 1);
        ndc.xyz /= ndc.w;

        // Sample screen depth
        vec2 uv = (ndc.xy + 1.0) * 0.5;
        mip = int(ceil(log2(radius * resolution)));
         tile = textureGatherLevel(mipmaps, uv, mip, 0);
        depth = max(max(tile.x, tile.y), max(tile.z, tile.w));

        // Test NDC against screen depth
        if (depth < ndc.z) visible = false;
      }

      // Write visibility
      color = vec4(visible ? 1u : 0u,0.,0, 0);
	  //color = vec4(0, 0,0,0);
	  
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
const mipmaps = [depthTarget]

const visibilityTarget = new THREE.WebGLRenderTarget(0, 0, {
    minFilter: THREE.NearestFilter,
    type: THREE.HalfFloatType,
    format: THREE.RedFormat,
  })
var buffer = new Uint8Array(visibilityTarget.width * visibilityTarget.height * 4);




export class OcclusionCulling  {
    firstRender = true
    renderer = new THREE.WebGLRenderer({preserveDrawingBuffer: true})
    scene = new THREE.Scene()
    camera = new THREE.Camera()
    target = new THREE.Vector3()
  
    

    constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, target: THREE.Vector3) {
        this.renderer = renderer
        this.scene = scene
        this.camera = camera
        this.target = target
		this.renderer.autoClearColor = false;
  
        this.onResize()
        window.addEventListener('resize', this.onResize)
    }

    onResize = () => {
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.renderer.getDrawingBufferSize(cullMaterial.uniforms.resolution.value)
		//console.log(cullMaterial.uniforms.resolution);
		 
        this.camera.aspect = window.innerWidth / window.innerHeight
        this.camera.updateProjectionMatrix()
		NUM_MIPS = 1 + Math.min(5, Math.floor(Math.log2(Math.max(window.innerWidth, window.innerHeight))))
	    cullMaterial.defines.NUM_MIPS = NUM_MIPS
	    


	    for (let i = 0; i < NUM_MIPS; i++) {
		    mipmaps[i] ??= depthTarget.clone()
			mipmaps[i].setSize(window.innerWidth >> i, window.innerHeight >> i)
	    }
		
		cullMaterial.uniforms.mipmaps.value = mipmaps.slice(0, NUM_MIPS).map((mipmap) => mipmap.texture)
		//visibilityTarget.setSize(1000,1000);
		cullMaterial.dispose()
      }
    
      
    private compute(node) {
      //this.renderer.setRenderTarget(visibilityTarget)
	  this.renderer.render(node, this.camera,visibilityTarget);
	  
	  
	  
	  //this.renderer.readRenderTargetPixels ( visibilityTarget, 0, 0, visibilityTarget.width , visibilityTarget.height , buffer )
	  var gl = this.renderer.getContext();
	  gl.readPixels( 0, 0, visibilityTarget.width , visibilityTarget.height,gl.RGBA, gl.UNSIGNED_BYTE, buffer );
	  //console.log(buffer);
	  
	  
	//  this.renderer.setRenderTarget(null)
    }


    update() {

   //  this.renderer.setRenderTarget(depthTarget)
   //  this.scene.overrideMaterial = depthMaterial
   //  this.renderer.render(this.scene, this.camera)
   
   if(firsUpdateFuckingCostyl && this.scene.children.length > 2)
   {
		let batched = this.scene.children[2].children[0];
		let spheres = [];
		
		this.scene.traverse(child => {
          if (child?.geometry) 
		  {
		    child.geometry.computeBoundingSphere();
            spheres.push(child.geometry.boundingSphere);
          }
		  })

		let countOfGeometry = spheres.length;
		firsUpdateFuckingCostyl = false;

		
		let data = new Float32Array(countOfGeometry);
		let colorsCount = 4;
	    data = new Float32Array(countOfGeometry * colorsCount);
		for(let i =0 ;i < countOfGeometry; i ++ )
		{
			let sphere = spheres[i];
			data[i*colorsCount+0] = sphere.center.x;
			data[i*colorsCount+1] = sphere.center.y;
			data[i*colorsCount+2] = sphere.center.z;
			data[i*colorsCount+3] = sphere.radius;
		}
		visibilityTarget.setSize(1,countOfGeometry);	
		
		positionsTexture = new THREE.DataTexture(
            data,
            1,
            countOfGeometry,
            THREE.RGBAFormat,
            THREE.FloatType
        )
		positionsTexture.needsUpdate = true;
		cullMaterial.uniforms.sourceData.value = positionsTexture;
		buffer = new Uint8Array(visibilityTarget.width * visibilityTarget.height * 4);
		
		
		
		
		cullMaterial.dispose()
   }
   
   for (let i = 0; i < NUM_MIPS; i++) {
    this.renderer.setRenderTarget(mipmaps[i])

    if (i === 0) {
      // Gather initial depth
      this.scene.overrideMaterial = depthMaterial
      this.renderer.render(this.scene, this.camera)
      this.scene.overrideMaterial = null
    } else {
      // Downsample previous level
      downsampleMaterial.uniforms.tDepth.value = mipmaps[i - 1].texture
      this.renderer.render(downsamplePass, this.camera)
    }
  }
  this.renderer.setRenderTarget(null)
      this.scene.overrideMaterial = null
	  this.scene.traverse(child => {
          if (child?.geometry) 
		  {
			child.visible = true;
          }
		  })


      this.renderer.setRenderTarget(null)

      this.camera.updateWorldMatrix()
      projectionViewMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse)
     
	  this.compute(cullMesh)
	  
	  let i = 0;
	  this.scene.traverse(child => {
          if (child?.geometry) 
		  {
			
			child.visible = buffer[i*4]>0;
			i++;
          }
		  })
		  
	  this.renderer.render(this.scene, this.camera)
       
	  

	  
    }



}

