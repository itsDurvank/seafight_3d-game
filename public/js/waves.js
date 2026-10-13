import * as THREE from 'three';

// One wave function shared by the water surface and the boats, so everything
// always sits exactly on the visible waves.
export function waveHeight(x, z, t) {
  return (
    Math.sin(x * 0.08 + t * 0.9) * 0.35 +
    Math.sin(z * 0.11 + t * 1.3) * 0.25 +
    Math.sin((x + z) * 0.05 + t * 0.6) * 0.3
  );
}

const SIZE = 900; // bigger than the fog distance so the edge is never visible
const SEGMENTS = 150;
const CELL = SIZE / SEGMENTS; // 6 world units
const TILE = 70; // world units covered by one copy of the swirl texture

// Soft swirly pattern, like the painted water in the reference art.
function makeWaterTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#eaf8ff';
  g.fillRect(0, 0, S, S);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const x = rnd() * S, y = rnd() * S, r = 10 + rnd() * 34, a = rnd() * 6.28, len = 1.2 + rnd() * 2.2;
    const dark = i % 3 !== 0;
    g.strokeStyle = dark ? 'rgba(30,140,235,0.22)' : 'rgba(255,255,255,0.65)';
    g.lineWidth = dark ? 5 + rnd() * 8 : 2 + rnd() * 3;
    // draw wrapped copies so the texture tiles seamlessly
    for (let ox = -S; ox <= S; ox += S) {
      for (let oy = -S; oy <= S; oy += S) {
        g.beginPath();
        g.arc(x + ox, y + oy, r, a, a + len);
        g.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createWater(scene) {
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);
  const base = geo.attributes.position.array.slice();

  const tex = makeWaterTexture();
  const rep = SIZE / TILE;
  tex.repeat.set(rep, rep);

  const mat = new THREE.MeshPhongMaterial({
    color: 0x3ec6ff,
    map: tex,
    specular: 0xe6f8ff,
    shininess: 70,
    flatShading: true,
    transparent: true,
    opacity: 0.88,
  });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);

  return {
    mesh,
    // The plane follows the player, snapped to the grid so vertices never
    // "swim". The texture offset cancels the movement so the swirls stay put
    // in the world, then drifts slowly to feel alive.
    update(cx, cz, t) {
      const sx = Math.round(cx / CELL) * CELL;
      const sz = Math.round(cz / CELL) * CELL;
      mesh.position.set(sx, 0, sz);
      tex.offset.set(sx / TILE - 0.5 * rep + t * 0.01, -0.5 * rep - sz / TILE + t * 0.006);
      const pos = geo.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i + 1] = waveHeight(base[i] + sx, base[i + 2] + sz, t);
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
