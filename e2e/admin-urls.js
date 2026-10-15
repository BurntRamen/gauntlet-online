// Override ports when another Gauntlet worktree is being tested locally.
const serverPort = process.env.GAUNTLET_ADMIN_FIXTURE_PORT || process.env.GAUNTLET_ADMIN_PORT || "4117";
const clientPort = process.env.GAUNTLET_ADMIN_CLIENT_PORT || "3117";
module.exports = { serverPort, clientPort, origin: `http://127.0.0.1:${serverPort}`, clientOrigin: `http://127.0.0.1:${clientPort}` };
