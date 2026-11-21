// VERDE BAY v9 — the simulation: the player on foot and behind the wheel,
// traffic, pedestrians, the wanted system and the police response, collisions
// and the day/night clock. Every other system (missions, garage, race, crew,
// weapons, HUD) reads and writes this one object.
import { WORLD, PLAYER, POLICE, CARS } from './config.js';
import { clamp, dist2d, rand, randInt, choice, angleDiff, mulberry32 } from './util.js';
import { buildCity } from './city.js';
import { createScene, applyTimeOfDay, makePlayerMesh, makePedMesh, updateChaseCamera } from './render3d.js';
import { Vehicle, makeTrafficRoute, Helicopter } from './vehicles.js';
import { Weapons } from './weapons.js';
import { Garage } from './garage.js';
import { Race } from './race.js';
import { Crew } from './crew.js';
import { Effects } from './effects.js';
import { AudioSys } from './audio.js';

const THREE = window.THREE;

export class Sim {
  constructor(canvas) {
    const env = createScene();
    this.scene = env.scene;
    this.env = env;
    this.canvas = canvas;
    this.city = buildCity(this.scene);
    this.effects = new Effects(this.scene);
    this.audio = new AudioSys();
    this.weapons = new Weapons(this);
    this.garage = new Garage(this);
    this.crew = new Crew(this);
    this.race = null;
    this.missions = null; // wired by main.js after construction
    this.money = PLAYER.startMoney;
    this.respect = 0;
    this.timeOfDay = WORLD.startTime;
    this.day = 1;
    this.heat = 0;
    this.wanted = 0;
    this.bustedTimer = 0;
    this.vehicles = [];
    this.policeCars = [];
    this.peds = [];
    this.attackers = [];
    this.player = null;
    this.cameraYaw = 0;
    this.message = '';
    this.messageTimer = 0;
    this.objective = null;
    this.beacon = null;
    this.heli = new Helicopter(this.scene);
    this.spawnTraffic();
    this.spawnParkedCars();
    this.spawnPeds();
    this.spawnPlayer();
    this.save = null;
  }
  spawnPlayer() {
    const mesh = makePlayerMesh();
    this.scene.add(mesh);
    this.player = {
      mesh, x: this.city.spawnPos.x, z: this.city.spawnPos.z,
      heading: Math.PI, speed: 0, onFoot: true, vehicle: null,
      health: PLAYER.health, weapon: 0, moving: false,
    };
    mesh.position.set(this.player.x, 0, this.player.z);
  }
  spawnTraffic() {
    const rng = mulberry32(4242);
    for (let i = 0; i < 10; i++) {
      const def = CARS[randInt(0, CARS.length - 1)];
      const line = choice(this.city.roadLines);
      const along = rand(-190, 190);
      const vertical = rng() < 0.5;
      const v = new Vehicle(this.scene, def, vertical ? line : along, vertical ? along : line, rng() * Math.PI * 2, { driver: 'traffic' });
      v.waypoints = makeTrafficRoute(this.city.roadLines, rng);
      v.wpIndex = randInt(0, v.waypoints.length - 1);
      this.vehicles.push(v);
    }
  }
  spawnParkedCars() {
    const rng = mulberry32(777);
    for (let i = 0; i < 9; i++) {
      const def = CARS[randInt(0, CARS.length - 1)];
      const line = choice(this.city.roadLines);
      const along = rand(-180, 180);
      const vertical = rng() < 0.5;
      const v = new Vehicle(this.scene, def,
        vertical ? line + 6 : along, vertical ? along : line + 6,
        vertical ? 0 : Math.PI / 2, { parked: true, driver: null });
      this.vehicles.push(v);
    }
    // A Vesper GT parked in Old Town for the Repo Run (mission 5).
    const sport = new Vehicle(this.scene, CARS.find((c) => c.id === 'sport'), 120, -128, Math.PI / 2, { parked: true, driver: null });
    this.vehicles.push(sport);
  }
  spawnPeds() {
    const rng = mulberry32(99);
    const colors = [0xc23b2e, 0x2fa8a0, 0xc9a227, 0x7fb069, 0xb56576, 0x4a7ec2];
    for (let i = 0; i < 14; i++) {
      const mesh = makePedMesh(colors[i % colors.length]);
      this.scene.add(mesh);
      this.peds.push({
        mesh, x: rand(-190, 190), z: rand(-190, 190),
        heading: rng() * Math.PI * 2, speed: rand(1.2, 2.2),
        health: 100, dead: false, hostile: false, target: null,
        wx: rand(-190, 190), wz: rand(-190, 190), flee: 0,
      });
    }
  }
  spawnAttackers(x, z, count) {
    const made = [];
    for (let i = 0; i < count; i++) {
      const mesh = makePedMesh(0x8a1a1a);
      this.scene.add(mesh);
      const ped = {
        mesh, x: x + rand(-12, 12), z: z + rand(-12, 12),
        heading: 0, speed: 3.2, health: 60, dead: false, hostile: true,
        target: this.player, wx: x, wz: z, flee: 0, shootTimer: rand(0.5, 1.5),
      };
      this.peds.push(ped);
      this.attackers.push(ped);
      made.push(ped);
    }
    return made;
  }
  playerPos() {
    if (this.player.vehicle) return { x: this.player.vehicle.x, z: this.player.vehicle.z };
    return { x: this.player.x, z: this.player.z };
  }
  say(msg) { this.message = msg; this.messageTimer = 6; }
  addWanted(n, reason) {
    this.heat = clamp(this.heat + n * POLICE.heatPerCrime, 0, 100);
    void reason;
  }
  setWantedStars(stars) { this.heat = clamp(stars * 20, 0, 100); }
  addRespect(n, districtId) { this.crew.addRespect(n, districtId); }
  onKill(ped) {
    if (this.missions) this.missions.onKill(ped);
    if (ped.hostile) this.addWanted(0, 'self-defence');
  }
  onRaceFinished(id, won, time) {
    if (this.missions) this.missions.onRaceFinished(id, won, time);
  }
  // --- car theft: E near a car steals it; E in a car gets out.
  nearestVehicle(maxD) {
    const p = this.playerPos();
    let best = null; let bestD = maxD;
    for (const v of this.vehicles) {
      if (v.dead) continue;
      const d = dist2d(p.x, p.z, v.x, v.z);
      if (d < bestD) { best = v; bestD = d; }
    }
    return best;
  }
  enterVehicle(v) {
    if (!v) return false;
    if (v.driver === 'traffic') {
      // The driver bails and runs: carjacking, in the open.
      this.spawnFleeingDriver(v);
      v.driver = null;
      this.addWanted(1, 'carjacking');
      this.say('Carjacked! The driver ran — the cops noticed.');
    } else if (v.isPolice) {
      this.addWanted(1, 'stole a police car');
      this.say('You stole a police car. Bold.');
    } else if (v.parked) {
      this.addWanted(1, 'grand theft auto');
    }
    if (this.player.vehicle) this.player.vehicle.isPlayer = false;
    this.player.vehicle = v;
    this.player.onFoot = false;
    v.isPlayer = true;
    v.driver = 'player';
    v.parked = false;
    this.player.mesh.visible = false;
    this.audio.setEngine(0.2, true);
    return true;
  }
  spawnFleeingDriver(v) {
    const mesh = makePedMesh(0xe0a030);
    this.scene.add(mesh);
    const ped = {
      mesh, x: v.x + 2, z: v.z + 2, heading: 0, speed: 6, health: 100,
      dead: false, hostile: false, target: null,
      wx: v.x + rand(-60, 60), wz: v.z + rand(-60, 60), flee: 8,
    };
    this.peds.push(ped);
  }
  exitVehicle() {
    const v = this.player.vehicle;
    if (!v) return;
    v.isPlayer = false;
    v.driver = null;
    v.speed = 0;
    this.player.x = v.x + Math.sin(v.heading + Math.PI / 2) * 3;
    this.player.z = v.z + Math.cos(v.heading + Math.PI / 2) * 3;
    this.player.heading = v.heading;
    this.player.onFoot = true;
    this.player.vehicle = null;
    this.player.mesh.visible = true;
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.audio.setEngine(0, false);
  }
  // --- shooting (on foot only; mouse aim).
  shootAt(screenX, screenY, camera) {
    if (!this.player.onFoot) return;
    const result = this.weapons.fire(this.player.x, this.player.z, this.player.heading);
    if (!result) return;
    this.audio.shot(result.weapon.id);
    this.effects.muzzle(this.player.x + Math.sin(this.player.heading) * 1.5, 1.4, this.player.z + Math.cos(this.player.heading) * 1.5);
    for (const hit of result.hits) Weapons.applyDamage(this, hit);
    if (result.hits.length > 0) this.addWanted(1, 'fired weapon');
    void screenX; void screenY; void camera;
  }
  // --- collisions: circle vs building AABBs and the world edge.
  collideCircle(x, z, r) {
    let nx = x; let nz = z;
    for (const b of this.city.colliders) {
      const cx = clamp(nx, b.minX, b.maxX);
      const cz = clamp(nz, b.minZ, b.maxZ);
      const dx = nx - cx; const dz = nz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 < 0.0001) { nx = b.maxX + r; continue; }
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r;
        nz = cz + (dz / d) * r;
      }
    }
    const half = this.city.half + 8;
    nx = clamp(nx, -half, half);
    nz = clamp(nz, -half, half);
    return { x: nx, z: nz };
  }
  // --- police: spawn to match the wanted level, chase, ram, bust.
  updatePolice(dt) {
    const want = this.wanted;
    const targetCount = want === 0 ? 0 : Math.min(want + (want >= 5 ? 1 : 0), POLICE.maxCars);
    // Despawn extra cars when the heat drops.
    while (this.policeCars.length > targetCount) {
      const c = this.policeCars.pop();
      c.dispose(this.scene);
      const i = this.vehicles.indexOf(c);
      if (i >= 0) this.vehicles.splice(i, 1);
    }
    // Spawn a new car off-screen when under count.
    if (this.policeCars.length < targetCount) {
      const p = this.playerPos();
      const a = rand(0, Math.PI * 2);
      const def = want >= 5 && this.policeCars.length >= 4 ? CARS.find((c) => c.id === 'truck') : CARS.find((c) => c.id === 'sedan');
      const car = new Vehicle(this.scene, def, p.x + Math.sin(a) * POLICE.spawnDistance, p.z + Math.cos(a) * POLICE.spawnDistance, a, { police: true, driver: 'police' });
      car.isPolice = true;
      this.policeCars.push(car);
      this.vehicles.push(car);
    }
    // Chase the player; ram when close.
    const p = this.playerPos();
    for (const car of this.policeCars) {
      car.autopilot(dt, { x: p.x, z: p.z }, this.city.colliders, this.vehicles);
      const d = dist2d(car.x, car.z, p.x, p.z);
      if (d < 4.5) {
        if (this.player.vehicle) {
          if (this.player.vehicle.damage(14 * dt)) {
            this.effects.explosion(this.player.vehicle.x, 0, this.player.vehicle.z);
            this.exitVehicle();
            this.addWanted(1, 'vehicle destroyed');
          }
          this.effects.addShake(0.2);
        } else {
          this.bustedTimer += dt;
          if (this.bustedTimer > 2) this.getBusted();
        }
      } else {
        this.bustedTimer = Math.max(0, this.bustedTimer - dt);
      }
    }
    this.heli.update(dt, p.x, p.z, this.wanted);
    this.audio.setSiren(this.policeCars.length > 0);
  }
  getBusted() {
    this.bustedTimer = 0;
    this.heat = 0;
    this.wanted = 0;
    const fine = Math.min(this.money, 500);
    this.money -= fine;
    if (this.player.vehicle) this.exitVehicle();
    this.player.x = this.city.safehousePos.x;
    this.player.z = this.city.safehousePos.z;
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.say('BUSTED! The VCPD took ' + '$' + fine + ' and dropped you at the safehouse.');
    this.audio.crash();
  }
  updatePeds(dt) {
    const p = this.playerPos();
    for (const ped of this.peds) {
      if (ped.dead) { ped.mesh.visible = false; continue; }
      if (ped.hostile) {
        // Attackers close in and shoot at the player.
        const d = dist2d(ped.x, ped.z, p.x, p.z);
        const dir = Math.atan2(p.x - ped.x, p.z - ped.z);
        ped.heading = dir;
        if (d > 10) {
          ped.x += Math.sin(dir) * ped.speed * dt;
          ped.z += Math.cos(dir) * ped.speed * dt;
        } else {
          ped.shootTimer -= dt;
          if (ped.shootTimer <= 0) {
            ped.shootTimer = 1.6;
            this.effects.muzzle(ped.x, 1.4, ped.z);
            if (this.player.onFoot) {
              this.player.health -= 6;
              this.effects.blood(this.player.x, 1, this.player.z);
              if (this.player.health <= 0) this.getWasted();
            } else if (this.player.vehicle) {
              this.player.vehicle.damage(4);
            }
          }
        }
      } else if (ped.flee > 0) {
        ped.flee -= dt;
        ped.x += Math.sin(ped.heading) * ped.speed * dt;
        ped.z += Math.cos(ped.heading) * ped.speed * dt;
      } else {
        const d = dist2d(ped.x, ped.z, ped.wx, ped.wz);
        if (d < 3) { ped.wx = rand(-190, 190); ped.wz = rand(-190, 190); }
        const dir = Math.atan2(ped.wx - ped.x, ped.wz - ped.z);
        ped.heading += angleDiff(ped.heading, dir) * Math.min(1, dt * 3);
        ped.x += Math.sin(ped.heading) * ped.speed * dt;
        ped.z += Math.cos(ped.heading) * ped.speed * dt;
        // Flee from gunfire and speeding cars.
        const pd = dist2d(ped.x, ped.z, p.x, p.z);
        if (pd < 8 && this.player.vehicle && Math.abs(this.player.vehicle.speed) > 12) {
          ped.flee = 3;
          ped.heading = Math.atan2(ped.x - p.x, ped.z - p.z);
        }
      }
      const hit = this.collideCircle(ped.x, ped.z, 0.8);
      ped.x = hit.x; ped.z = hit.z;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
    }
    this.peds = this.peds.filter((ped) => !ped.dead || ped.hostile);
    this.attackers = this.attackers.filter((a) => !a.dead);
  }
  getWasted() {
    this.player.health = PLAYER.health;
    this.heat = 0;
    this.wanted = 0;
    if (this.player.vehicle) this.exitVehicle();
    this.player.x = this.city.safehousePos.x;
    this.player.z = this.city.safehousePos.z;
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.say('WASTED! You woke up at the safehouse. The city keeps moving.');
  }
  // --- objective beacon: a glowing pillar the player can see across the city.
  setObjective(x, z, label) {
    this.clearObjective();
    this.objective = { x, z, label };
    const geo = new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.position.set(x, 30, z);
    this.scene.add(this.beacon);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(7, 0.5, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe14d }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 0.3, z);
    this.scene.add(ring);
    this.beacon.userData.ring = ring;
  }
  clearObjective() {
    if (this.beacon) {
      this.scene.remove(this.beacon);
      this.scene.remove(this.beacon.userData.ring);
      this.beacon = null;
    }
    this.objective = null;
  }
  // --- main update, called once per frame by main.js.
  update(dt, input, camera) {
    // Clock.
    this.timeOfDay += (dt * 24) / WORLD.dayLengthSec;
    if (this.timeOfDay >= 24) { this.timeOfDay -= 24; this.day += 1; }
    const isNight = applyTimeOfDay(this.env, this.timeOfDay);
    this.city.updateNight(isNight);
    // Wanted decay (Dario makes the trail go cold faster).
    if (this.heat > 0) {
      this.heat = Math.max(0, this.heat - POLICE.heatDecayPerSec * this.crew.heatDecayMultiplier() * dt);
    }
    this.wanted = Math.min(5, Math.floor(this.heat / 20));
    // Player.
    if (this.player.onFoot) this.updateOnFoot(dt, input);
    else this.updateDriving(dt, input);
    // World.
    for (const v of this.vehicles) {
      if (v.driver === 'traffic' && !v.dead) v.autopilot(dt, null, this.city.colliders, this.vehicles);
      else if (v.driver === 'police' && !v.dead) { /* driven in updatePolice */ }
      if (!v.dead) {
        const hit = this.collideCircle(v.x, v.z, 2.2);
        v.x = hit.x; v.z = hit.z;
        v.syncMesh();
      }
      if (v.isPolice && v.mesh.userData.lightBar) {
        v.mesh.userData.lightBar.material.color.setHex(Math.floor(performance.now() / 300) % 2 ? 0xff2222 : 0x2244ff);
      }
    }
    this.updatePolice(dt);
    this.updatePeds(dt);
    if (this.race) this.race.update(dt);
    if (this.missions) this.missions.update(dt);
    this.weapons.update(dt);
    this.effects.update(dt);
    // Engine audio follows the player's car.
    const v = this.player.vehicle;
    this.audio.setEngine(v ? Math.abs(v.speed) / v.topSpeed() : 0, !!v);
    if (this.messageTimer > 0) this.messageTimer -= dt;
    // Camera.
    const pp = this.playerPos();
    const heading = this.player.vehicle ? this.player.vehicle.heading : this.player.heading;
    updateChaseCamera(camera, { x: pp.x, y: 0, z: pp.z }, heading, v ? Math.abs(v.speed) : this.player.speed, dt);
    this.effects.applyShake(camera);
  }
  updateOnFoot(dt, input) {
    const mv = input.moveVec();
    const run = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const camYaw = this.cameraYaw;
    const wx = mv.x * Math.cos(camYaw) - mv.z * Math.sin(camYaw);
    const wz = mv.x * Math.sin(camYaw) + mv.z * Math.cos(camYaw);
    const moving = mv.x !== 0 || mv.z !== 0;
    this.player.moving = moving;
    if (moving) {
      const targetHeading = Math.atan2(wx, wz);
      this.player.heading += angleDiff(this.player.heading, targetHeading) * Math.min(1, dt * 10);
      this.player.speed = speed;
      const nx = this.player.x + wx * speed * dt;
      const nz = this.player.z + wz * speed * dt;
      const hit = this.collideCircle(nx, nz, 0.9);
      this.player.x = hit.x; this.player.z = hit.z;
      this.cameraYaw = this.player.heading;
    } else {
      this.player.speed = 0;
    }
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.player.mesh.rotation.y = this.player.heading;
    // Walk bob.
    this.player.mesh.position.y = moving ? Math.abs(Math.sin(performance.now() / 90)) * 0.08 : 0;
  }
  updateDriving(dt, input) {
    const v = this.player.vehicle;
    if (!v) return;
    const nosBoost = (input.down('ShiftLeft') || input.down('ShiftRight')) && v.nosInstalled;
    const before = v.nos;
    v.drive(dt, input.throttle(), input.steer(), nosBoost, 6 * this.crew.nosRefillMultiplier());
    const hit = this.collideCircle(v.x, v.z, 2.2);
    if (hit.x !== v.x || hit.z !== v.z) {
      // Scraped a building: lose speed, spark, shake.
      if (Math.abs(v.speed) > 8) {
        this.effects.burst(v.x, 0.8, v.z, 0xffd23c, 8, 5, 0.4, 2);
        this.effects.addShake(0.25);
        this.audio.crash();
        v.damage(3);
      }
      v.speed *= 0.4;
      v.x = hit.x; v.z = hit.z;
    }
    if (nosBoost && v.nos < before && Math.abs(v.speed) > 10) {
      this.effects.nosFlame(v.x, 0, v.z, v.heading);
    }
    if (Math.abs(v.speed) > 20 && Math.random() < dt * 4) {
      this.effects.dust(v.x, 0, v.z);
    }
    this.cameraYaw = v.heading;
    v.syncMesh();
  }
}
