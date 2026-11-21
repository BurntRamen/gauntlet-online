const { test: base, expect } = require("@playwright/test");

// API assertions are separated by long UI interactions and server restarts.
// Avoid reusing a Node HTTP socket that the fixture has already closed during
// that interval. Browser HTTP and WebSocket behavior stays unchanged.
const test = base.extend({
  request: async ({ playwright, baseURL }, use) => {
    const request = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Connection: "close" } });
    try { await use(request); } finally { await request.dispose(); }
  },
  restoreRelease: [async ({ playwright }, use) => {
    let baseline;
    await use((headers,state,origin)=>{expect(state.draft).toBeNull();baseline={headers,origin,releaseId:state.activeReleaseId};});
    if(!baseline) return;
    // Teardown has its own time budget and client even if a UI test times out.
    const origin=baseline.origin || require('./admin-urls').origin;
    const cleanup=await playwright.request.newContext({extraHTTPHeaders:{...baseline.headers,Connection:'close'}});
    try {
      const response=await cleanup.get(origin+'/api/admin/authoring');expect(response.ok()).toBeTruthy();let state=await response.json();
      if(state.draft){const discarded=await cleanup.post(origin+'/api/admin/authoring/discard',{data:{expectedRevision:state.revision}});expect(discarded.ok()).toBeTruthy();state=await discarded.json();}
      if(state.activeReleaseId!==baseline.releaseId){const restored=await cleanup.post(origin+'/api/admin/authoring/rollback',{data:{expectedRevision:state.revision,releaseId:baseline.releaseId}});expect(restored.ok()).toBeTruthy();}
    } finally {await cleanup.dispose();}
  }, {timeout:90000}]
});

module.exports = { test, expect };
