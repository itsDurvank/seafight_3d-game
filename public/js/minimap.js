import { WORLD } from './config.js';

// North-up map of the whole sea: harbor, themed islands, enemy boats and you.
export class Minimap {
  constructor(canvas) {
    this.ctx = canvas.getContext('2d');
    this.size = canvas.width;
    this.scale = this.size / (WORLD.radius * 2 + 20);
  }

  px(x, z) {
    return [this.size / 2 + x * this.scale, this.size / 2 + z * this.scale];
  }

  draw(boat, enemies = [], potions = []) {
    const c = this.ctx, S = this.size;
    c.clearRect(0, 0, S, S);

    c.fillStyle = '#4fd8d0';
    c.beginPath(); c.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); c.fill();

    // harbor dock
    const d = WORLD.dock;
    const [dx, dz] = this.px(d.x, d.z);
    c.fillStyle = '#d9803f';
    c.fillRect(dx - 5, dz - 3, 10, 6);

    for (const i of WORLD.islands) {
      const [x, z] = this.px(i.x, i.z);
      const r = Math.max(i.r * this.scale, 5);
      c.fillStyle = i.theme.map; // each island has its own colour
      c.beginPath(); c.arc(x, z, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.beginPath(); c.arc(x, z, r * 0.55, 0, Math.PI * 2); c.fill();
      if (i.home) {
        c.strokeStyle = '#ffffff'; c.lineWidth = 2;
        c.beginPath(); c.arc(x, z, r + 2, 0, Math.PI * 2); c.stroke();
      }
    }

    // enemy boats: dots in their island's colour with a dark rim
    for (const e of enemies) {
      if (!e.alive) continue;
      const [x, z] = this.px(e.state.x, e.state.z);
      c.fillStyle = e.island.theme.map;
      c.strokeStyle = '#2b3a4a'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(x, z, 3.5, 0, Math.PI * 2); c.fill(); c.stroke();
    }

    // health potions: red dots with a white cross
    for (const p of potions) {
      const [x, z] = this.px(p.x, p.z);
      c.fillStyle = '#ff3b57'; c.strokeStyle = '#fff'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(x, z, 5, 0, Math.PI * 2); c.fill(); c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(x - 2.5, z); c.lineTo(x + 2.5, z); c.moveTo(x, z - 2.5); c.lineTo(x, z + 2.5); c.stroke();
    }

    // you: white-rimmed triangle pointing the way you sail
    const s = boat.state;
    const [bx, bz] = this.px(s.x, s.z);
    c.save();
    c.translate(bx, bz);
    c.rotate(Math.PI - s.yaw); // canvas y axis points down (+z)
    c.fillStyle = '#ff5a4d';
    c.strokeStyle = '#fff'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath();
    c.fill(); c.stroke();
    c.restore();
  }
}
