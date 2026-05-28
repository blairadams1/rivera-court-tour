/**
 * Shared texture cache — avoids loading the same image URL multiple times.
 *
 * Two entry points:
 *   preloadTexture(url)       — starts loading into cache (no gl needed).
 *                                Call this from the onboarding overlay.
 *   loadTextureCached(url,gl) — returns cached texture (instant if preloaded)
 *                                and applies GPU-specific settings like anisotropy.
 */
import * as THREE from 'three';

const cache = new Map<string, Promise<THREE.Texture>>();
const loader = new THREE.TextureLoader();
loader.setCrossOrigin('anonymous');

/**
 * Preload a texture into the shared cache. Does NOT require a WebGLRenderer,
 * so it can be called before/outside the Canvas (e.g. from the overlay).
 * When loadTextureCached() is called later with the same URL, the texture
 * is already decoded and ready — no second download or decode needed.
 */
export function preloadTexture(url: string): Promise<THREE.Texture> {
  const existing = cache.get(url);
  if (existing) return existing;

  const promise = new Promise<THREE.Texture>((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        resolve(tex);
      },
      undefined,
      (err) => {
        cache.delete(url);
        reject(err);
      }
    );
  });

  cache.set(url, promise);
  return promise;
}

/**
 * Load a texture with caching. If the texture was already preloaded,
 * this returns instantly and applies GPU-specific settings (anisotropy).
 * @param url  The image URL to load
 * @param gl   WebGLRenderer (for anisotropy)
 */
export function loadTextureCached(
  url: string,
  gl: THREE.WebGLRenderer
): Promise<THREE.Texture> {
  const existing = cache.get(url);
  if (existing) {
    // Texture was preloaded — just apply GPU settings and return
    return existing.then((tex) => {
      tex.anisotropy = gl.capabilities.getMaxAnisotropy();
      return tex;
    });
  }

  // Not preloaded — do a full load with GPU settings
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
        cache.delete(url);
        reject(err);
      }
    );
  });

  cache.set(url, promise);
  return promise;
}
