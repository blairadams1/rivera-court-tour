/**
 * Shared texture cache — avoids loading the same image URL multiple times.
 *
 * If 10 walls reference the same Firebase Storage URL, the image is only
 * fetched and decoded once. Subsequent requests for the same URL return
 * the cached THREE.Texture immediately.
 */
import * as THREE from 'three';

const cache = new Map<string, Promise<THREE.Texture>>();
const loader = new THREE.TextureLoader();
loader.setCrossOrigin('anonymous');

/**
 * Load a texture with caching. Returns the same promise for duplicate URLs.
 * @param url  The image URL to load
 * @param gl   WebGLRenderer (for anisotropy)
 */
export function loadTextureCached(
  url: string,
  gl: THREE.WebGLRenderer
): Promise<THREE.Texture> {
  const existing = cache.get(url);
  if (existing) return existing;

  const promise = new Promise<THREE.Texture>((resolve, reject) => {
    loader.load(
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
        // Remove from cache so a retry can work
        cache.delete(url);
        reject(err);
      }
    );
  });

  cache.set(url, promise);
  return promise;
}
