/**
 * Shared texture cache — avoids loading the same image URL multiple times.
 *
 * If 10 walls reference the same Firebase Storage URL, the image is only
 * fetched and decoded once. Subsequent requests for the same URL return
 * the cached THREE.Texture immediately.
 */
import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

const cache = new Map<string, Promise<THREE.Texture>>();
const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');

let ktx2Loader: KTX2Loader | null = null;

function getKTX2Loader(gl: THREE.WebGLRenderer): KTX2Loader {
  if (!ktx2Loader) {
    ktx2Loader = new KTX2Loader();
    // Use local Basis transcoder hosted in public/basis/
    ktx2Loader.setTranscoderPath('/basis/');
    ktx2Loader.detectSupport(gl);
  }
  return ktx2Loader;
}

/**
 * Load a texture with caching. Supports KTX2 (.ktx2) and regular formats.
 * @param url  The image URL to load
 * @param gl   WebGLRenderer (for anisotropy and KTX2 support)
 */
export function loadTextureCached(
  url: string,
  gl: THREE.WebGLRenderer
): Promise<THREE.Texture> {
  const existing = cache.get(url);
  if (existing) return existing;

  const promise = new Promise<THREE.Texture>((resolve, reject) => {
    const isKTX2 = url.toLowerCase().endsWith('.ktx2');

    if (isKTX2) {
      const kLoader = getKTX2Loader(gl);
      kLoader.load(
        url,
        (tex) => {
          tex.anisotropy = gl.capabilities.getMaxAnisotropy();
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          resolve(tex);
        },
        undefined,
        (err) => {
          // Remove from cache so a retry can work
          cache.delete(url);
          console.error("KTX2 Load Failed:", url, err);
          reject(err);
        }
      );
    } else {
      textureLoader.load(
        url,
        (tex) => {
          tex.anisotropy = gl.capabilities.getMaxAnisotropy();
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.generateMipmaps = true;
          resolve(tex);
        },
        undefined,
        (err) => {
          cache.delete(url);
          console.error("Texture Load Failed:", url, err);
          reject(err);
        }
      );
    }
  });

  cache.set(url, promise);
  return promise;
}
