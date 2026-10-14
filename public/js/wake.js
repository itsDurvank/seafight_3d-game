import * as THREE from 'three';
import { waveHeight } from './waves.js';

// A pool of flat white rings that spawn behind a boat, grow, and fade.
// Faster boats leave a longer, wider wake.
export class Wake {
  constructor(scene, pool = 60) {
    this.pool = pool;
    this.items = [];
    this.next = 0;
    this.distAcc = 0;
    const geo = new THREE.CircleGeometry(1, 14);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < pool; i++) {
      const m = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })
      );
      m.visible = false;
      scene.add(m);
      this.items.push({ mesh: m, age: 1, life: 1, size: 1 });
    }
  }

  update(dt, t, boat, active = true) {
    const s = boat.state;
    const sc = boat.scale || 1;
    this.distAcc += Math.abs(s.speed) * dt;
    if (active && Math.abs(s.speed) > 1.5 && this.distAcc > 0.9 + Math.abs(s.speed) * 0.03) {
      this.distAcc = 0;
      const it = this.items[this.next++ % this.pool];
      const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
      const x = s.x - fx * 2.6 * sc + (Math.random() - 0.5) * 0.6;
      const z = s.z - fz * 2.6 * sc + (Math.random() - 0.5) * 0.6;
      it.mesh.position.set(x, waveHeight(x, z, t) + 0.08, z);
      it.age = 0;
      it.life = 1.6 + Math.random() * 0.6;
      it.size = sc * (1 + Math.min(Math.abs(s.speed) / 60, 1) * 0.8);
      it.mesh.visible = true;
    }

    for (const it of this.items) {
      if (it.age >= it.life) { it.mesh.visible = false; continue; }
      it.age += dt;
      const p = Math.min(it.age / it.life, 1);
      it.mesh.scale.setScalar((0.5 + p * 2.2) * it.size);
      it.mesh.material.opacity = 0.55 * (1 - p);
      const pos = it.mesh.position;
      pos.y = waveHeight(pos.x, pos.z, t) + 0.08; // ride the waves
    }
  }

  destroy() {
    for (const it of this.items) {
      if (it.mesh && it.mesh.parent) it.mesh.parent.remove(it.mesh);
    }
    this.items = [];
  }
}
