// Change activeBrandSet to change only the decorative artwork, never the approved logo.
export const BRAND_ASSETS = { crest: '/brand/suitfire-v14/crest.png', full: '/brand/suitfire-v14/full-logo.png' };
export const BRAND_SETS = { initiative: { label: 'Initiative', artwork: ['rumin', 'bizi', 'sheen', 'frumo'].map(id => '/assets/gauntlet/' + id + '-card.webp') } };
export const activeBrandSet = 'initiative';
