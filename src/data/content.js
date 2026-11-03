/**
 * Forma Studio — content model
 * Camera stages, editorial copy, plan annotations, contact configuration.
 */

export const MODEL_SCALE = 13;

/**
 * Five camera stages. Angles are tuned against a 13-unit-tall pavilion whose
 * base sits on the waterline at y = 0.
 */
export const STAGES = [
  {
    id: 'approach',
    name: 'Three-quarter approach',
    short: 'Approach',
    position: [22.4, 12.2, 24.6],
    target: [-2, 5.4, 0],
    fov: 33,
    roll: 0.012,
    eyebrow: '01 / 05 — Three-quarter approach',
    title: ['A pavilion held', 'in <em>winter</em> air.'],
    body: 'Five tiers of timber and snow, standing at the waterline where the river gives the architecture back to itself.',
  },
  {
    id: 'reflection',
    name: 'Low reflection',
    short: 'Reflection',
    position: [-20.5, 2.2, 24.8],
    target: [-2, 5.2, 0],
    fov: 34,
    roll: -0.02,
    eyebrow: '02 / 05 — Low reflection',
    title: ['The river keeps', 'a <em>second</em>', 'building.'],
    body: 'The lowest eave sits almost on the water. Vermilion columns continue downward as colour, then dissolve into the drift.',
  },
  {
    id: 'rise',
    name: 'Diagonal rise',
    short: 'Rise',
    position: [26, 17, -14],
    target: [-2.2, 7.4, 0],
    fov: 34,
    roll: 0.025,
    eyebrow: '03 / 05 — Diagonal rise',
    title: ['Snow loads,', 'read tier', 'by <em>tier</em>.'],
    body: 'Every roof plane carries its own drift. We follow the diagonal upward, past the bracket sets that hold each eave in the air.',
  },
  {
    id: 'elevated',
    name: 'Elevated study',
    short: 'Elevation',
    position: [10.3, 39.2, 19],
    target: [-3, 5.5, 0],
    fov: 34,
    roll: -0.012,
    eyebrow: '04 / 05 — Elevated study',
    title: ['From above, a', 'square plan holds', 'the <em>cold</em>.'],
    body: 'A near top-down reading reduces the pagoda to its argument: square, stacked, concentric, absolutely centred in the water.',
  },
  {
    id: 'final',
    name: 'Final composition',
    short: 'Composition',
    position: [20, 10.5, 29],
    target: [-5.5, 5.2, 0],
    fov: 32,
    roll: 0.008,
    eyebrow: '05 / 05 — Final composition',
    title: ['A structure that', 'has already', 'survived <em>winter</em>.'],
    body: 'Warm light at the windows, ice on the tile, snow still falling. The drawing becomes a place you could walk into.',
  },
];

/** Live read-outs for the views panel / copy footer. */
export const READOUTS = [
  { alt: 11.5, dist: 34 },
  { alt: 3.1, dist: 32 },
  { alt: 17.5, dist: 32 },
  { alt: 42.8, dist: 36 },
  { alt: 7.8, dist: 39 },
];

export const LABELS = [
  'Vermilion colonnade · C-12',
  'Eave cantilever · 3.4 m',
  'Snow load · 240 mm',
  'Bracket set · 5-step',
  'Glazed bay · south',
  'Timber lattice · T-7',
  'Waterline · ±0.00',
  'Finial · bronze',
  'Roof pitch · 28°',
  'Stone apron · granite',
  'Ridge tile · ice',
  'Column bay · 4.2 m',
];

/** Landmark naming by normalised height, used by the hover guides. */
export const LANDMARK_NAMES = [
  'Stone apron',
  'Tier 01 eave',
  'Tier 02 eave',
  'Tier 03 eave',
  'Tier 04 eave',
  'Tier 05 eave',
  'Finial',
  'Ridge crest',
];

/** Marker coordinates are in plan viewBox units (see sections/plan.js). */
export const PLAN_MARKERS = [
  {
    id: 'm1',
    x: 238,
    y: 168,
    label: 'Winter garden',
    note: 'A double-height void left unheated. Snow is allowed to accumulate — it is the room the building looks into.',
  },
  {
    id: 'm2',
    x: 648,
    y: 470,
    label: 'Glazed stair',
    note: 'The stair sits in the cold edge of the plan. Every tread gets the same view of the water and none of the heat.',
  },
  {
    id: 'm3',
    x: 214,
    y: 508,
    label: 'Hearth room',
    note: 'The only fire in the building, set on the north side of the structural wall so the masonry can store the afternoon.',
  },
];

export const PROCESS_PHASES = [
  'Boundaries',
  'Structure',
  'Partitions',
  'Openings',
  'Furniture',
  'Annotation',
];

/**
 * Contact details are supplied by the studio — nothing here is invented.
 * Fill these in and the footer and enquiry sheet pick them up automatically.
 */
export const CONTACT = {
  email: '',
  phone: '',
  studio: '',
  hours: '',
  instagram: '',
};

export const CONTACT_FIELDS = [
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Telephone', type: 'tel' },
  { key: 'studio', label: 'Studio', type: 'text' },
  { key: 'hours', label: 'Studio hours', type: 'text' },
];
