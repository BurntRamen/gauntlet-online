const fs = require("node:fs");
const path = require("node:path");

const ICONS = {
  attack: '<path d="M5 19 18 6m-5-1 6-1-1 6M4 16l4 4"/><path class="accent" d="m9 15 6-6"/>',
  block: '<path d="M12 3 19 6v5c0 4.4-2.7 7.7-7 10-4.3-2.3-7-5.6-7-10V6l7-3Z"/><path class="accent" d="M8.5 12h7M12 8.5v7"/>',
  payment: '<path d="M5 5h8v11H5zM11 8h8v11h-8z"/><path class="accent" d="m7 18 3 3 3-3M10 21v-5"/>',
  priority: '<path d="m12 3 5 5-5 13-5-13 5-5Z"/><path class="accent" d="M3.5 12a8.5 8.5 0 0 1 17 0M19 8l1.5 4-4-1"/>',
  placement: '<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path class="accent" d="M12 7v9m-3-3 3 3 3-3"/>',
  damage: '<path d="m13 2-2 7 5-2-4 8 7-3-8 10 1-7-6 2 4-8-5 2 8-9Z"/><path class="accent" d="m4 5 2 2m12 10 2 2"/>',
  pass: '<path d="M4 12h14m-5-5 5 5-5 5"/><path class="accent" d="M5 7v10"/>',
  inspect: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 5 5"/><path class="accent" d="M8 10.5h5M10.5 8v5"/>',
  confirm: '<path d="m12 3 8 9-8 9-8-9 8-9Z"/><path class="accent" d="m8 12 2.5 2.5L16 9"/>',
  cancel: '<circle cx="12" cy="12" r="8.5"/><path class="accent" d="m8.5 8.5 7 7m0-7-7 7"/>',
  draw: '<path d="M4 6h10v14H4zM9 3h10v14h-2"/><path class="accent" d="m13 9 3 3-3 3M16 12H9"/>',
  discard: '<path d="M5 4h10v14H5zM9 7h10v13H9"/><path class="accent" d="m4 20 3 2 3-2"/>',
  connection: '<path d="M8.5 15.5 6 18a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0M15.5 8.5 18 6a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0" transform="translate(0 -1) scale(.96)"/><path class="accent" d="m8.5 15.5 7-7"/>',
  sound: '<path d="M4 10h4l5-4v12l-5-4H4z"/><path class="accent" d="M16 9a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12"/>'
};

function renderSvg(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#E6E1D1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><style>.accent{stroke:#1E6BFF}</style>${body}</svg>\n`;
}

function generateMatchIcons(outputDirectory = path.resolve("client/public/assets/gauntlet/match/icons")) {
  fs.mkdirSync(outputDirectory, { recursive: true });
  Object.entries(ICONS).forEach(([name, body]) => {
    fs.writeFileSync(path.join(outputDirectory, `${name}.svg`), renderSvg(body));
  });
  return Object.keys(ICONS);
}

if (require.main === module) {
  const generated = generateMatchIcons();
  console.log(`Generated ${generated.length} match icons.`);
}

module.exports = { generateMatchIcons, ICONS };
