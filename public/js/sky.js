import * as THREE from 'three';
import { COLORS } from './config.js';

const TAU = Math.PI * 2;

// Fluffy white cloud with a soft blue underside, painted on a canvas.
function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  const puffs = [[70, 80, 42], [110, 62, 52], [158, 66, 50], [196, 82, 40], [130, 86, 48], [90, 90, 36], [170, 92, 38]];
  for (const [x, y, r] of puffs) {
    const grad = g.createRadialGradient(x, y - r * 0.25, r * 0.1, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.65, 'rgba(255,255,255,0.95)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }
  g.globalCompositeOperation = 'source-atop';
  const shade = g.createLinearGradient(0, 50, 0, 128);
  shade.addColorStop(0, 'rgba(120,190,255,0)');
  shade.addColorStop(1, 'rgba(90,160,235,0.55)');
  g.fillStyle = shade;
  g.fillRect(0, 0, 256, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSky(scene) {
  // gradient dome: deep blue on top, bright cyan, pale aqua at the horizon
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(450, 24, 14),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x0e74e6) },
        mid: { value: new THREE.Color(0x3fc8f2) },
        bottom: { value: new THREE.Color(COLORS.horizon) },
      },
      vertexShader: `varying float h;
        void main(){ h = normalize(position).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying float h;
        void main(){
          vec3 c = mix(bottom, mid, smoothstep(0.0, 0.22, h));
          c = mix(c, top, smoothstep(0.18, 0.75, h));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    })
  );
  scene.add(dome);

  // everything below follows the camera so the horizon never gets closer
  const follow = new THREE.Group();
  scene.add(follow);

  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // big puffy clouds
  const clouds = new THREE.Group();
  follow.add(clouds);
  const tex = cloudTexture();
  for (let i = 0; i < 16; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    const a = rnd() * TAU;
    const R = 300 + rnd() * 120;
    const w = 130 + rnd() * 120;
    s.scale.set(w, w * 0.5, 1);
    s.position.set(Math.cos(a) * R, 60 + rnd() * 90, Math.sin(a) * R);
    clouds.add(s);
  }

  return {
    update(camera, t) {
      dome.position.copy(camera.position);
      follow.position.set(camera.position.x, 0, camera.position.z);
      clouds.rotation.y = t * 0.004;
    },
  };
}
