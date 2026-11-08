const base = require('./playwright.admin-refinement.config');
module.exports = { ...base, testMatch: 'admin-pipelines.spec.js', reporter: [['list'], ['json', { outputFile: 'artifacts/admin-pipelines-results.json' }]] };
