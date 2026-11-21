const test = require("node:test"), assert = require("node:assert/strict");
const { createAdminData } = require("../adminData");
test("Home reports real failures without account, purchase or module inventories", async () => {
  let unavailable = false;
  const forbidden = () => assert.fail("Home must not read dashboard data");
  const data = createAdminData({ useSupabase: () => true, request: forbidden,
    archive: {probe: forbidden}, persistence: {getMode: forbidden}, deckCapability: forbidden,
    publication: { summary: () => ({activeReleaseId:"live", draft:null}) },
    gold: {inspectAccount: forbidden},
    para: {inspect: () => { if(unavailable) throw new Error("private-storage-detail");return {failures:[{}]}; }},
    runtimeStorage: () => ({checkpoint:{blocked:true},backups:{enabled:false}})
  });
  let home = await data.home();
  assert.ok(home.tasks.some(t => /settlement/.test(t.title)));
  assert.ok(home.tasks.some(t => t.title === "Check operations"));
  for(const key of ["events","purchases","players","modules","storage"])assert.equal(Object.hasOwn(home,key),false);
  unavailable = true; home = await data.home();
  assert.equal(home.tasks.find(t=>t.title==="Check operations").message,"2 storage or recovery problems need attention.");
  assert.equal(JSON.stringify(home).includes("private-storage-detail"),false);
});
