// VERDE BAY — game configuration: world, districts, cars, weapons, missions, businesses.
// All numbers are tuned for a 3600x3600 top-down city. No imports here.

export const WORLD = { w: 3600, h: 3600, roadGap: 300, roadWidth: 72 };

export const DISTRICTS = [
  { id: 'downtown', name: 'Downtown Verde', x: 0, y: 0, w: 1200, h: 1800, base: '#3d4b63', accent: '#ffd166' },
  { id: 'marina', name: 'Marina Bay', x: 1200, y: 0, w: 1200, h: 1800, base: '#2e5f6e', accent: '#7fd1ff' },
  { id: 'northhills', name: 'North Hills', x: 2400, y: 0, w: 1200, h: 1800, base: '#4a5d3a', accent: '#b8e986' },
  { id: 'oldtown', name: 'Old Town', x: 0, y: 1800, w: 1200, h: 1800, base: '#6e5233', accent: '#ffb347' },
  { id: 'portside', name: 'Portside', x: 1200, y: 1800, w: 1200, h: 1800, base: '#5b4a68', accent: '#c792ea' },
  { id: 'beach', name: 'Sunset Beach', x: 2400, y: 1800, w: 1200, h: 1800, base: '#8a6d4b', accent: '#ff8fa3' },
];

// Six garage cars. price 0 = starter car already owned.
export const CARS = [
  { id: 'sedan', name: 'Verde Sedan', price: 0, top: 330, accel: 240, grip: 2.6, color: '#e74c3c', len: 44, wid: 22 },
  { id: 'taxi', name: 'Bay Taxi', price: 1200, top: 310, accel: 220, grip: 2.5, color: '#f1c40f', len: 44, wid: 22 },
  { id: 'coupe', name: 'Marina Coupe', price: 4500, top: 420, accel: 320, grip: 3.1, color: '#3498db', len: 46, wid: 21 },
  { id: 'muscle', name: 'Old Town Muscle', price: 9000, top: 460, accel: 380, grip: 2.7, color: '#9b59b6', len: 48, wid: 23 },
  { id: 'sport', name: 'Sunset GT', price: 18000, top: 540, accel: 460, grip: 3.6, color: '#e67e22', len: 46, wid: 21 },
  { id: 'hyper', name: 'Verde V12', price: 40000, top: 640, accel: 560, grip: 4.0, color: '#1abc9c', len: 48, wid: 20 },
];

export const WEAPONS = [
  { id: 'fists', name: 'Fists', price: 0, ammoPrice: 0, dmg: 12, rate: 0.35, range: 46, spread: 0, speed: 0, auto: false, color: '#f5d0a9' },
  { id: 'pistol', name: 'P9 Pistol', price: 500, ammoPrice: 40, dmg: 22, rate: 0.28, range: 420, spread: 0.03, speed: 900, auto: false, color: '#d7dee8' },
  { id: 'smg', name: 'VB SMG', price: 1800, ammoPrice: 90, dmg: 14, rate: 0.09, range: 380, spread: 0.09, speed: 950, auto: true, color: '#95a5a6' },
  { id: 'shotgun', name: 'Street Sweeper', price: 3200, ammoPrice: 120, dmg: 16, rate: 0.7, range: 300, spread: 0.22, speed: 800, auto: false, pellets: 6, color: '#8d6e63' },
  { id: 'rifle', name: 'Longshot Rifle', price: 6500, ammoPrice: 160, dmg: 55, rate: 0.55, range: 640, spread: 0.008, speed: 1400, auto: false, color: '#5d6d7e' },
];

// Businesses that pay out over time once bought.
export const BUSINESSES = [
  { id: 'laundromat', name: 'Old Town Laundromat', price: 6000, income: 45, x: 420, y: 2340, desc: 'Quiet cash, every minute.' },
  { id: 'motel', name: 'Sunset Motel', price: 15000, income: 120, x: 2760, y: 2520, desc: 'Rooms by the hour, money by the minute.' },
  { id: 'club', name: 'Marina Club Nova', price: 30000, income: 260, x: 1560, y: 420, desc: 'The hottest door in Verde Bay.' },
];

export const GARAGE_POS = { x: 660, y: 660 };
export const GUNSTORE_POS = { x: 2340, y: 660 };
export const HOSPITAL_POS = { x: 660, y: 2340 };

// Twelve story missions. Steps are data: the interpreter in missions.js runs them.
export const MISSIONS = [
  { id: 'm1', title: 'Welcome to Verde Bay', briefing: 'Mara needs a driver. Get to the Marina and pick her up.', payout: 800, steps: [
    { type: 'goto', x: 1560, y: 420, label: 'Meet Mara at the Marina' } ] },
  { id: 'm2', title: 'First Wheels', briefing: 'The crew needs a ride. Steal the parked coupe on Coral Ave.', payout: 1200, steps: [
    { type: 'carjack', x: 1860, y: 960, label: 'Steal the coupe' },
    { type: 'drive', x: 660, y: 660, label: 'Bring it to the garage' } ] },
  { id: 'm3', title: 'Package Run', briefing: 'Three drops across town. Stay off the cops radar.', payout: 1500, steps: [
    { type: 'collect', x: 420, y: 420, label: 'Pick up the package' },
    { type: 'goto', x: 2940, y: 420, label: 'Drop 1: North Hills' },
    { type: 'goto', x: 2940, y: 2940, label: 'Drop 2: Sunset Beach' },
    { type: 'goto', x: 660, y: 660, label: 'Drop 3: the garage' } ] },
  { id: 'm4', title: 'Mara Joins', briefing: 'Rival runners are leaning on Mara. Clear them out, then bring her home.', payout: 2000, steps: [
    { type: 'kill', x: 1560, y: 420, label: 'Deal with the runners', count: 3 },
    { type: 'goto', x: 660, y: 660, label: 'Take Mara to the garage' } ] },
  { id: 'm5', title: 'Portside Heat', briefing: 'A shipment is coming in at the docks. Grab it before the other crew does.', payout: 2500, steps: [
    { type: 'collect', x: 1740, y: 2340, label: 'Grab the shipment' },
    { type: 'drive', x: 660, y: 660, label: 'Lose the heat, get to the garage' } ] },
  { id: 'm6', title: 'Midnight Race', briefing: 'Beat the street race: 6 checkpoints, fastest time wins the pot.', payout: 3500, steps: [
    { type: 'race', label: 'Win the street race' } ] },
  { id: 'm7', title: 'Dario Joins', briefing: 'Dario is pinned down in Old Town. Fight through and get him out.', payout: 3000, steps: [
    { type: 'kill', x: 420, y: 2340, label: 'Clear the ambush', count: 4 },
    { type: 'goto', x: 660, y: 660, label: 'Bring Dario to the garage' } ] },
  { id: 'm8', title: 'Beachfront Business', briefing: 'Buy the Sunset Motel, then collect its first payout.', payout: 4000, steps: [
    { type: 'business', x: 2760, y: 2520, label: 'Buy the Sunset Motel' },
    { type: 'collect', x: 2760, y: 2520, label: 'Collect the first payout' } ] },
  { id: 'm9', title: 'Taxi King', briefing: 'The city runs on fares. Complete 2 taxi rides for the crew.', payout: 2200, steps: [
    { type: 'taxi', label: 'Complete 2 taxi fares', count: 2 } ] },
  { id: 'm10', title: 'Five Star Night', briefing: 'The whole city is watching. Survive 60 seconds at 4 stars.', payout: 5000, steps: [
    { type: 'survive', label: 'Survive the heat', seconds: 60 } ] },
  { id: 'm11', title: 'The Big Score', briefing: 'Hit the Portside vault. Grab the cash and vanish.', payout: 8000, steps: [
    { type: 'collect', x: 1740, y: 2340, label: 'Grab the vault cash' },
    { type: 'drive', x: 2760, y: 2520, label: 'Escape to the Sunset Motel' } ] },
  { id: 'm12', title: 'King of Verde Bay', briefing: 'One last race, one last fight. Win the grand race and own this city.', payout: 12000, steps: [
    { type: 'race', label: 'Win the grand race' },
    { type: 'kill', x: 1560, y: 420, label: 'Settle it with the rival crew', count: 5 } ] },
];

export const RACE_POINTS = [
  { x: 660, y: 660 }, { x: 1860, y: 360 }, { x: 3060, y: 960 },
  { x: 3060, y: 2760 }, { x: 1560, y: 3060 }, { x: 360, y: 2160 },
];

export const TIPS = [
  'WASD to move / drive. E to enter or steal a car. Q weapon wheel. Shift NOS boost.',
  'Stealing a car in front of police raises your wanted level.',
  'Press G near the garage to buy and upgrade cars. Press B near a business to buy it.',
  'Taxi fares pay fast cash: look for the yellow passenger marker.',
  'Stunt ramps give air-time bonuses. Respect unlocks crew help and discounts.',
  'Press R to change the radio station. Press M to mute.',
  'Ammo is sold at the gun store in North Hills. Health refills at the hospital.',
  'Your businesses pay out every minute. Collect often.',
];
