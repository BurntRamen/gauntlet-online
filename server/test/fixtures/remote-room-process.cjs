// Separate process, using the same recovery and transport boundary as production.
const { server, __test } = require("../../index");
Promise.resolve(__test.initializeRuntimeRecovery()).then(() => {
  const operationalHash = __test.goldEconomy?.persistence ? require("../../authoredContent").hash(__test.goldEconomy.persistence.snapshot()) : null;
  server.listen(0, "127.0.0.1", () => process.send({ port: server.address().port, operationalHash }));
}).catch(error => { process.send({ error: error.message }); process.exit(1); });
