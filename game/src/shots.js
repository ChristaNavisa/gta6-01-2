// VERDE BAY v9 — screenshot scenes: the `?shot=` query parameter poses the
// game for the entry's screenshots (and for the maker's own play-tests).
//   ?shot=start   title screen over the city at dawn
//   ?shot=drive   the player driving a Vesper GT down the marina road
//   ?shot=chase   a 3-star chase with police cars and the minimap lit up
//   ?shot=garage  the Verde Garage shop panel open, player on foot outside
// Each scene is the real game, not a mock: the same code path a player takes.
export function shotKind() {
  const q = new URLSearchParams(window.location.search);
  return q.get('shot') || null;
}

export function applyShot(sim, hud, kind) {
  if (!kind) return false;
  const startGame = () => {
    hud.hideStart();
    sim.audio.init();
    sim.audio.resume();
  };
  if (kind === 'start') {
    sim.timeOfDay = 7.2; // dawn light over the bay
    return true;
  }
  if (kind === 'drive') {
    startGame();
    sim.timeOfDay = 10.5;
    const car = sim.garage.spawnActiveCar(sim.scene, sim.vehicleClass);
    // On the x=-180 road, heading +Z: a long clear run down the marina road
    // with the towers on both sides, not into a building.
    car.x = -180; car.z = -170;
    car.heading = 0;
    sim.vehicles.push(car);
    sim.enterVehicle(car);
    car.speed = 18;
    sim.say('Verde Bay — 12 missions, a garage, races and a crew. Drive!');
    return true;
  }
  if (kind === 'chase') {
    startGame();
    sim.timeOfDay = 16.5;
    const car = sim.garage.spawnActiveCar(sim.scene, sim.vehicleClass);
    car.x = 0; car.z = -60;
    car.heading = 0;
    sim.vehicles.push(car);
    sim.enterVehicle(car);
    car.speed = 22;
    sim.setWantedStars(3);
    sim.say('3 stars — the VCPD is on you. NOS is Shift.');
    return true;
  }
  if (kind === 'garage') {
    startGame();
    sim.timeOfDay = 12.0;
    sim.money = 12500;
    sim.player.x = -40;
    sim.player.z = 118;
    sim.player.mesh.position.set(-40, 0, 118);
    sim.player.heading = Math.PI;
    sim.garage.open = true;
    hud.openGarage();
    sim.say('Verde Garage — buy cars, tune them, keep them.');
    return true;
  }
  if (kind === 'mission') {
    startGame();
    sim.missions.start();
    return true;
  }
  return false;
}
