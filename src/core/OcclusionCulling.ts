import * as THREE from 'three'

const _camera = new THREE.Camera()
const projectionViewMatrix = new THREE.Matrix4()
const viewMatrix = new THREE.Matrix4()

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
    viewMatrix: new THREE.Uniform(viewMatrix),
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
    uniform mat4 viewMatrix;
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
	
	vec4 extractFrustumPlane(mat4 pv, int i) {
    vec4 row = (i < 4) ? pv[i] : pv[i - 4]; // Rows 0-3 are for the projection, rows 4-7 are for the view
	
	vec4 res = vec4(normalize(row.xyz), row.w);
	res.w = res.w / length(row.xyz);
	return res;
	
	
    float s = sign(row.w);
    return s * row;
}

// Function to compute the frustum planes from the combined projection-view matrix
void computeFrustumPlanes(mat4 pv, out vec4 planes[6]) {
    // Right
    planes[0] = extractFrustumPlane(pv, 3) + extractFrustumPlane(pv, 0);

    // Left
    planes[1] = extractFrustumPlane(pv, 3) - extractFrustumPlane(pv, 0);

    // Bottom
    planes[2] = extractFrustumPlane(pv, 3) + extractFrustumPlane(pv, 1);

    // Top
    planes[3] = extractFrustumPlane(pv, 3) - extractFrustumPlane(pv, 1);

    // Far
    planes[4] = extractFrustumPlane(pv, 3) + extractFrustumPlane(pv, 2);

    // Near
    planes[5] = extractFrustumPlane(pv, 3) - extractFrustumPlane(pv, 2);
}


    void main() {
      bool visible = true;
	  vec3 position;
	  position = texture(sourceData, uv).rgb;
	  float radius = texture(sourceData, uv).a;
	  
	  float frustumCull = 0.;

      // Frustum cull
        mat4 frustum = transpose(projectionViewMatrix);
        vec4 planes[] = vec4[](
          frustum[3] - frustum[0], // left   (-w < +x)
          frustum[3] + frustum[0], // right  (+x < +w)
          frustum[3] - frustum[1], // bottom (-w < +y)
          frustum[3] + frustum[1], // top    (+y < +w)
          frustum[3] - frustum[2], // near   (-w < +z)
          frustum[3] + frustum[2]  // far    (+z < +w)
        );
		
		//vec4 planes[6];
		//computeFrustumPlanes(frustum, planes);	
        for (int i = 0; i < 6; i++) {
		  float l = length(planes[i].xyz);
		   planes[i].xyz= normalize(planes[i].xyz);
		   planes[i].w /= l;
		
		
          float distance = dot(planes[i].xyz, position) + planes[i].w;
          if (distance < -radius) {
            visible = false;
			frustumCull = 1.;
            break;
          }
        }
      
	float depth;
	vec4 tile;
	vec4 ndc;
	int mip;
      // Occlusion cull
      //if (visible) 
	  {
        // Calculate sphere NDC from projected position
		vec4 offset = viewMatrix*vec4(0,0,radius,0);
		
        ndc = projectionViewMatrix * vec4(position.xyz + offset.xyz, 1);
        ndc.xyz /= ndc.w;

        // Sample screen depth
        vec2 uv = (ndc.xy + 1.0) * 0.5;
		if(uv.x>0. && uv.x < 1. && uv.y>0. && uv.y<1.)
		{
			mip = int(ceil(log2(radius * resolution)));
			 tile = textureGatherLevel(mipmaps, uv, 0, 0);
			depth = max(max(tile.x, tile.y), max(tile.z, tile.w));

			// Test NDC against screen depth
			//if (depth < ndc.z + 0.01) visible = false;
			if (depth < ndc.z *  1.01 ) visible = false;
		}
      }

      // Write visibility
      //color = vec4(visible,1.-frustumCull,0, 0);
	  color = vec4(visible,0,  0,0);
	  
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

 var spheres = [];
var geometries = [];

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
 this.scene.traverse(child => {
          if (child?.geometry) 
		  {
			child.visible = true;
          }
		  })
   //  this.renderer.setRenderTarget(depthTarget)
   //  this.scene.overrideMaterial = depthMaterial
   //  this.renderer.render(this.scene, this.camera)
  
   if(firsUpdateFuckingCostyl && this.scene.children.length > 2)
   {
		let batched = this.scene.children[2].children[0];
		
		
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
		for(let i =0 ; i < countOfGeometry; i ++ )
		{
			let sphere = spheres[i];
			data[i*colorsCount+0] = sphere.center.x;
			data[i*colorsCount+1] = sphere.center.y;
			data[i*colorsCount+2] = sphere.center.z;
			data[i*colorsCount+3] = sphere.radius;
		}
		visibilityTarget.setSize(1,window.innerHeight);	
		
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
		
	
		for(let i =0; i < countOfGeometry;i ++)
		{
			const geometry = new THREE.SphereGeometry( spheres[i].radius, 32, 16 ); 
			const material = new THREE.MeshBasicMaterial( { color: 0xffffff99 } ); 
		    //material.wireframe = true;
			const sphere = new THREE.Mesh( geometry, material ); 
			//sphere.position.set(spheres[i].center...);
			//this.scene.add( sphere );
			sphere.position.copy(spheres[i].center);
			geometries.push(sphere);
		}
		
		
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
	 


      this.renderer.setRenderTarget(null)

      this.camera.updateWorldMatrix()
	  viewMatrix.copy(this.camera.matrixWorld);
	  projectionViewMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
	  
	  //let myVec = new THREE.Vector4(spheres[0].center.x,spheres[0].center.y, spheres[0].center.z,1);
	  //myVec.applyMatrix4(projectionViewMatrix);
	  //console.log(myVec.z/myVec.w  + "  " + myVec.z);
	  
	  //let myMatrix = new THREE.Matrix4();
      //myMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse)
	  //cullMaterial.uniforms.projectionViewMatrix = {value:myMatrix};
	  //
      //console.log(projectionViewMatrix); 
	  this.compute(cullMesh)
	  
	  let i = 0;
		this.scene.traverse(child => {
			if (child?.geometry) 
		{
		let i2 = Math.floor(window.innerHeight / geometries.length * i);
		let index = (i2+2)*4;
			//if(buffer.length <= i*4) 
			//	return;
			child.visible = buffer[index]>0.5;
			i++;
			
			}
		})
	for(let i =0; i < geometries.length; i ++ )
	{
		let i2 = Math.floor(window.innerHeight / geometries.length * i);
		let index = (i2+2)*4;
		geometries[i].material.color.r = buffer[index +0] /256.;
		geometries[i].material.color.g = buffer[index +1] /256.;
		geometries[i].material.color.b = buffer[index +2] /256.;
		//geometries[i].visible = buffer[(i2+2)*4]>0;
		
	}    
	  this.renderer.render(this.scene, this.camera)
       
	  

	  
    }



}

