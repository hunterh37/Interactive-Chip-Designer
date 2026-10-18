import * as THREE from 'three';

export const R = 1; // globe radius in scene units

/** Data center hubs used to name a dropped pin ("near Ashburn, VA"). */
const HUBS = [
  ['Ashburn, VA', 39.04, -77.49], ['Dallas, TX', 32.78, -96.8], ['Phoenix, AZ', 33.45, -112.07], ['Santa Clara, CA', 37.35, -121.95],
  ['Hillsboro, OR', 45.52, -122.99], ['Chicago, IL', 41.88, -87.63], ['Atlanta, GA', 33.75, -84.39], ['New York, NY', 40.71, -74.0],
  ['Quincy, WA', 47.23, -119.85], ['Reno, NV', 39.53, -119.81], ['Salt Lake City, UT', 40.76, -111.89], ['Columbus, OH', 39.96, -83.0],
  ['Des Moines, IA', 41.59, -93.62], ['Abilene, TX', 32.45, -99.73], ['Toronto', 43.65, -79.38], ['Montreal', 45.5, -73.57],
  ['Mexico City', 19.43, -99.13], ['Querétaro', 20.59, -100.39], ['São Paulo', -23.55, -46.63], ['Santiago', -33.45, -70.67],
  ['Bogotá', 4.71, -74.07], ['Dublin', 53.35, -6.26], ['London', 51.51, -0.13], ['Amsterdam', 52.37, 4.9], ['Frankfurt', 50.11, 8.68],
  ['Paris', 48.86, 2.35], ['Madrid', 40.42, -3.7], ['Milan', 45.46, 9.19], ['Stockholm', 59.33, 18.07], ['Luleå', 65.58, 22.15],
  ['Oslo', 59.91, 10.75], ['Helsinki', 60.17, 24.94], ['Reykjavik', 64.15, -21.94], ['Warsaw', 52.23, 21.01], ['Zurich', 47.38, 8.54],
  ['Dubai', 25.2, 55.27], ['Riyadh', 24.71, 46.68], ['Tel Aviv', 32.09, 34.78], ['Johannesburg', -26.2, 28.05], ['Lagos', 6.52, 3.38],
  ['Nairobi', -1.29, 36.82], ['Cairo', 30.04, 31.24], ['Mumbai', 19.08, 72.88], ['Chennai', 13.08, 80.27], ['Singapore', 1.35, 103.82],
  ['Johor', 1.49, 103.74], ['Jakarta', -6.2, 106.85], ['Hong Kong', 22.32, 114.17], ['Tokyo', 35.68, 139.69], ['Osaka', 34.69, 135.5],
  ['Seoul', 37.57, 126.98], ['Taipei', 25.03, 121.57], ['Beijing', 39.9, 116.4], ['Shanghai', 31.23, 121.47], ['Sydney', -33.87, 151.21],
  ['Melbourne', -37.81, 144.96], ['Auckland', -36.85, 174.76], ['Anchorage, AK', 61.22, -149.9], ['Honolulu, HI', 21.31, -157.86],
];
const hav = (a, b, c, d) => { const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
export function placeName(lat, lon) {
  let best = null, km = Infinity;
  for (const [n, a, b] of HUBS) { const d = hav(lat, lon, a, b); if (d < km) { km = d; best = n; } }
  return km < 60 ? best : km < 900 ? `${Math.round(km)} km from ${best}` : `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
}
export const fmtLatLon = (lat, lon) => `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;

/** lat/lon degrees -> point on sphere (matches three's SphereGeometry UV layout). */
export function toVec3(lat, lon, r = R) {
  const phi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
}
export function toLatLon(p) {
  const v = p.clone().normalize();
  const lat = 90 - Math.acos(v.y) * 180 / Math.PI;
  let lon = Math.atan2(v.z, -v.x) * 180 / Math.PI - 180; if (lon < -180) lon += 360;
  return { lat, lon };
}

let tex = null;
const earthTex = () => tex ??= Object.assign(new THREE.TextureLoader().load('/earth.jpg'), { colorSpace: THREE.SRGBColorSpace, anisotropy: 4 });

/** Globe group named 'globe': textured earth, graticule, atmosphere rim. Pins go in child 'pins'. */
export function buildGlobe() {
  const g = new THREE.Group(); g.name = 'globe';
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshStandardMaterial({ map: earthTex(), roughness: 0.85, metalness: 0, emissive: '#0a0f14', emissiveIntensity: 0.6 }));
  earth.name = 'earth'; g.add(earth);
  const lines = [];
  for (let lat = -60; lat <= 60; lat += 30) for (let lon = -180; lon < 180; lon += 4) lines.push(toVec3(lat, lon, R * 1.002), toVec3(lat, lon + 4, R * 1.002));
  for (let lon = -180; lon < 180; lon += 30) for (let lat = -88; lat < 88; lat += 4) lines.push(toVec3(lat, lon, R * 1.002), toVec3(lat + 4, lon, R * 1.002));
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.08 })));
  const rim = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 n; void main(){ n = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'varying vec3 n; void main(){ float a = pow(0.72 - dot(n, vec3(0,0,1.)), 3.); gl_FragColor = vec4(0.0, 0.88, 0.64, a * 0.9); }',
  }));
  g.add(rim);
  const pins = new THREE.Group(); pins.name = 'pins'; g.add(pins);
  return g;
}

const pinMat = new Map();
const mat = c => pinMat.get(c) ?? (pinMat.set(c, new THREE.MeshBasicMaterial({ color: c })), pinMat.get(c));

/** Rebuilds pin spikes: height scales with votes, leader/chosen in accent, mine ringed. */
export function setPins(globe, site, me) {
  const grp = globe.getObjectByName('pins'); grp.clear();
  const tally = site.tally || {}, top = site.chosen?.id ?? site.leader;
  for (const [id, p] of Object.entries(site.pins || {})) {
    if (site.chosen && id !== site.chosen.id) continue;
    const v = tally[id] || 0, h = 0.08 + v * 0.06, lead = id === top;
    const col = lead ? '#00e0a4' : '#ffffff';
    const base = toVec3(p.lat, p.lon), up = base.clone().normalize();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, h, 6), mat(col));
    stem.position.copy(base).addScaledVector(up, h / 2); stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    const head = new THREE.Mesh(new THREE.SphereGeometry(lead ? 0.022 : 0.016, 12, 8), mat(col));
    head.position.copy(base).addScaledVector(up, h);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.025, id === me ? 0.04 : 0.03, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: lead ? 0.9 : 0.45, side: THREE.DoubleSide }));
    ring.position.copy(base).addScaledVector(up, 0.003); ring.lookAt(base.clone().multiplyScalar(2));
    [stem, head, ring].forEach(m => { m.userData.pin = id; grp.add(m); });
  }
}

/** Globe orientation that puts (lat, lon) facing +Z with north up. */
export function faceQuat(lat, lon) {
  const v = toVec3(lat, lon);
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(lat * Math.PI / 180, -Math.atan2(v.x, v.z), 0, 'XYZ'));
}
