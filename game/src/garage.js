// VERDE BAY v9 — the Verde Garage: buy cars, tune them, and keep them. The
// garage is a real place in the world (the yellow workshop at -40, 140) with
// a shop panel; everything bought here persists in the save file.
import { CARS, GARAGE_UPGRADES } from './config.js';
import { formatMoney } from './util.js';

export class Garage {
  constructor(sim) {
    this.sim = sim;
    this.ownedCars = ['hatch']; // car ids the player owns
    this.activeCarId = 'hatch';
    this.upgrades = {}; // carId -> { engine, armor, nos, paint, neon }
    this.open = false;
    this.selectedCar = 'hatch';
  }
  state() {
    return {
      ownedCars: [...this.ownedCars],
      activeCarId: this.activeCarId,
      upgrades: JSON.parse(JSON.stringify(this.upgrades)),
    };
  }
  loadState(s) {
    if (!s) return;
    this.ownedCars = s.ownedCars || ['hatch'];
    this.activeCarId = s.activeCarId || 'hatch';
    this.upgrades = s.upgrades || {};
  }
  carDef(id) { return CARS.find((c) => c.id === id); }
  upgradesFor(carId) { return this.upgrades[carId] || { engine: 0, armor: 0, nos: 0, paint: null, neon: false }; }
  // What the shop panel shows: every car, owned or priced, and every upgrade.
  catalog() {
    const sim = this.sim;
    return {
      money: sim.money,
      cars: CARS.map((c) => ({
        id: c.id, name: c.name, price: c.price,
        owned: this.ownedCars.includes(c.id),
        active: this.activeCarId === c.id,
        topSpeed: c.topSpeed, accel: c.accel,
      })),
      upgrades: GARAGE_UPGRADES.map((u) => ({
        ...u,
        owned: this.hasUpgrade(this.selectedCar, u),
        locked: !!u.needsRespect && sim.respect < u.needsRespect,
      })),
    };
  }
  hasUpgrade(carId, up) {
    const u = this.upgradesFor(carId);
    if (up.key === 'engine') return u.engine >= up.level;
    if (up.key === 'armor') return u.armor >= up.level;
    if (up.key === 'nos') return u.nos >= up.level;
    if (up.key === 'paint') return u.paint === 'gold';
    if (up.key === 'neon') return !!u.neon;
    return false;
  }
  buyCar(id) {
    const def = this.carDef(id);
    if (!def) return { ok: false, reason: 'No such car' };
    if (this.ownedCars.includes(id)) return { ok: false, reason: 'Already owned' };
    if (this.sim.money < def.price) return { ok: false, reason: 'Need ' + formatMoney(def.price) };
    this.sim.money -= def.price;
    this.ownedCars.push(id);
    this.activeCarId = id;
    this.sim.audio.fanfare();
    return { ok: true, message: def.name + ' is yours. It is parked outside the garage.' };
  }
  buyUpgrade(upId) {
    const up = GARAGE_UPGRADES.find((u) => u.id === upId);
    if (!up) return { ok: false, reason: 'No such upgrade' };
    const carId = this.selectedCar;
    if (this.hasUpgrade(carId, up)) return { ok: false, reason: 'Already fitted' };
    if (up.needsRespect && this.sim.respect < up.needsRespect) {
      return { ok: false, reason: 'Needs ' + up.needsRespect + ' respect' };
    }
    if (this.sim.money < up.price) return { ok: false, reason: 'Need ' + formatMoney(up.price) };
    this.sim.money -= up.price;
    const u = this.upgradesFor(carId);
    if (up.key === 'engine') u.engine = up.level;
    if (up.key === 'armor') u.armor = up.level;
    if (up.key === 'nos') u.nos = up.level;
    if (up.key === 'paint') u.paint = 'gold';
    if (up.key === 'neon') u.neon = true;
    this.upgrades[carId] = u;
    return { ok: true, message: up.name + ' fitted to ' + this.carDef(carId).name };
  }
  selectCar(id) {
    if (!this.ownedCars.includes(id)) return false;
    this.activeCarId = id;
    this.selectedCar = id;
    return true;
  }
  // Spawn the player's active car outside the garage door.
  spawnActiveCar(scene, Vehicle) {
    const def = this.carDef(this.activeCarId);
    const u = this.upgradesFor(this.activeCarId);
    const car = new Vehicle(scene, def, -40, 122, Math.PI, {
      engine: u.engine, armor: u.armor > 0, nosKit: u.nos > 0 || def.kind === 'sport',
      neon: u.neon, color: u.paint === 'gold' ? 0xd4af37 : def.color,
    });
    car.isPlayer = true;
    car.driver = 'player';
    return car;
  }
}
