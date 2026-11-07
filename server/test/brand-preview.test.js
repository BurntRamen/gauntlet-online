const test = require('node:test');
const assert = require('node:assert/strict');
const { accountBrand } = require('../brandPreview');
const { server, __test } = require('../index');
test.after(() => server.close());
test('only the two verified account IDs receive preview eligibility', () => {
 for (const [nameKey, id] of [['simply','47d97ddb-65f9-4014-be92-9b677467d943'],['burntramen','9a9dcf5c-1d3f-422e-b0eb-ca1a32a699e5']]) {
  const account = { id, name: nameKey, nameKey, stats: {} };
  assert.equal(accountBrand(account), 'suitfire');
  assert.equal(__test.issueAccountSession(account).account.brandPreview, 'suitfire');
 }
 for (const account of [null, {nameKey:'simply'}, {id:'other',name:'simply',nameKey:'simply'}, {id:'other',nameKey:'someone',displayName:'BurntRamen'}, {id:'other',nameKey:'simply0307'}, {id:'other',nameKey:'simply2'}]) assert.equal(accountBrand(account),'gauntlet');
});
test('ordinary authenticated accounts keep public branding regardless of profile cosmetics', () => {
 const session = __test.issueAccountSession({id:'other',name:'Other',nameKey:'other',stats:{brandPreview:'suitfire'}});
 assert.equal(session.account.brandPreview,'gauntlet');
});
