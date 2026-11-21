// Garage: buy cars, upgrade engine/armor/NOS, spawn owned cars.
// The UI is a DOM overlay built by main.js; this module owns the rules.
import { CARS, GARAGE_POS } from './config.js';
import { fmtMoney } from './util.js';
import { makeCar } from './vehicles.js';
import { sfx } from './audio.js';
import { respectDiscount } from './sim.js';

export function garageState(G) {
  const disc = respectDiscount(G);
  return CARS.map((c) => {
    const owned = G.garage.owned.includes(c.id);
    const up = G.garage.upgrades[c.id] || { engine: 0, armor: 0, nos: 0 };
    const price = Math.round(c.price * (1 - disc));
    return { ...c, owned, upgrades: up, price, discount: disc };
  });
}

export function buyCar(G, id) {
  const c = CARS.find((x) => x.id === id);
  if (!c || G.garage.owned.includes(id)) return false;
  const price = Math.round(c.price * (1 - respectDiscount(G)));
  if (G.money < price) return false;
  G.money -= price;
  G.garage.owned.push(id);
  G.garage.upgrades[id] = { engine: 0, armor: 0, nos: 0 };
  sfx('cash');
  return true;
}

export function upgradeCar(G, id, part) {
  const up = G.garage.upgrades[id];
  if (!up || up[part] >= 3) return false;
  const cost = 1500 * (up[part] + 1);
  if (G.money < cost) return false;
  G.money -= cost;
  up[part]++;
  sfx('cash');
  return true;
}

// Spawn an owned car next to the garage and put the player in it.
export function takeCarOut(G, id) {
  const c = CARS.find((x) => x.id === id);
  if (!c || !G.garage.owned.includes(id)) return null;
  const up = G.garage.upgrades[id] || { engine: 0, armor: 0, nos: 0 };
  const car = makeCar(id, GARAGE_POS.x + 60, GARAGE_POS.y + 40, 0, 'player');
  car.upgrades = { ...up };
  car.hp = 100 + up.armor * 40;
  G.cars.push(car);
  enterCar(G, car);
  sfx('door');
  return car;
}

export function enterCar(G, car) {
  if (G.player.car) G.player.car.kind = 'parked';
  G.player.car = car;
  car.kind = 'player';
  G.player.onFoot = false;
  G.player.x = car.x; G.player.y = car.y;
}

export function exitCar(G) {
  const car = G.player.car;
  if (!car) return;
  car.kind = 'parked';
  car.speed = 0;
  G.player.car = null;
  G.player.onFoot = true;
  G.player.x = car.x + 40;
  G.player.y = car.y + 40;
  sfx('door');
}

// Nearest stealable car within reach (parked or traffic, not police/player).
export function nearestStealable(G) {
  let best = null, bestD = 70;
  for (const c of G.cars) {
    if (c.kind !== 'parked' && c.kind !== 'traffic') continue;
    const d = Math.hypot(c.x - G.player.x, c.y - G.player.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function garageHtml(G) {
  const rows = garageState(G).map((c) => {
    const up = c.upgrades;
    const upBtn = (part, label) => c.owned
      ? `<button data-up="${c.id}:${part}" ${up[part] >= 3 ? 'disabled' : ''}>${label} Lv${up[part]} ${up[part] >= 3 ? 'MAX' : '$' + (1500 * (up[part] + 1))}</button>`
      : '';
    return `<div class="car-row">
      <div class="car-swatch" style="background:${c.color}"></div>
      <div class="car-info"><b>${c.name}</b><span>Top ${c.top} • Accel ${c.accel} • Grip ${c.grip}</span></div>
      <div class="car-actions">
        ${c.owned
          ? `<button data-take="${c.id}">TAKE OUT</button>${upBtn('engine', 'ENGINE')}${upBtn('armor', 'ARMOR')}${upBtn('nos', 'NOS')}`
          : `<button data-buy="${c.id}">${fmtMoney(c.price)} BUY</button>`}
      </div></div>`;
  }).join('');
  const disc = respectDiscount(G);
  return `<h2>VERDE BAY GARAGE</h2>
    <p class="sub">Money: <b>${fmtMoney(G.money)}</b>${disc > 0 ? ` • Respect discount ${Math.round(disc * 100)}%` : ''}</p>
    ${rows}
    <p class="hint">Upgrades stack to Lv3. Engine raises top speed, armor raises HP, NOS refills faster.</p>
    <button class="close" data-close-garage>CLOSE [G]</button>`;
}
