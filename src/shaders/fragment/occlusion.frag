  uniform sampler2D textureSampler;
  uniform vec2 resolution;
  

    void main() {
       vec2 uv = gl_FragCoord.xy / resolution.xy; // Calculate UV coordinates without passing them from the vertex shader
       vec4 textureColor = texture2D(textureSampler, vec2(uv.x, 0));
       gl_FragColor = vec4(textureColor.rgb, 1);
       
    
    }