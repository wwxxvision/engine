import * as THREE from 'three'
import { MathUtils } from "three"




export class OcclusionCulling  {
    firstRender = true
    cullTarget: THREE.WebGLRenderTarget
    cullPixels: Uint8Array = new Uint8Array()
    cullMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
    cullMap: {[colorID: number]: boolean} = {}
    snapshotElement = document.querySelector('#snapshot')

    constructor() {

        this.cullTarget = this.createCullTarget();
        this.cullPixels = new Uint8Array(4 * this.cullTarget.width * this.cullTarget.height);
    }

    createCullTarget() {
        const target = new THREE.WebGLRenderTarget(Math.floor(window.innerWidth), Math.floor(window.innerHeight));
        target.texture.format = THREE.RGBAFormat;
        target.texture.colorSpace = THREE.LinearSRGBColorSpace;
        target.texture.minFilter = THREE.NearestFilter;
        target.texture.magFilter = THREE.NearestFilter;
        target.texture.generateMipmaps = false;
        target.stencilBuffer = false;
        target.depthBuffer = true;
        target.depthTexture = new THREE.DepthTexture(Math.floor(window.innerWidth), Math.floor(window.innerHeight));
        target.depthTexture.format = THREE.DepthFormat;
        target.depthTexture.type = THREE.UnsignedShortType;

        return target;
    } 



    update(scene: THREE.Scene, hiddenScene: THREE.Scene, renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
        this.cullMap = {}
        const pixels = new Uint8Array(
            window.innerHeight * window.innerWidth * 4,
          );
        const bufferTexture = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat});
  
        renderer.setRenderTarget(bufferTexture)
        // Устанавливаем рендер во внеэкранную текстуру
        renderer.render(hiddenScene, camera);

   
         // И, наконец, отрисовываем результат на экране
         renderer.readRenderTargetPixels(
            bufferTexture,
            0,
            0,
            window.innerWidth,
            window.innerHeight,
            pixels
        )

         
        renderer.setRenderTarget(null)
        renderer.render(scene, camera);
    

        for (let i = 0; i < pixels.length; i += 4) {
            const r = MathUtils.clamp(pixels[i], 0, 255);
            const g = MathUtils.clamp(pixels[i + 1], 0, 255);
            const b = MathUtils.clamp(pixels[i + 2], 0, 255);
            const c = (r << 16) | (g << 8) | b; // Construct color value
            this.cullMap[c] = true; // Set cullMap value to true for this color
        }

    }

    hasID(id: number) {
        return this.cullMap[id];
    }
}

