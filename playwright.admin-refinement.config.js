const base = require('./playwright.admin-redesign.config');
module.exports = { ...base, testMatch: 'admin-refinement.spec.js', timeout: 120000,
  reporter: [['list'], ['json', { outputFile: 'artifacts/admin-refinement-results.json' }]] };
