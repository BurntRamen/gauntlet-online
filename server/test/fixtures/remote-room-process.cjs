// Separate process, using the same recovery and transport boundary as production.
const { server, __test } = require("../../index");
Promise.resolve(__test.initializeRoomRecovery()).then(() => {
  server.listen(0, "127.0.0.1", () => process.send({ port: server.address().port }));
}).catch(error => { process.send({ error: error.message }); process.exit(1); });
