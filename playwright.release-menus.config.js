const base = require('./playwright.command-deck.config');
module.exports = {
  ...base,
  testMatch: 'release-layout-gate.spec.js',
  webServer: base.webServer.map((server, index) => index === 1 ? { ...server, env: { ...server.env, REACT_APP_MENU_LAYOUT_CUSTOMIZATION: 'false' } } : server),
};
