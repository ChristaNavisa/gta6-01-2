// VERDE BAY v9 — the HUD: wanted stars, money, respect, health, speed, NOS
// meter, weapon wheel, mission banner, garage panel, and the live canvas
// minimap (player, police, mission marker, garage, shops, race rings).
import { formatMoney, formatTime, clamp } from './util.js';

export class HUD {
  constructor(sim) {
    this.sim = sim;
    this.el = {};
    const ids = ['hud', 'stars', 'money', 'respect', 'health', 'speed', 'nos-fill',
      'weapon', 'mission', 'message', 'minimap', 'wheel', 'garage', 'menu',
      'objective', 'clock', 'district', 'race', 'start-screen', 'game-title'];
    for (const id of ids) this.el[id] = document.getElementById(id);
    this.minimap = this.el.minimap;
    this.mm = this.minimap ? this.minimap.getContext('2d') : null;
    this.wheelVisible = false;
  }
  showStart() {
    if (this.el['start-screen']) this.el['start-screen'].style.display = 'flex';
    if (this.el.hud) this.el.hud.style.display = 'none';
  }
  hideStart() {
    if (this.el['start-screen']) this.el['start-screen'].style.display = 'none';
    if (this.el.hud) this.el.hud.style.display = 'block';
  }
  update() {
    const sim = this.sim;
    const p = sim.player;
    if (this.el.stars) {
      let stars = '';
      for (let i = 0; i < 5; i++) stars += i < sim.wanted ? '★' : '☆';
      this.el.stars.textContent = stars;
      this.el.stars.className = 'stars' + (sim.wanted >= 3 ? ' hot' : '');
    }
    if (this.el.money) this.el.money.textContent = formatMoney(sim.money);
    if (this.el.respect) this.el.respect.textContent = 'RESPECT ' + sim.respect + '/100';
    if (this.el.health) this.el.health.textContent = 'HP ' + Math.max(0, Math.round(p.health));
    if (this.el.speed) {
      const v = p.vehicle;
      this.el.speed.textContent = v ? Math.round(Math.abs(v.speed) * 3.6) + ' km/h' : (p.moving ? 'ON FOOT' : '');
    }
    if (this.el['nos-fill'] && p.vehicle) {
      const v = p.vehicle;
      this.el['nos-fill'].style.width = (v.nos / v.nosMax * 100) + '%';
      this.el['nos-fill'].style.background = v.nosInstalled ? '#39d5ff' : '#555';
    }
    if (this.el.weapon) this.el.weapon.textContent = sim.weapons.hudLine();
    if (this.el.mission) this.el.mission.textContent = sim.missions ? sim.missions.statusLine() : '';
    if (this.el.message) {
      this.el.message.textContent = sim.messageTimer > 0 ? sim.message : '';
    }
    if (this.el.clock) {
      const h = Math.floor(sim.timeOfDay);
      const m = Math.floor((sim.timeOfDay - h) * 60);
      this.el.clock.textContent = 'DAY ' + sim.day + '  ' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }
    if (this.el.district) {
      const d = sim.crew.districtName(sim.playerPos().x, sim.playerPos().z);
      this.el.district.textContent = d.name.toUpperCase();
    }
    if (this.el.objective) {
      const o = sim.objective;
      if (o) {
        const pp = sim.playerPos();
        const d = Math.round(Math.hypot(pp.x - o.x, pp.z - o.z));
        this.el.objective.textContent = '◆ ' + o.label + ' — ' + d + 'm';
      } else this.el.objective.textContent = '';
    }
    if (this.el.race) {
      const line = sim.race && sim.race.active ? sim.race.hudLine() : null;
      this.el.race.textContent = line ? line.label + '  ' + line.time : '';
    }
    this.drawMinimap();
    if (this.wheelVisible) this.renderWheel();
  }
  drawMinimap() {
    if (!this.mm) return;
    const sim = this.sim;
    const S = 168;
    const half = sim.city.half + 10;
    const toMap = (x, z) => [((x + half) / (half * 2)) * S, ((z + half) / (half * 2)) * S];
    const g = this.mm;
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#0d1b26';
    g.fillRect(0, 0, S, S);
    // Water + land.
    g.fillStyle = '#2f7fb8';
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#3a3f46';
    const [lx, ly] = toMap(-210, -210);
    g.fillRect(lx, ly, S - 2 * lx, S - 2 * ly);
    // Roads.
    g.strokeStyle = '#5a6068';
    g.lineWidth = 2;
    for (const line of sim.city.roadLines) {
      const [x1, y1] = toMap(line, -210);
      const [x2, y2] = toMap(line, 210);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      const [x3, y3] = toMap(-210, line);
      const [x4, y4] = toMap(210, line);
      g.beginPath(); g.moveTo(x3, y3); g.lineTo(x4, y4); g.stroke();
    }
    // Garage (green wrench square), shops (white dots).
    const [gx, gy] = toMap(sim.city.garagePos.x, sim.city.garagePos.z);
    g.fillStyle = '#39d353';
    g.fillRect(gx - 4, gy - 4, 8, 8);
    g.fillStyle = '#ffffff';
    for (const [sx, sz] of sim.city.shopPositions) {
      const [mx, my] = toMap(sx, sz);
      g.fillRect(mx - 2, my - 2, 4, 4);
    }
    // Race checkpoints.
    if (sim.race && sim.race.active) {
      g.fillStyle = '#ffe14d';
      sim.race.checkpoints.forEach((cp, i) => {
        const [mx, my] = toMap(cp.x, cp.z);
        g.beginPath(); g.arc(mx, my, i === sim.race.index ? 5 : 3, 0, Math.PI * 2); g.fill();
      });
    }
    // Mission objective (yellow diamond).
    if (sim.objective) {
      const [mx, my] = toMap(sim.objective.x, sim.objective.z);
      g.fillStyle = '#ffe14d';
      g.save();
      g.translate(mx, my); g.rotate(Math.PI / 4);
      g.fillRect(-4, -4, 8, 8);
      g.restore();
    }
    // Police (red dots).
    g.fillStyle = '#ff3b30';
    for (const car of sim.policeCars) {
      const [mx, my] = toMap(car.x, car.z);
      g.beginPath(); g.arc(mx, my, 3.5, 0, Math.PI * 2); g.fill();
    }
    // Player (white arrow, rotated to heading).
    const pp = sim.playerPos();
    const [px, py] = toMap(pp.x, pp.z);
    const heading = sim.player.vehicle ? sim.player.vehicle.heading : sim.player.heading;
    g.save();
    g.translate(px, py);
    g.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)));
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(-5, 5); g.closePath(); g.fill();
    g.restore();
    // North tick.
    g.fillStyle = '#ffffff';
    g.font = 'bold 10px monospace';
    g.fillText('N', S / 2 - 3, 11);
  }
  openWheel() {
    this.wheelVisible = true;
    if (this.el.wheel) this.el.wheel.style.display = 'block';
    this.renderWheel();
  }
  closeWheel() {
    this.wheelVisible = false;
    if (this.el.wheel) this.el.wheel.style.display = 'none';
  }
  renderWheel() {
    const items = this.sim.weapons.wheelItems();
    if (!this.el.wheel) return;
    this.el.wheel.innerHTML = '<div class="wheel-title">WEAPONS — 1-5 or click</div>' +
      items.map((w) => '<div class="wheel-item' + (w.selected ? ' sel' : '') + (w.owned ? '' : ' locked') + '" data-slot="' + w.slot + '">' +
        w.slot + ' · ' + w.name + ' · ' + (w.owned ? w.ammo + ' ammo' : 'LOCKED') + '</div>').join('');
    this.el.wheel.querySelectorAll('.wheel-item').forEach((node) => {
      node.addEventListener('click', () => {
        this.sim.weapons.select(Number(node.dataset.slot) - 1);
        this.closeWheel();
      });
    });
  }
  openGarage() {
    const sim = this.sim;
    const cat = sim.garage.catalog();
    const panel = this.el.garage;
    if (!panel) return;
    const disc = sim.crew.shopDiscount();
    panel.innerHTML = '<h2>VERDE GARAGE</h2><div class="garage-money">' + formatMoney(cat.money) +
      (disc ? ' · 10% respect discount' : '') + '</div>' +
      '<h3>Cars</h3>' + cat.cars.map((c) => '<div class="shop-row"><span>' + c.name + ' · ' + Math.round(c.topSpeed * 3.6) + ' km/h</span>' +
        (c.owned
          ? '<button data-car="' + c.id + '">' + (c.active ? 'ACTIVE' : 'SELECT') + '</button>'
          : '<button data-car="' + c.id + '">' + formatMoney(c.price * (1 - disc)) + '</button>') + '</div>').join('') +
      '<h3>Upgrades — ' + sim.garage.carDef(sim.garage.selectedCar).name + '</h3>' + cat.upgrades.map((u) => '<div class="shop-row"><span>' + u.name + ' · ' + u.effect + '</span>' +
        '<button data-up="' + u.id + '"' + (u.owned || u.locked ? ' disabled' : '') + '>' +
        (u.owned ? 'FITTED' : u.locked ? 'NEEDS RESPECT' : formatMoney(u.price)) + '</button></div>').join('') +
      '<div class="shop-row"><button id="garage-close">LEAVE (E)</button><button id="garage-spawn">TAKE CAR OUT</button></div>';
    panel.style.display = 'block';
    panel.querySelectorAll('[data-car]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.car;
      const res = sim.garage.ownedCars.includes(id) ? (sim.garage.selectCar(id), { ok: true, message: 'Selected ' + sim.garage.carDef(id).name }) : sim.garage.buyCar(id);
      sim.say(res.message || res.reason);
      this.openGarage();
    }));
    panel.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => {
      const res = sim.garage.buyUpgrade(b.dataset.up);
      sim.say(res.message || res.reason);
      this.openGarage();
    }));
    const close = panel.querySelector('#garage-close');
    if (close) close.addEventListener('click', () => this.closeGarage());
    const spawn = panel.querySelector('#garage-spawn');
    if (spawn) spawn.addEventListener('click', () => {
      this.closeGarage();
      const car = sim.garage.spawnActiveCar(sim.scene, sim.vehicleClass);
      sim.vehicles.push(car);
      sim.enterVehicle(car);
    });
  }
  closeGarage() {
    if (this.el.garage) this.el.garage.style.display = 'none';
    this.sim.garage.open = false;
  }
  static clamp01(v) { return clamp(v, 0, 1); }
  static formatClock(t) { return formatTime(t); }
}
