// Freeing GPU memory for things that leave the world for good. Materials and
// textures cached and shared between many objects are marked and kept.

import * as THREE from "three";

const shared = new WeakSet<object>();

/** Mark a cached material or texture so disposeTree leaves it alone. */
export function keep<T extends object>(res: T): T {
  shared.add(res);
  return res;
}

/** Dispose the geometries, materials and textures under root (detach it first). */
export function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    // Every sprite shares one internal quad.
    if (m.geometry && !(o instanceof THREE.Sprite) && !shared.has(m.geometry)) m.geometry.dispose();
    const mats = !m.material ? [] : Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      if (shared.has(mat)) continue;
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture && !shared.has(v)) v.dispose();
      mat.dispose();
    }
  });
}
