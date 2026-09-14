// Grid + game constants, architectural styles (with paint colorways) and the block catalog.

export const CELL = 4;            // metres per block (width, depth and floor height)
export const MAX_LEVEL = 99;      // 100 floors above the street
export const DEEP = -99999;       // "no limit" for basement depth
export const TUNNEL_LEVEL = -2;   // subway runs under the streets on B2
export const RAIL_LEVEL = -4;     // regional rail runs deeper, on B4
export const DAY_SECONDS = 90;    // real seconds per game day at 1x

export function levelName(l) {
  if (l === 0) return 'Street';
  if (l < 0) return 'B' + (-l);
  return 'Floor ' + l;
}

// Each style has five paint colorways. wall = main surface, trim = secondary,
// accent = metal / ornament, glass = window base, roof = roof slabs.
const V = (name, wall, trim, accent, glass, roof) => ({ name, wall, trim, accent, glass, roof });

export const STYLES = {
  deco: { name: 'Art Deco', blurb: 'Setbacks, piers, gilded sunbursts', variants: [
    V('Limestone & Gold', 0xdccfae, 0x6b5536, 0xc9a14a, 0x27313b, 0x8a8170), V('Jet & Brass', 0x2e2d31, 0x1a1a1c, 0xd4af37, 0x1e2a33, 0x3a3a3e),
    V('Terracotta Sunset', 0xd89a6a, 0x7a3f24, 0xe0b050, 0x2a2f36, 0x6a4030), V('Mint Moderne', 0xcfe3d4, 0x3f6f5e, 0xb8a060, 0x26343a, 0x5e7a70),
    V('Pearl & Silver', 0xecebe6, 0x6d7278, 0xc8ccd0, 0x2a3440, 0x8a8d92)] },
  nouveau: { name: 'Art Nouveau', blurb: 'Arched windows, iron balconies', variants: [
    V('Cream & Verdigris', 0xe8d7b8, 0xcdb897, 0x3f7d68, 0x2b3a3a, 0x5e9483), V('Rose & Iron', 0xd9a5a0, 0xc08a84, 0x2b2b2b, 0x2e3438, 0x4a4f55),
    V('Butter & Plum', 0xf1dfa0, 0xd0b870, 0x5a2e4a, 0x2e2a36, 0x5a2e4a), V('Sage & Copper', 0xc9d3b8, 0xa8b690, 0xb86b3a, 0x2b3530, 0x7a5040),
    V('Sky & Gold', 0xcfe0ea, 0xaec4d2, 0xb89040, 0x2b3440, 0x486070)] },
  glass: { name: 'Modern Glass', blurb: 'Curtain wall, slender mullions', variants: [
    V('Sky Blue', 0x9fb4c3, 0xc9d1d6, 0x8fa3b0, 0x4f86b0, 0x5c6670), V('Bronze Tint', 0x6b5a48, 0x3b342d, 0x8a6f4e, 0x6e5a3f, 0x3a3530),
    V('Emerald', 0x7fa89a, 0xcfd8d4, 0x8fb0a0, 0x2f7a64, 0x4a5e58), V('Silver Mirror', 0xd0d6dc, 0xe8ecef, 0xb8c0c8, 0x8a9aa8, 0x6a727a),
    V('Midnight', 0x2a3040, 0x5a6070, 0x3a4050, 0x1e2a44, 0x2a2e38)] },
  beaux: { name: 'Beaux-Arts', blurb: 'Rusticated base, pediments, cornice', variants: [
    V('Ivory Stone', 0xefe6d2, 0xd6c8aa, 0x9a8b6e, 0x283036, 0x6f7a80), V('Brownstone', 0x7a4e3a, 0x9a6a52, 0x5a3a2a, 0x2a2622, 0x4a4440),
    V('Pink Granite', 0xd8a8a0, 0xc49088, 0x8a6a60, 0x283036, 0x6f6a70), V('Slate Grey', 0xa8aeb4, 0x8a9096, 0x5a6066, 0x252a30, 0x4a5056),
    V('Butter Stucco', 0xf0dca0, 0xe2c888, 0x9a8050, 0x283036, 0x6f6050)] },
  gothic: { name: 'Neo-Gothic', blurb: 'Lancet windows, buttresses', variants: [
    V('Limestone', 0xc4beaf, 0x8f8a7d, 0x6d6a60, 0x2b2f3a, 0x55585e), V('Terracotta', 0xd9b48f, 0xb08560, 0x7a5a3a, 0x2b2a2e, 0x6e4a36),
    V('Bluestone', 0x8a96a2, 0x6a7682, 0x4a525a, 0x2b2f3a, 0x3a4048), V('Blackened', 0x4a4846, 0x3a3836, 0x8a7a5a, 0x22252c, 0x2a2a2a),
    V('Rose Sandstone', 0xc89484, 0xa87464, 0x7a5040, 0x2b2a2e, 0x6e4a40)] },
  brutalist: { name: 'Brutalist', blurb: 'Board-formed concrete, deep fins', variants: [
    V('Raw Concrete', 0xa3a19b, 0x77756f, 0x5b5a56, 0x1f2326, 0x6d6b66), V('Weathered Ochre', 0xb39a72, 0x8a7555, 0x6a5a45, 0x22211e, 0x7a6a55),
    V('Charcoal', 0x5a5a5c, 0x444446, 0x303032, 0x1a1c1e, 0x3a3a3c), V('Sandstone Aggregate', 0xd2c4a8, 0xb8aa8e, 0x8a7c62, 0x22211e, 0x9a8c72),
    V('Painted White', 0xe8e6e0, 0xcfcdc6, 0xb0aea8, 0x1f2326, 0x9a9892)] },
  brick: { name: 'Industrial Brick', blurb: 'Brick, steel factory windows', variants: [
    V('Red Brick', 0x9c4a36, 0x2f3133, 0xd8d0c0, 0x2b3238, 0x4a4a4a), V('London Stock', 0xc8b48a, 0x1f3a2f, 0xece6d6, 0x2b3238, 0x555555),
    V('Blackened Brick', 0x3a3232, 0x1f1f1f, 0xc0b8a8, 0x2b3238, 0x2a2a2a), V('Blond Brick', 0xd8b87a, 0x5a4a3a, 0xf0e8d8, 0x2b3238, 0x6a5a4a),
    V('Painted Brick', 0xe8e2d4, 0x2f5d50, 0x2f5d50, 0x2b3238, 0x555555)] },
  moderne: { name: 'Streamline Moderne', blurb: 'Rounded corners, speed lines', variants: [
    V('Miami Pastel', 0xf2ede4, 0x7fc8c2, 0xe89aa8, 0x2e4b5e, 0xbfb8ac), V('Chrome Diner', 0xe8ebee, 0xc0392b, 0xb8c0c8, 0x263340, 0x8a9199),
    V('Flamingo', 0xf6c1c6, 0xffffff, 0x2ec4b6, 0x2e4b5e, 0xe8b0b6), V('Lemon Chiffon', 0xf6ecb0, 0x5a8fbf, 0xe07a5f, 0x2e4b5e, 0xd8cf98),
    V('Cream & Navy', 0xf2ece0, 0x1f3a5f, 0xc0392b, 0x263340, 0xb8b0a0)] },
  chicago: { name: 'Chicago School', blurb: 'Terracotta piers, bay windows', variants: [
    V('Terracotta', 0xd4b48c, 0xa87f55, 0x6e5238, 0x28303a, 0x5a534c), V('Glazed White', 0xf3f0e8, 0xcfc8b8, 0x8a8a80, 0x26303a, 0x707070),
    V('Chicago Green', 0x9cb89c, 0x7a9a7a, 0x4a5a4a, 0x28303a, 0x4a5a4a), V('Buff Brick', 0xd8c098, 0xb8a078, 0x6e5238, 0x28303a, 0x6a5a4a),
    V('Soot Black', 0x4a4644, 0x3a3634, 0xb08d57, 0x26303a, 0x2a2a2a)] },
  midcentury: { name: 'Mid-Century', blurb: 'Color panels, brise-soleil fins', variants: [
    V('Atomic Teal', 0xe9e4d8, 0x3a3a3a, 0x2a9d8f, 0x34495e, 0x5a5a5a), V('Sunset Panels', 0xd8d2c4, 0x2b2b2b, 0xe76f51, 0x2c3e50, 0x555555),
    V('Avocado', 0xe6e2cc, 0x3a3a3a, 0x8a9a3a, 0x34495e, 0x5a5a5a), V('Mustard', 0xe9e4d8, 0x2b2b2b, 0xe0a82e, 0x2c3e50, 0x555555),
    V('Blue Note', 0xdfe4e8, 0x2b2b2b, 0x3a6ea5, 0x2c3e50, 0x555555)] },
  futurist: { name: 'Parametric', blurb: 'Flowing fins and LED edges', variants: [
    V('White Fins', 0xf4f6f8, 0xdfe5ea, 0x66d9ff, 0x3b6f8f, 0xcfd6dc), V('Titanium', 0xa7adb3, 0x7c848c, 0xff8a3d, 0x2f4a5a, 0x6a7178),
    V('Rose Gold', 0xf0d8d0, 0xd8b8a8, 0xff9ad5, 0x5a3a4a, 0xd0b8b0), V('Carbon', 0x2a2c30, 0x3a3c40, 0x39ff88, 0x1e2a30, 0x202226),
    V('Aurora', 0xe8f0f4, 0xc8dce8, 0x9b5de5, 0x2f3f6f, 0xc0d0dc)] },
  mediterranean: { name: 'Mediterranean', blurb: 'Stucco, shutters, tile eaves', variants: [
    V('Stucco & Tile', 0xf1e3c8, 0xb5543a, 0x3f6b3a, 0x2d3438, 0xb5543a), V('Santorini', 0xf7f7f2, 0x2a66b0, 0x2a66b0, 0x2d3438, 0x2a66b0),
    V('Ochre Village', 0xe0b070, 0xa8502e, 0x3f6b3a, 0x2d3438, 0xa8502e), V('Pink Riviera', 0xf2c2b0, 0xb5543a, 0x2a66b0, 0x2d3438, 0xb5543a),
    V('Lavender Hill', 0xd8cce8, 0xa8543a, 0x5a6a3a, 0x2d3438, 0x9a4a32)] },
  castiron: { name: 'Cast-Iron Victorian', blurb: 'Fluted columns, arched bays', variants: [
    V('Painted Cream', 0xe6dcc4, 0x3b4a3f, 0xb08d57, 0x26303a, 0x3a3f44), V('Oxblood', 0x6e2a2a, 0x1f1f1f, 0xc9a14a, 0x26303a, 0x2f2f2f),
    V('Hunter Green', 0x2f5d50, 0x1f1f1f, 0xc9a14a, 0x26303a, 0x2a2f2c), V('Ironstone Gray', 0x8a8d90, 0x3a3d40, 0xd8d0c0, 0x26303a, 0x3a3d40),
    V('Sky Blue Paint', 0x9cc0d8, 0x2a3a4a, 0xe8e2d4, 0x26303a, 0x3a4a5a)] },
  solarpunk: { name: 'Solarpunk', blurb: 'Mass timber, gardens, solar', variants: [
    V('Timber & Green', 0xc9a57a, 0x6e8a4a, 0x4caf50, 0x3d6f73, 0x6a8a4a), V('Bamboo & Clay', 0xd8c49a, 0xb0714a, 0x7cb342, 0x3a5a5e, 0x8a6a4a),
    V('Charred Timber', 0x4a3a30, 0x6e8a4a, 0x9ccc65, 0x3d6f73, 0x5a7a4a), V('Birch & Moss', 0xe0d4b8, 0x5a7a3a, 0x8bc34a, 0x3a5a5e, 0x6a8a4a),
    V('Cedar & Sky', 0xb07a50, 0x4a8aa8, 0x4caf50, 0x3d6f73, 0x6a8a4a)] },
};
export const STYLE_ORDER = ['deco', 'nouveau', 'glass', 'beaux', 'gothic', 'brutalist', 'brick', 'moderne', 'chicago', 'midcentury', 'futurist', 'mediterranean', 'castiron', 'solarpunk'];

export function palette(s, v = 0) {
  const st = STYLES[s] || STYLES.deco;
  return st.variants[v] || st.variants[0];
}

export const CATEGORIES = [
  { id: 'under',   name: 'Underground',     icon: 'pickaxe' },
  { id: 'street',  name: 'Street Level',    icon: 'store' },
  { id: 'frontage', name: 'Entries & Terraces', icon: 'fence' },
  { id: 'floors',  name: 'Floors',          icon: 'building' },
  { id: 'sky',     name: 'Sky Levels',      icon: 'cloud' },
  { id: 'top',     name: 'Roofs & Crowns',  icon: 'crown' },
  { id: 'transit', name: 'Transit',         icon: 'train-front' },
  { id: 'parks',   name: 'Parks & Plazas',  icon: 'trees' },
];

// min/max: allowed levels (DEEP = any depth). income per game day, pop = occupants.
// needsCore: must be connected to the lobby by an elevator core (unless on the street level).
// commercial: earns transit/park bonuses. transit: the line this block serves.
// needs: 'subway' | 'rail' | 'bus' | 'any' | 'busramp'. street: must touch a street ('h' = a transit street).
const M = (id, o) => ({ id, needsCore: (o.income || 0) > 0 || (o.pop || 0) > 0, ...o });
const T = (id, o) => M(id, { cats: ['transit'], needsCore: false, ...o });
const R = (id, o) => M(id, { cats: ['top'], min: 1, max: MAX_LEVEL, topper: true, ...o });
const PK = (id, o) => M(id, { cats: ['parks'], min: 0, max: 0, open: true, park: true, pop: 3, needsCore: false, ...o });

export const MODULES = Object.fromEntries([
  M('core',        { name: 'Elevator Core',     icon: 'arrow-up-down', cats: ['under', 'street', 'floors', 'sky', 'transit'], cost: 18000, min: DEEP, max: MAX_LEVEL, core: true, floor: 0x44484f, desc: 'Stack cores from the street up (or down) to reach every floor.' }),

  // Underground
  M('foundation',  { name: 'Foundation Piles',  icon: 'brick-wall', cats: ['under'], cost: 12000, min: DEEP, max: -1, floor: 0x6b6258, desc: 'Each pile block lets the building rise 3 more floors.' }),
  M('parking',     { name: 'Parking Garage',    icon: 'square-parking', cats: ['under'], cost: 14000, min: DEEP, max: 0, income: 150, needsCore: false, floor: 0x55585c, desc: 'Steady parking fees. No elevator needed.' }),
  M('mall',        { name: 'Underground Mall',  icon: 'shopping-bag', cats: ['under'], cost: 38000, min: DEEP, max: -1, income: 700, pop: 14, commercial: true, floor: 0xcfc6b4, desc: 'Shoppers flow in from the concourse.' }),
  M('vault',       { name: 'Bank Vault',        icon: 'vault', cats: ['under'], cost: 55000, min: DEEP, max: -1, income: 650, pop: 2, floor: 0x4c4a45, desc: 'Deep and secure.' }),
  M('datacenter',  { name: 'Data Center',       icon: 'server', cats: ['under', 'floors'], cost: 70000, min: DEEP, max: MAX_LEVEL, income: 950, pop: 2, floor: 0x2a2f38, desc: 'Racks of humming servers.' }),
  M('nightclub',   { name: 'Speakeasy Club',    icon: 'music', cats: ['under', 'street'], cost: 48000, min: DEEP, max: 0, income: 820, pop: 20, commercial: true, floor: 0x1a1420, desc: 'Jazz, neon and a dance floor.' }),
  M('pool',        { name: 'Natatorium',        icon: 'waves-ladder', cats: ['under', 'floors'], cost: 52000, min: DEEP, max: 30, income: 420, pop: 10, floor: 0xd9e4e6, desc: 'Lap pool with tiled deck.' }),
  M('utility',     { name: 'Mechanical Plant',  icon: 'cog', cats: ['under', 'floors'], cost: 20000, min: DEEP, max: MAX_LEVEL, floor: 0x5d6166, desc: 'Needed for a 3★ rating.' }),

  // Street
  M('lobby',       { name: 'Grand Lobby',       icon: 'concierge-bell', cats: ['street'], cost: 26000, min: 0, max: 0, entrance: true, floor: 0xe8e2d4, desc: 'Required before upper floors can be reached.' }),
  M('shop',        { name: 'Retail Shop',       icon: 'store', cats: ['street', 'under'], cost: 22000, min: -1, max: 2, income: 420, pop: 6, commercial: true, entrance: true, floor: 0xd9d2c5, desc: 'Street-facing storefront.' }),
  M('cafe',        { name: 'Café & Restaurant', icon: 'coffee', cats: ['street', 'floors'], cost: 30000, min: -1, max: MAX_LEVEL, income: 520, pop: 10, commercial: true, entrance: true, floor: 0xa07a55, desc: 'Needed for a 3★ rating. Try it next to a library…' }),
  M('market',      { name: 'Grocery Market',    icon: 'shopping-basket', cats: ['street'], cost: 34000, min: -1, max: 1, income: 600, pop: 14, commercial: true, entrance: true, floor: 0xd8d4c8, desc: 'Produce stalls and aisles.' }),
  M('cinema',      { name: 'Cinema',            icon: 'clapperboard', cats: ['street', 'floors'], cost: 60000, min: 0, max: 5, income: 900, pop: 30, commercial: true, entrance: true, floor: 0x3a1e2a, desc: 'Screen, seats and a marquee. Two side by side?' }),
  M('library',     { name: 'Public Library',    icon: 'library-big', cats: ['street', 'floors'], cost: 32000, min: 0, max: 20, income: 200, pop: 10, entrance: true, floor: 0x8a6a4a, desc: 'Stacks and reading tables.' }),
  M('gallery',     { name: 'Art Gallery',       icon: 'image', cats: ['street', 'floors'], cost: 42000, min: 0, max: 50, income: 520, pop: 8, commercial: true, entrance: true, floor: 0xf0ede6, desc: 'Join several galleries and the collection grows…' }),

  // Entries & terraces: open street-level blocks in front of a building. They face the adjacent street
  // or road and take the chosen style's stone, trim and accent colors.
  M('sidewalkcafe', { name: 'Café Terrace',       icon: 'utensils', cats: ['frontage', 'street'], cost: 16000, min: 0, max: 0, open: true, income: 260, pop: 8, commercial: true, needsCore: false, floor: 0x9e9a92, desc: 'Tables, market umbrellas, planters and string lights under an awning.' }),
  M('stoop',        { name: 'Brownstone Stoop',   icon: 'door-closed', cats: ['frontage'], cost: 7000, min: 0, max: 0, open: true, floor: 0x9e9a92, desc: 'Iron-railed steps up to a raised parlor door.' }),
  M('grandstair',   { name: 'Grand Staircase',    icon: 'chevrons-up', cats: ['frontage'], cost: 12000, min: 0, max: 0, open: true, pop: 4, needsCore: false, floor: 0x9e9a92, desc: 'Monumental marble steps up to Floor 1. Line several up, then put a portico on top.' }),
  M('portico',      { name: 'Columned Portico',   icon: 'columns-3', cats: ['frontage'], cost: 15000, min: 0, max: 1, open: true, floor: 0x9e9a92, desc: 'Columns in the style’s order, entablature and a pediment over the door.' }),
  M('arcade',       { name: 'Arcade Walk',        icon: 'rainbow', cats: ['frontage'], cost: 11000, min: 0, max: 0, open: true, pop: 3, needsCore: false, floor: 0x9e9a92, desc: 'Covered arched colonnade along the sidewalk. Joins into long arcades.' }),
  M('vestibule',    { name: 'Glass Vestibule',    icon: 'door-open', cats: ['frontage'], cost: 9000, min: 0, max: 0, open: true, floor: 0x9e9a92, desc: 'Glazed entry pavilion with a revolving door and canopy.' }),
  M('forecourt',    { name: 'Planted Forecourt',  icon: 'armchair', cats: ['frontage'], cost: 8000, min: 0, max: 0, open: true, pop: 3, needsCore: false, floor: 0x9e9a92, desc: 'A tree planter, benches, bollards and a bike rack.' }),
  M('bikecorral',   { name: 'Bike Share Dock',    icon: 'bike', cats: ['frontage'], cost: 6000, min: 0, max: 0, open: true, income: 80, pop: 2, needsCore: false, floor: 0x9e9a92, desc: 'Docked share bikes, a green lane pad and a pay terminal.' }),

  // Floors
  M('office',      { name: 'Office Floor',      icon: 'briefcase', cats: ['floors'], cost: 26000, min: 1, max: MAX_LEVEL, income: 380, pop: 12, commercial: true, floor: 0x7a8491, desc: 'Busy by day.' }),
  M('condo',       { name: 'Condominium',       icon: 'house', cats: ['floors'], cost: 34000, min: 1, max: MAX_LEVEL, income: 330, pop: 4, residential: true, floor: 0xb89a74, desc: 'Residents come home at night.' }),
  M('hotel',       { name: 'Hotel Suite',       icon: 'bed-double', cats: ['floors'], cost: 40000, min: 2, max: MAX_LEVEL, income: 560, pop: 3, commercial: true, residential: true, floor: 0x8a3b3b, desc: 'Needed for a 4★ rating.' }),
  M('gym',         { name: 'Fitness Club',      icon: 'dumbbell', cats: ['floors'], cost: 30000, min: DEEP, max: MAX_LEVEL, income: 300, pop: 8, floor: 0x3d4a57, desc: 'Treadmills with a view.' }),
  M('clinic',      { name: 'Medical Clinic',    icon: 'stethoscope', cats: ['floors'], cost: 45000, min: 1, max: 30, income: 700, pop: 8, floor: 0xe6eef0, desc: 'Exam rooms and a front desk.' }),
  M('lab',         { name: 'Research Lab',      icon: 'microscope', cats: ['floors'], cost: 55000, min: 1, max: 50, income: 900, pop: 6, floor: 0xdfe4e8, desc: 'Benches and fume hoods. Near a data center…?' }),
  M('classroom',   { name: 'School',            icon: 'graduation-cap', cats: ['floors'], cost: 30000, min: 1, max: 15, income: 300, pop: 20, floor: 0xc9b48a, desc: 'Desks, chalkboard, lockers.' }),
  M('ballroom',    { name: 'Ballroom',          icon: 'party-popper', cats: ['floors', 'sky'], cost: 65000, min: 1, max: MAX_LEVEL, income: 1000, pop: 24, commercial: true, floor: 0xc8a878, desc: 'Parquet, chandeliers. What if a club is below?' }),

  // Sky
  M('skygarden',   { name: 'Sky Garden',        icon: 'sprout', cats: ['sky'], cost: 36000, min: 4, max: MAX_LEVEL - 1, pop: 6, open: true, floor: 0x6f8f4f, desc: 'Open-air terrace. Stack three for a surprise.' }),
  M('skypool',     { name: 'Infinity Pool',     icon: 'waves', cats: ['sky'], cost: 95000, min: 10, max: MAX_LEVEL - 1, income: 900, pop: 10, open: true, floor: 0x9ec9d4, desc: 'Open-air pool on the edge of the sky.' }),
  M('skylobby',    { name: 'Sky Lobby',         icon: 'arrow-up-to-line', cats: ['sky'], cost: 50000, min: 10, max: MAX_LEVEL, pop: 6, floor: 0xe8e2d4, desc: 'Transfer lobby for tall towers.' }),
  M('penthouse',   { name: 'Penthouse',         icon: 'gem', cats: ['sky'], cost: 120000, min: 12, max: MAX_LEVEL, income: 1700, pop: 2, residential: true, floor: 0xd8cfc0, desc: 'Piano, pool, skyline.' }),
  M('skybar',      { name: 'Sky Bar',           icon: 'martini', cats: ['sky'], cost: 70000, min: 15, max: MAX_LEVEL, income: 1100, pop: 16, commercial: true, floor: 0x2b2230, desc: 'Neon and cocktails.' }),
  M('skydining',   { name: 'Sky Restaurant',    icon: 'utensils-crossed', cats: ['sky'], cost: 85000, min: 20, max: MAX_LEVEL, income: 1400, pop: 16, commercial: true, floor: 0x3a2a24, desc: 'White tablecloths above the clouds.' }),
  M('observation', { name: 'Observation Deck',  icon: 'telescope', cats: ['sky'], cost: 80000, min: 20, max: MAX_LEVEL, income: 1300, pop: 18, commercial: true, floor: 0x2e3440, desc: 'Needed for a 5★ rating.' }),

  // Roofs & crowns
  R('spire',       { name: 'Deco Spire',        icon: 'chevrons-up', cost: 55000, desc: 'Stepped crown with a needle.' }),
  R('chrysler',    { name: 'Sunburst Crown',    icon: 'sun', cost: 75000, desc: 'Stainless arches with triangular windows.' }),
  R('dome',        { name: 'Copper Dome',       icon: 'dome', cost: 45000, desc: 'Patinated dome and lantern.' }),
  R('onion',       { name: 'Onion Dome',        icon: 'church', cost: 48000, desc: 'Gilded bulb on a drum.' }),
  R('pinnacle',    { name: 'Gothic Pinnacle',   icon: 'castle', cost: 40000, desc: 'Octagonal spire with finials.' }),
  R('clocktower',  { name: 'Clock Tower',       icon: 'clock', cost: 48000, desc: 'Four illuminated clock faces.' }),
  R('mansard',     { name: 'Mansard Roof',      icon: 'landmark', cost: 22000, desc: 'Slate slopes, dormers and iron cresting. Joins with neighbors.' }),
  R('hipped',      { name: 'Hipped Tile Roof',  icon: 'warehouse', cost: 16000, desc: 'Clay tile slopes. Joins with neighbors.' }),
  R('gable',       { name: 'Gabled Roof',       icon: 'tent', cost: 14000, desc: 'Pitched roof with gable ends. Joins along its ridge.' }),
  R('pagoda',      { name: 'Pagoda Roof',       icon: 'tent-tree', cost: 38000, desc: 'Tiered upturned eaves.' }),
  R('glasspyramid',{ name: 'Glass Pyramid',     icon: 'pyramid', cost: 42000, desc: 'Steel-framed glass pyramid.' }),
  R('lantern',     { name: 'Glass Crown',       icon: 'lamp', cost: 50000, desc: 'Glowing glass lantern and mast.' }),
  R('observatory', { name: 'Observatory Dome',  icon: 'orbit', cost: 52000, desc: 'Slotted dome with a telescope.' }),
  R('greenhouse',  { name: 'Rooftop Greenhouse',icon: 'flower-2', cost: 26000, desc: 'Glass house full of plants.' }),
  R('roofpool',    { name: 'Rooftop Pool Deck', icon: 'umbrella', cost: 60000, desc: 'Pool, loungers, umbrellas. Above a penthouse…?' }),
  R('roofbar',     { name: 'Rooftop Terrace',   icon: 'wine', cost: 35000, desc: 'String lights, tables and a bar.' }),
  R('meadow',      { name: 'Wildflower Meadow', icon: 'flower', cost: 10000, desc: 'Green roof with wildflowers and beehives.' }),
  R('tennis',      { name: 'Rooftop Tennis',    icon: 'circle-dot', cost: 30000, desc: 'Fenced court in the sky.' }),
  R('antenna',     { name: 'Broadcast Mast',    icon: 'radio-tower', cost: 26000, desc: 'Blinking aircraft lights.' }),
  R('beacon',      { name: 'Beacon Light',      icon: 'lightbulb', cost: 34000, desc: 'Lighthouse-style lamp room.' }),
  R('neonsign',    { name: 'Rooftop Sign',      icon: 'presentation', cost: 22000, desc: 'Glowing billboard on a steel frame.' }),
  R('helipad',     { name: 'Helipad',           icon: 'plane-landing', cost: 42000, desc: 'Executive arrivals. Pair with an observation deck.' }),
  R('turbine',     { name: 'Wind Turbine',      icon: 'wind', cost: 30000, desc: 'Three-blade rooftop turbine.' }),
  R('solar',       { name: 'Solar Array',       icon: 'solar-panel', cost: 18000, desc: 'Tilted photovoltaic panels.' }),
  R('coolingtower',{ name: 'Cooling Towers',    icon: 'factory', cost: 20000, desc: 'Industrial fans and louvres.' }),
  R('watertower',  { name: 'Water Tower',       icon: 'cylinder', cost: 9000, desc: 'Timber tank on steel legs.' }),
  R('roofgarden',  { name: 'Roof Garden',       icon: 'leaf', cost: 12000, desc: 'Planters, pergola and trees.' }),

  // Transit
  T('station',         { name: 'Subway Platform',   icon: 'train-front-tunnel', cats: ['transit', 'under'], cost: 90000, min: -2, max: -2, income: 1200, pop: 12, transit: 'subway', street: 'h', floor: 0xbdb7aa, desc: 'B2, touching an east–west street. Subway trains stop here.' }),
  T('subwayconcourse', { name: 'Subway Concourse',  icon: 'ticket', cost: 40000, min: DEEP, max: -1, income: 500, pop: 16, needs: 'subway', commercial: true, floor: 0xd9d3c4, desc: 'Turnstiles and maps. Needs a Subway Platform.' }),
  T('subwayentrance',  { name: 'Subway Entrance',   icon: 'door-stairwell', cost: 25000, min: 0, max: 0, pop: 6, open: true, needs: 'subway', floor: 0x8d8779, desc: 'Open-air stair kiosk with globe lamps.' }),
  T('railplatform',    { name: 'Rail Platform',     icon: 'train-track', cost: 140000, min: -4, max: -4, income: 1800, pop: 20, transit: 'rail', street: 'rail', floor: 0xc9c2b2, desc: 'B4, touching the rail street (red tunnel). Regional trains stop here.' }),
  T('trainhall',       { name: 'Grand Train Hall',  icon: 'landmark', cost: 90000, min: -1, max: 2, income: 1400, pop: 30, needs: 'rail', commercial: true, entrance: true, floor: 0xe3dccb, desc: 'Vaulted hall with a departure board. Needs rail.' }),
  T('ticketing',       { name: 'Ticket Hall',       icon: 'ticket', cost: 35000, min: DEEP, max: 1, income: 600, pop: 10, needs: 'any', commercial: true, floor: 0xd6cfbf, desc: 'Counters and kiosks. Needs any transit.' }),
  T('waitingroom',     { name: 'Waiting Room',      icon: 'armchair', cost: 30000, min: DEEP, max: 3, income: 300, pop: 18, needs: 'any', floor: 0xb89a74, desc: 'Long wooden benches and a clock.' }),
  T('baggage',         { name: 'Lockers & Baggage', icon: 'luggage', cost: 18000, min: DEEP, max: 2, income: 250, pop: 2, needs: 'any', floor: 0x9aa0a6, desc: 'Luggage carousel and lockers.' }),
  T('busbay',          { name: 'Bus Bay',           icon: 'bus', cost: 45000, min: 0, max: 0, income: 700, pop: 10, open: true, transit: 'bus', street: 'h', floor: 0x8d8779, desc: 'Touching an east–west street. City buses stop here.' }),
  T('busdeck',         { name: 'Bus Deck',          icon: 'bus-front', cost: 60000, min: 1, max: 4, income: 900, pop: 12, needs: 'busramp', floor: 0x55585c, desc: 'Parked coaches. Needs a Bus Ramp.' }),
  T('busramp',         { name: 'Bus Ramp',          icon: 'redo-2', cost: 40000, min: 0, max: 4, floor: 0x55585c, desc: 'Spiral ramp serving Bus Decks.' }),
  T('taxistand',       { name: 'Taxi Stand',        icon: 'car-taxi-front', cost: 15000, min: 0, max: 0, income: 300, pop: 4, open: true, street: 'any', floor: 0x8d8779, desc: 'Canopy and waiting cabs by the curb.' }),
  T('bikehub',         { name: 'Bike Hub',          icon: 'bike', cost: 16000, min: DEEP, max: 1, income: 200, pop: 4, floor: 0x6d7880, desc: 'Racks, repair stand, share bikes.' }),

  // Parks & plazas (ground level, tile into any size)
  PK('lawnpark',       { name: 'Lawn & Trees',      icon: 'trees', cost: 6000, desc: 'Shade trees, paths and benches.' }),
  PK('formalgarden',   { name: 'Formal Garden',     icon: 'rose', cost: 9000, desc: 'Box hedges, topiary and gravel walks.' }),
  PK('plaza',          { name: 'Paved Plaza',       icon: 'grid-2x2', cost: 7000, desc: 'Stone pavers, planters and seating.' }),
  PK('fountainplaza',  { name: 'Fountain Plaza',    icon: 'droplets', cost: 14000, desc: 'A fountain. Surround it with plazas…' }),
  PK('playground',     { name: 'Playground',        icon: 'ferris-wheel', cost: 11000, pop: 6, desc: 'Swings, slide and a climbing dome.' }),
  PK('court',          { name: 'Basketball Court',  icon: 'circle-dot', cost: 9000, pop: 5, desc: 'Painted court with hoops.' }),
  PK('pond',           { name: 'Pond & Bridge',     icon: 'fish', cost: 12000, desc: 'Lily pads, reeds, ducks and a footbridge.' }),
  PK('communitygarden',{ name: 'Community Garden',  icon: 'carrot', cost: 6000, desc: 'Raised beds, sunflowers and a tool shed.' }),
  PK('dogpark',        { name: 'Dog Park',          icon: 'dog', cost: 7000, pop: 4, desc: 'Fenced run with agility gear.' }),
  PK('sculpturegarden',{ name: 'Sculpture Garden',  icon: 'shapes', cost: 15000, desc: 'Plinths, hedges and modern sculpture.' }),
  PK('amphitheater',   { name: 'Amphitheater',      icon: 'drama', cost: 18000, pop: 10, desc: 'Curved stone seating and a stage.' }),
  PK('foodcourt',      { name: 'Food Truck Court',  icon: 'truck', cost: 10000, pop: 8, desc: 'Food trucks, picnic tables, string lights.' }),
  PK('skatepark',      { name: 'Skate Park',        icon: 'activity', cost: 12000, pop: 5, desc: 'Quarter pipes, rails and a fun box.' }),
  PK('zengarden',      { name: 'Zen Garden',        icon: 'mountain', cost: 13000, desc: 'Raked gravel, stones, maple and lanterns.' }),
  // World-inspired parks. These read their whole same-type area, so fill a plot for the full composition.
  PK('bassin',         { name: 'Grand Basin',       icon: 'sailboat', cost: 16000, pop: 6, desc: 'Round pool, tall jet, toy sailboats and green chairs — after the Tuileries.' }),
  PK('parterre',       { name: 'Parterre Garden',   icon: 'flower', cost: 14000, desc: 'Box-hedge scrolls on colored gravel — after Versailles.' }),
  PK('chahar',         { name: 'Water Garden',      icon: 'grid-2x2-plus', cost: 17000, desc: 'Four lawns split by water channels round a star pool — after the Alhambra.' }),
  PK('wavepaving',     { name: 'Wave Mosaic',       icon: 'waves', cost: 9000, desc: 'Black-and-white wave cobbles and a bronze fountain — after Lisbon\'s Rossio.' }),
  PK('starpiazza',     { name: 'Star Piazza',       icon: 'star', cost: 15000, pop: 5, desc: 'Oval star-lattice paving round a monument — after Rome\'s Campidoglio.' }),
  PK('jetgrid',        { name: 'Water Mirror',      icon: 'sparkles', cost: 13000, pop: 6, desc: 'A film of water on granite with ground jets — after Bordeaux\'s Miroir d\'eau.' }),
  PK('bosque',         { name: 'Tree Bosque',       icon: 'tree-deciduous', cost: 11000, pop: 5, desc: 'Clipped plane trees over gravel and café chairs — after the Palais-Royal.' }),
  PK('cascade',        { name: 'Water Steps',       icon: 'layers', cost: 18000, pop: 4, desc: 'Stepped terraces with falling water sheets — after Portland\'s Lovejoy Fountain.' }),
].map((m) => [m.id, m]));

// Map blocks: terrain painted onto empty plots. cover/water types set the surface (keeping height);
// elevation tools change the height in metres. cost is per block, or per metre moved for elevation.
// scenic terrain gives nearby buildings the same +10% views bonus as parks.
export const TERRAIN_MIN_H = -2;
export const TERRAIN_MAX_H = 24;
export const TERRAIN_GROUPS = [
  { id: 'land', name: 'Land', icon: 'expand', blurb: 'Grow buildable ground out past the map edge' },
  { id: 'streets', name: 'Streets & paths', icon: 'route', blurb: 'Roads, bike paths and boulevards — buildings open onto them' },
  { id: 'cover', name: 'Land cover', icon: 'land-plot', blurb: 'Paint the ground — it keeps its height' },
  { id: 'water', name: 'Water', icon: 'waves', blurb: 'Lakes, rivers and shallows sink below the street' },
  { id: 'elev', name: 'Elevation', icon: 'mountain-snow', blurb: 'Sculpt hills and valleys — build only on level land' },
];
const TR = (id, group, o) => ({ id, group, ...o });
export const TERRAIN = Object.fromEntries([
  TR('expand',    'land',    { name: 'Expand Land',     icon: 'square-plus',   cost: 3000, desc: 'New plot ground past the edge. Aim off the map; it must join existing land.' }),
  TR('shrink',    'land',    { name: 'Remove Land',     icon: 'square-minus',  cost: 0,    desc: 'Take back empty expanded land.' }),
  TR('road',      'streets', { name: 'Road',            icon: 'car',           cost: 2000, desc: 'Asphalt with curbs, sidewalks, lamps and parked cars. Paint two wide for a center line.' }),
  TR('bikelane',  'streets', { name: 'Bike Path',       icon: 'bike',          cost: 1600, desc: 'Green two-way cycle track with curbs and bollards.' }),
  TR('boulevard', 'streets', { name: 'Pedestrian Boulevard', icon: 'footprints', cost: 2200, scenic: true, desc: 'Paved promenade with planted trees, benches and lamps.' }),
  TR('lane',      'streets', { name: 'Cobbled Lane',    icon: 'milestone',     cost: 1500, desc: 'Shared cobblestone street with a gutter, bollards and planters.' }),
  TR('parking',   'streets', { name: 'Parking Lot',     icon: 'square-parking', cost: 1200, desc: 'Striped stalls with parked cars.' }),
  TR('grass',    'cover', { name: 'Grassland',         icon: 'sprout',         cost: 600,  scenic: true, desc: 'Open lawn with the odd shrub.' }),
  TR('meadow',   'cover', { name: 'Wildflower Meadow', icon: 'flower-2',       cost: 800,  scenic: true, desc: 'Tall grass dotted with wildflowers.' }),
  TR('forest',   'cover', { name: 'Broadleaf Forest',  icon: 'trees',          cost: 1500, scenic: true, desc: 'Oaks, birches, maples and cherries.' }),
  TR('pines',    'cover', { name: 'Pine Forest',       icon: 'tree-pine',      cost: 1500, scenic: true, desc: 'Dense evergreen conifers.' }),
  TR('farm',     'cover', { name: 'Farmland',          icon: 'wheat',          cost: 900,  scenic: true, desc: 'Rows of wheat, corn, lavender or greens.' }),
  TR('sand',     'cover', { name: 'Sand Beach',        icon: 'shell',          cost: 700,  scenic: true, desc: 'Pale sand, with umbrellas and palms by the water.' }),
  TR('desert',   'cover', { name: 'Desert Dunes',      icon: 'sun',            cost: 700,  desc: 'Rippled dunes and saguaro cactus.' }),
  TR('rock',     'cover', { name: 'Rocky Outcrop',     icon: 'mountain',       cost: 1000, scenic: true, desc: 'Craggy stone and boulders.' }),
  TR('snow',     'cover', { name: 'Snowfield',         icon: 'snowflake',      cost: 900,  scenic: true, desc: 'Snow cover with frosted firs.' }),
  TR('dirt',     'cover', { name: 'Bare Earth',        icon: 'shovel',         cost: 300,  desc: 'Graded soil, ready for anything.' }),
  TR('marsh',    'cover', { name: 'Marsh & Reeds',     icon: 'bird',           cost: 1100, scenic: true, desc: 'Wet ground, puddles and reed beds.' }),
  TR('lake',     'water', { name: 'Deep Water',        icon: 'droplet',        cost: 2500, scenic: true, desc: 'Lakes and rivers — paint a winding line for a river.' }),
  TR('shallows', 'water', { name: 'Shallow Water',     icon: 'waves',          cost: 1800, scenic: true, desc: 'Wading depth with lily pads and reeds. Ring deep water with it.' }),
  TR('raise',    'elev',  { name: 'Raise Land',        icon: 'arrow-big-up',   cost: 1200, desc: '+1 m per click. Slopes blend into streets and buildings.' }),
  TR('lower',    'elev',  { name: 'Lower Land',        icon: 'arrow-big-down', cost: 1200, desc: '−1 m per click, down to −2 m.' }),
  TR('hill',     'elev',  { name: 'Hill',              icon: 'mountain-snow',  cost: 1000, desc: 'A rounded rise across the brush — bigger brushes, bigger hills.' }),
  TR('mesa',     'elev',  { name: 'Plateau',           icon: 'layers-2',       cost: 1000, desc: 'Lift the brush area to a flat top at 6 m.' }),
  TR('smooth',   'elev',  { name: 'Smooth',            icon: 'spline',         cost: 400,  desc: 'Average each block with its neighbors.' }),
  TR('level',    'elev',  { name: 'Level',             icon: 'equal',          cost: 400,  desc: 'Flatten back to street level so you can build.' }),
  TR('clear',    'elev',  { name: 'Clear Terrain',     icon: 'eraser',         cost: 0,    desc: 'Remove land cover, water and roads, back to a bare plot.' }),
].map((t) => [t.id, t]));

// Is this block see-through for facade purposes (neighbors draw walls toward it)?
export function isHollow(cell) {
  const m = MODULES[cell.m];
  return !!(m.open || m.topper);
}

export const rangeText = (m) => {
  const s = (l) => (l <= DEEP ? 'any depth' : l === 0 ? 'St' : l < 0 ? 'B' + -l : 'F' + l);
  return m.min === m.max ? s(m.min) : `${s(m.min)}–${s(m.max)}`;
};
