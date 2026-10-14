import * as THREE from 'three';

// Shared helpers for the extra boat / trophy / decoration assets.
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const angleDiff = (a, b) => ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
export const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.75, ...extra });
export const glow = (color, opacity = 1, additive = false) => new THREE.MeshBasicMaterial({
  color, transparent: opacity < 1 || additive, opacity, depthWrite: !additive, side: THREE.DoubleSide,
  blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
});
export const add = (parent, mesh, x = 0, y = 0, z = 0) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
export const box = (parent, w, h, d, color, x, y, z) => add(parent, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(color)), x, y, z);
// cylinder lying along Z (barrels, engines)
export const cylZ = (parent, r, len, color, x, y, z) => {
  const geo = new THREE.CylinderGeometry(r, r, len, 10); geo.rotateX(Math.PI / 2);
  return add(parent, new THREE.Mesh(geo, std(color)), x, y, z);
};

// Loft a hull from cross-sections [z, halfWidth, deckY, keelY]: a real boat silhouette with flat facets.
export function loft(stations, color, { bottomTaper = 0.7, widen = 1, band = 0 } = {}) {
  const sec = ([z, hw, top, bot]) => {
    const a = hw * widen, b = hw * bottomTaper * widen, t = top + (band ? 0.02 : 0), bt = band ? top - band : bot;
    return [[-a, t, z], [a, t, z], [band ? a : b, bt, z], [band ? -a : -b, bt, z]];
  };
  const S = stations.map(sec), pos = [], tri = (p, q, r) => pos.push(...p, ...q, ...r);
  for (let i = 0; i < S.length - 1; i++) for (let k = 0; k < 4; k++) {
    const a = S[i][k], b = S[i][(k + 1) % 4], c = S[i + 1][(k + 1) % 4], d = S[i + 1][k];
    tri(a, b, c); tri(a, c, d);
  }
  tri(S[0][0], S[0][1], S[0][2]); tri(S[0][0], S[0][2], S[0][3]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, std(color, { side: THREE.DoubleSide }));
}
