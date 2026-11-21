// VERDE BAY v9 — vehicles: arcade car physics, traffic that follows the road
// grid, police chase AI and the 5-star military jeep + helicopter response.
// A vehicle is data + a mesh; the sim owns the list, this file owns how a car
// moves, turns, boosts and gets hit.
import { CARS, POLICE } from './config.js';
import { clamp, lerpAngle, rand, randInt, choice, dist2d, angleDiff } from './util.js';
import { makeCarMesh, makePoliceMesh, makeHelicopterMesh } from './render3d.js';

const THREE = window.THREE;

export class Vehicle {
  constructor(scene, carDef, x, z, heading, opts = {}) {
    this.def = carDef;
    this.x = x; this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.kind = carDef.kind;
    this.isPolice = !!opts.police;
    this.isMilitary = !!opts.military;
    this.isPlayer = false;
    this.parked = !!opts.parked;
    this.driver = opts.driver || null; // 'player' | 'traffic' | 'police' | null
    this.health = opts.armor ? 200 : 100;
    this.maxHealth = this.health;
    this.nos = 100;
    this.nosMax = opts.nosKit ? 150 : 100;
    // Every car carries a nitrous tank: the NOS kit upgrade only makes it
    // bigger. Traffic never boosts, so this costs the AI nothing.
    this.nosInstalled = true;
    this.engineLevel = opts.engine || 0;
    this.neon = !!opts.neon;
    this.color = opts.color !== undefined ? opts.color : carDef.color;
    this.mesh = this.isPolice || this.isMilitary ? makePoliceMesh() : makeCarMesh(this.color, carDef.kind);
    if (this.isMilitary) this.mesh.children[0].material.color.setHex(0x4a5d3a);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.waypoints = null;
    this.wpIndex = 0;
    this.cruise = rand(9, 14);
    this.stuckTimer = 0;
    this.reverseTimer = 0;
    this.lastX = x;
    this.lastZ = z;
    this.dead = false;
    if (this.neon) {
      const glow = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.1, 4.2),
        new THREE.MeshBasicMaterial({ color: 0x39d5ff, transparent: true, opacity: 0.5 }),
      );
      glow.position.y = 0.12;
      this.mesh.add(glow);
    }
  }
  topSpeed() {
    const base = this.def.topSpeed * (1 + this.engineLevel * 0.15);
    return this.isPolice ? Math.max(base, POLICE.chaseSpeed) : base;
  }
  // Player driving: throttle -1..1, steer -1..1, nosBoost true while Shift.
  drive(dt, throttle, steer, nosBoost, nosRefillRate) {
    const accel = this.def.accel * (nosBoost && this.nos > 0 ? 2.1 : 1);
    this.speed += throttle * accel * dt;
    if (throttle === 0) this.speed *= Math.pow(0.4, dt); // coast
    if (throttle < 0 && this.speed > 0.5) this.speed -= 18 * dt; // brake
    const max = this.topSpeed() * (nosBoost && this.nos > 0 ? 1.35 : 1);
    this.speed = clamp(this.speed, -10, max);
    const steerTarget = steer * this.def.handling * clamp(Math.abs(this.speed) / 12, 0, 1);
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 8);
    this.heading += this.steer * dt * (this.speed >= 0 ? 1 : -1) * 0.9;
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
    if (nosBoost && this.nos > 0 && throttle > 0) this.nos = Math.max(0, this.nos - 34 * dt);
    else this.nos = Math.min(this.nosMax, this.nos + nosRefillRate * dt);
    this.syncMesh();
  }
  // Traffic / police AI: follow waypoints, or chase a target point.
  autopilot(dt, target, colliders, vehicles) {
    if (this.parked) return;
    // Stuck detection: sample the position every half second; if the car
    // barely moved (pinned against a building by the collision push-out),
    // reverse briefly, then carry on.
    this._checkT = (this._checkT || 0) + dt;
    if (this._checkT >= 0.5) {
      this._checkT = 0;
      if (this._checkX !== undefined && dist2d(this.x, this.z, this._checkX, this._checkZ) < 1) {
        this.stuckTimer += 0.5;
      } else {
        this.stuckTimer = 0;
      }
      this._checkX = this.x; this._checkZ = this.z;
    }
    if (this.stuckTimer > 2) { this.reverseTimer = 0.9; this.stuckTimer = 0; }
    if (this.reverseTimer > 0) {
      this.reverseTimer -= dt;
      this.drive(dt, -0.8, 0.6, false, 0);
      return;
    }
    let tx, tz, desired;
    if (target) {
      tx = target.x; tz = target.z;
      desired = Math.atan2(tx - this.x, tz - this.z);
      const d = dist2d(this.x, this.z, tx, tz);
      const throttle = d > 6 ? 1 : 0.3;
      this.drive(dt, throttle, clamp(angleDiff(this.heading, desired) * 1.4, -1, 1), false, 0);
      return;
    }
    if (!this.waypoints || this.waypoints.length === 0) return;
    const wp = this.waypoints[this.wpIndex];
    const d = dist2d(this.x, this.z, wp.x, wp.z);
    if (d < 5) { this.wpIndex = (this.wpIndex + 1) % this.waypoints.length; return; }
    desired = Math.atan2(wp.x - this.x, wp.z - this.z);
    // Slow down if another car is right ahead.
    let blocked = false;
    for (const v of vehicles) {
      if (v === this || v.dead) continue;
      const dd = dist2d(this.x, this.z, v.x, v.z);
      if (dd < 7 && Math.abs(angleDiff(this.heading, Math.atan2(v.x - this.x, v.z - this.z))) < 0.5) { blocked = true; break; }
    }
    const throttle = blocked ? -0.4 : 0.55;
    this.drive(dt, throttle, clamp(angleDiff(this.heading, desired) * 1.2, -1, 1), false, 0);
    void colliders;
  }
  damage(amount) {
    this.health -= amount;
    if (this.health <= 0) { this.dead = true; this.speed = 0; }
    return this.dead;
  }
  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const wheels = this.mesh.userData.wheels || [];
    for (const w of wheels) w.rotation.x += this.speed * 0.02;
  }
  dispose(scene) { scene.remove(this.mesh); }
}

// A loop of waypoints around the road grid for traffic cars.
export function makeTrafficRoute(roadLines, rng) {
  const pts = [];
  const n = 6 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i++) {
    const vertical = rng() < 0.5;
    const line = choice(roadLines);
    const along = -190 + rng() * 380;
    pts.push(vertical ? { x: line, z: along } : { x: along, z: line });
  }
  return pts;
}

export class Helicopter {
  constructor(scene) {
    this.mesh = makeHelicopterMesh();
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.active = false;
    this.x = 0; this.z = 0; this.y = 55;
    this.heading = 0;
  }
  update(dt, targetX, targetZ, wanted) {
    const want = wanted >= 5;
    if (want && !this.active) { this.active = true; this.mesh.visible = true; }
    if (!want && this.active) { this.active = false; this.mesh.visible = false; }
    if (!this.active) return;
    this.heading += dt * 0.5;
    const tx = targetX + Math.sin(this.heading) * 18;
    const tz = targetZ + Math.cos(this.heading) * 18;
    this.x += (tx - this.x) * Math.min(1, dt * 1.2);
    this.z += (tz - this.z) * Math.min(1, dt * 1.2);
    this.mesh.position.set(this.x, this.y + Math.sin(performance.now() / 700) * 1.5, this.z);
    this.mesh.rotation.y = Math.atan2(targetX - this.x, targetZ - this.z);
    this.mesh.userData.rotor.rotation.y += dt * 22;
    this.mesh.userData.spot.target.position.set(targetX - this.x, -this.y, targetZ - this.z);
  }
}

export function randomCarDef(rng) {
  const pool = CARS.filter((c) => c.id !== 'taxi');
  return pool[Math.floor(rng() * pool.length)];
}
export { randInt };
