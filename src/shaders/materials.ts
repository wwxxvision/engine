import * as THREE from "three";



export const  cullMaterial = new THREE.RawShaderMaterial({
    defines: {
      NUM_MIPS: 0,
    },
    uniforms: {
      projectionViewMatrix: new THREE.Uniform(projectionViewMatrix),
      resolution: new THREE.Uniform(new THREE.Vector2()),
      mipmaps: new THREE.Uniform(null),
    },
    computeShader: /* glsl */ `//#version 300 es
      uniform mat4 projectionViewMatrix;
      uniform vec2 resolution;
      uniform sampler2D[NUM_MIPS] mipmaps;
  
      in float radius;
      in vec3 position;
      flat out uint visibility;
  
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
              break;
            }
          }
        }
  
        // Occlusion cull
        if (visible) {
          // Calculate sphere NDC from projected position
          vec4 ndc = projectionViewMatrix * vec4(position.xy, position.z - radius, 1);
          ndc.xyz /= ndc.w;
  
          // Sample screen depth
          vec2 uv = (ndc.xy + 1.0) * 0.5;
          int mip = int(ceil(log2(radius * resolution)));
          vec4 tile = textureGatherLevel(mipmaps, uv, mip, 0);
          float depth = max(max(tile.x, tile.y), max(tile.z, tile.w));
  
          // Test NDC against screen depth
          if (depth < ndc.z + 0.01) visible = false;
        }
  
        // Write visibility
        visibility = visible ? 1u : 0u;
      }
    `,
    glslVersion: THREE.GLSL3,
  })