const test=require('node:test'),assert=require('node:assert/strict');
const {cardSets}=require('../adminCreation');
test('catalog set filters retain original faction membership and explicit authored membership',()=>{
  const snapshot={domains:{cards:[{id:'original',factionId:'rumin'},{id:'other',factionId:'jali'},{id:'authored',factionId:'rumin',origin:'admin-v1'}],sets:[{id:'custom',name:'Custom set',members:['authored']}]}};
  const before=JSON.stringify(snapshot),sets=cardSets(snapshot);
  assert.deepEqual(sets.find(set=>set.id==='initiative').members,['original']);
  assert.deepEqual(sets.find(set=>set.id==='legacies').members,['other']);
  assert.deepEqual(sets.find(set=>set.id==='custom').members,['authored']);
  assert.equal(JSON.stringify(snapshot),before);
});
