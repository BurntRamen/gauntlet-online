const PORT = process.env.PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const CLIENT_URLS = (process.env.CLIENT_URLS || "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = [
  CLIENT_URL,
  "http://localhost:3000",
  "https://gauntlet-online.vercel.app",
  ...CLIENT_URLS
];
const ACCOUNT_DATA_FILE = process.env.ACCOUNT_DATA_FILE || `${__dirname}/accounts.json`;
const ACCOUNT_AUTH_SECRET = process.env.ACCOUNT_AUTH_SECRET || "dev-gauntlet-auth-secret-change-me";
const OWNER_STATS_TOKEN = process.env.OWNER_STATS_TOKEN || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cors = require("cors");
const { Server } = require("socket.io");

function isAllowedOrigin(origin) {
  return !origin || ALLOWED_ORIGINS.includes(origin);
}

const corsOptions = {
  origin(origin, callback) {
    callback(isAllowedOrigin(origin) ? null : new Error("Not allowed by CORS"), isAllowedOrigin(origin));
  },
  methods: ["GET", "POST", "DELETE", "PATCH"],
  credentials: true
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST", "DELETE", "PATCH"],
    credentials: true
  }
});

app.use(cors(corsOptions));
app.use(express.json({ limit: "20kb" }));

app.get("/", (_req, res) => {
  res.send("Gauntlet server is running.");
});

app.get("/api/storage-status", (_req, res) => {
  res.json({
    accountStorage: SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? "supabase-configured" : "local-json",
    supabaseConfigured: !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  });
});

// ============ ACCOUNT AUTH ============
function loadAccountStore() {
  try {
    if (!fs.existsSync(ACCOUNT_DATA_FILE)) return { accounts: [] };
    const parsed = JSON.parse(fs.readFileSync(ACCOUNT_DATA_FILE, "utf8"));
    return { accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [] };
  } catch (error) {
    console.error("[Accounts] Failed to load account store", error);
    return { accounts: [] };
  }
}

function saveAccountStore(store) {
  fs.mkdirSync(path.dirname(ACCOUNT_DATA_FILE), { recursive: true });
  fs.writeFileSync(ACCOUNT_DATA_FILE, JSON.stringify(store, null, 2));
}

function normalizeAccountName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function accountNameKey(name) {
  return normalizeAccountName(name).toLowerCase();
}

function isValidAccountName(name) {
  return /^[A-Za-z0-9 _-]{3,24}$/.test(name);
}

function normalizeGuestName(name) {
  return normalizeAccountName(name || "Guest");
}

function isValidGuestName(name) {
  return /^[A-Za-z0-9 _-]{2,24}$/.test(name);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 150000, 32, "sha256").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, account) {
  const candidate = hashPassword(password, account.passwordSalt);
  return crypto.timingSafeEqual(Buffer.from(candidate.hash, "hex"), Buffer.from(account.passwordHash, "hex"));
}

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function signAuthPayload(payload) {
  const body = base64Url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", ACCOUNT_AUTH_SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyAuthToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", ACCOUNT_AUTH_SECRET).update(body).digest("base64url");
  const signatureBuffer = Buffer.from(signature || "");
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.id || !payload.name) return null;
    return payload;
  } catch (_error) {
    return null;
  }
}

function publicAccount(account) {
  return {
    id: account.id,
    name: account.name,
    createdAt: account.createdAt,
    lastLoginAt: account.lastLoginAt || null
  };
}

function publicFriend(account) {
  return {
    id: account.id,
    name: account.name,
    lastSeenAt: account.lastSeenAt || null
  };
}

function publicFriendMessage(message) {
  return {
    id: message.id,
    fromId: message.fromId,
    fromName: message.fromName,
    toId: message.toId,
    toName: message.toName,
    text: message.text,
    createdAt: message.createdAt
  };
}

function issueAccountSession(account) {
  return {
    token: signAuthPayload({ id: account.id, name: account.name }),
    account: publicAccount(account)
  };
}

function findAccountByName(store, name) {
  const key = accountNameKey(name);
  return store.accounts.find((account) => account.nameKey === key) || null;
}

function useSupabaseStore() {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

async function supabaseRequest(pathname, options = {}) {
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.error || `Supabase request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

function accountFromSupabaseRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    nameKey: row.name_key,
    passwordSalt: row.password_salt,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    lastSeenAt: row.last_seen_at,
    stats: row.stats || {}
  };
}

async function findSupabaseAccountByName(name) {
  const rows = await supabaseRequest(`gauntlet_accounts?name_key=eq.${encodeURIComponent(accountNameKey(name))}&select=*`);
  return accountFromSupabaseRow(rows?.[0]);
}

async function findSupabaseAccountById(id) {
  if (!id) return null;
  const rows = await supabaseRequest(`gauntlet_accounts?id=eq.${encodeURIComponent(id)}&select=*`);
  return accountFromSupabaseRow(rows?.[0]);
}

async function patchSupabaseAccount(id, patch) {
  await supabaseRequest(`gauntlet_accounts?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch)
  });
}

async function getAccountFromToken(token) {
  const payload = verifyAuthToken(token);
  if (!payload) return null;
  if (useSupabaseStore()) return publicAccount(await findSupabaseAccountById(payload.id));

  const store = loadAccountStore();
  const account = store.accounts.find((entry) => entry.id === payload.id);
  if (!account) return null;
  return publicAccount(account);
}

async function getAccountRecordFromToken(token) {
  const payload = verifyAuthToken(token);
  if (!payload) return null;
  if (useSupabaseStore()) return findSupabaseAccountById(payload.id);

  const store = loadAccountStore();
  return store.accounts.find((entry) => entry.id === payload.id) || null;
}

async function requireAccountRecord(req, res) {
  const authHeader = req.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const payload = verifyAuthToken(token);
  if (!payload) {
    res.status(401).json({ error: "Not signed in." });
    return null;
  }

  if (useSupabaseStore()) {
    const account = await findSupabaseAccountById(payload.id);
    if (!account) {
      res.status(401).json({ error: "Not signed in." });
      return null;
    }
    return { source: "supabase", account };
  }

  const store = loadAccountStore();
  const account = store.accounts.find((entry) => entry.id === payload.id);
  if (!account) {
    res.status(401).json({ error: "Not signed in." });
    return null;
  }

  account.friends = Array.isArray(account.friends) ? account.friends : [];
  account.messages = Array.isArray(account.messages) ? account.messages : [];
  return { source: "local", store, account };
}

function getLocalFriendPayload(store, account) {
  const friendIds = new Set(Array.isArray(account.friends) ? account.friends : []);
  const friends = store.accounts
    .filter((entry) => friendIds.has(entry.id))
    .map(publicFriend)
    .sort((a, b) => a.name.localeCompare(b.name));
  const messages = (account.messages || [])
    .map(publicFriendMessage)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return { friends, messages };
}

async function getSupabaseFriendPayload(account) {
  const friendRows = await supabaseRequest(`gauntlet_friends?account_id=eq.${encodeURIComponent(account.id)}&select=friend_id`);
  const friendIds = friendRows.map((row) => row.friend_id);
  const friends = friendIds.length > 0
    ? (await supabaseRequest(`gauntlet_accounts?id=in.(${friendIds.join(",")})&select=id,name,last_seen_at`))
        .map(accountFromSupabaseRow)
        .map(publicFriend)
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const messageRows = await supabaseRequest(`gauntlet_friend_messages?or=(from_id.eq.${encodeURIComponent(account.id)},to_id.eq.${encodeURIComponent(account.id)})&select=*&order=created_at.asc`);
  const participantIds = [...new Set(messageRows.flatMap((message) => [message.from_id, message.to_id]))];
  const participantRows = participantIds.length > 0
    ? await supabaseRequest(`gauntlet_accounts?id=in.(${participantIds.join(",")})&select=id,name`)
    : [];
  const namesById = new Map(participantRows.map((row) => [row.id, row.name]));
  const messages = messageRows.map((message) => publicFriendMessage({
    id: message.id,
    fromId: message.from_id,
    fromName: namesById.get(message.from_id) || "Unknown",
    toId: message.to_id,
    toName: namesById.get(message.to_id) || "Unknown",
    text: message.text,
    createdAt: message.created_at
  }));

  return { friends, messages };
}

async function getFriendPayload(context) {
  if (context.source === "supabase") return getSupabaseFriendPayload(context.account);
  return getLocalFriendPayload(context.store, context.account);
}

async function touchAccountStats(accountId, field) {
  if (!accountId) return;
  if (useSupabaseStore()) {
    const account = await findSupabaseAccountById(accountId);
    if (!account) return;
    const stats = account.stats || {};
    stats[field] = (stats[field] || 0) + 1;
    await patchSupabaseAccount(accountId, { stats, last_seen_at: new Date().toISOString() });
    return;
  }

  const store = loadAccountStore();
  const account = store.accounts.find((entry) => entry.id === accountId);
  if (!account) return;
  account.stats = account.stats || {};
  account.stats[field] = (account.stats[field] || 0) + 1;
  account.lastSeenAt = new Date().toISOString();
  saveAccountStore(store);
}

async function recordAccountGameResult(accountId, result) {
  if (!accountId || !["win", "loss", "draw"].includes(result)) return;
  if (useSupabaseStore()) {
    const account = await findSupabaseAccountById(accountId);
    if (!account) return;
    const stats = account.stats || {};
    stats.gamesPlayed = (stats.gamesPlayed || 0) + 1;
    if (result === "win") stats.gamesWon = (stats.gamesWon || 0) + 1;
    if (result === "loss") stats.gamesLost = (stats.gamesLost || 0) + 1;
    if (result === "draw") stats.gamesDrawn = (stats.gamesDrawn || 0) + 1;
    stats.rankedGamesPlayed = (stats.rankedGamesPlayed || 0) + 1;
    if (result === "win") stats.rankedGamesWon = (stats.rankedGamesWon || 0) + 1;
    if (result === "loss") stats.rankedGamesLost = (stats.rankedGamesLost || 0) + 1;
    if (result === "draw") stats.rankedGamesDrawn = (stats.rankedGamesDrawn || 0) + 1;
    await patchSupabaseAccount(accountId, { stats, last_seen_at: new Date().toISOString() });
    return;
  }

  const store = loadAccountStore();
  const account = store.accounts.find((entry) => entry.id === accountId);
  if (!account) return;

  account.stats = account.stats || {};
  account.stats.gamesPlayed = (account.stats.gamesPlayed || 0) + 1;
  if (result === "win") account.stats.gamesWon = (account.stats.gamesWon || 0) + 1;
  if (result === "loss") account.stats.gamesLost = (account.stats.gamesLost || 0) + 1;
  if (result === "draw") account.stats.gamesDrawn = (account.stats.gamesDrawn || 0) + 1;
  account.stats.rankedGamesPlayed = (account.stats.rankedGamesPlayed || 0) + 1;
  if (result === "win") account.stats.rankedGamesWon = (account.stats.rankedGamesWon || 0) + 1;
  if (result === "loss") account.stats.rankedGamesLost = (account.stats.rankedGamesLost || 0) + 1;
  if (result === "draw") account.stats.rankedGamesDrawn = (account.stats.rankedGamesDrawn || 0) + 1;
  account.lastSeenAt = new Date().toISOString();
  saveAccountStore(store);
}

function getAccountMatchProfile(account) {
  const hasRankedStats =
    (account.stats?.rankedGamesPlayed || 0) > 0 ||
    (account.stats?.rankedGamesWon || 0) > 0 ||
    (account.stats?.rankedGamesLost || 0) > 0 ||
    (account.stats?.rankedGamesDrawn || 0) > 0;
  const wins = hasRankedStats ? account.stats?.rankedGamesWon || 0 : account.stats?.gamesWon || 0;
  const losses = hasRankedStats ? account.stats?.rankedGamesLost || 0 : account.stats?.gamesLost || 0;
  const draws = hasRankedStats ? account.stats?.rankedGamesDrawn || 0 : account.stats?.gamesDrawn || 0;
  const decidedGames = wins + losses;
  const gamesPlayed = wins + losses + draws;
  const winRatio = decidedGames > 0 ? wins / decidedGames : 0.5;
  return { wins, losses, draws, gamesPlayed, winRatio };
}

app.post("/api/auth/register", async (req, res) => {
  const name = normalizeAccountName(req.body?.name);
  const password = String(req.body?.password || "");

  if (!isValidAccountName(name)) {
    res.status(400).json({ error: "Account name must be 3-24 characters using letters, numbers, spaces, hyphens, or underscores." });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const passwordResult = hashPassword(password);
  const now = new Date().toISOString();
  const account = {
    id: crypto.randomUUID(),
    name,
    nameKey: accountNameKey(name),
    passwordSalt: passwordResult.salt,
    passwordHash: passwordResult.hash,
    createdAt: now,
    lastLoginAt: now,
    lastSeenAt: now,
    friends: [],
    messages: [],
    stats: { gamesCreated: 0, gamesJoined: 0, gamesSpectated: 0 }
  };

  try {
    if (useSupabaseStore()) {
      if (await findSupabaseAccountByName(name)) {
        res.status(409).json({ error: "That account name is already taken." });
        return;
      }
      await supabaseRequest("gauntlet_accounts", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          id: account.id,
          name: account.name,
          name_key: account.nameKey,
          password_salt: account.passwordSalt,
          password_hash: account.passwordHash,
          created_at: account.createdAt,
          last_login_at: account.lastLoginAt,
          last_seen_at: account.lastSeenAt,
          stats: account.stats
        })
      });
    } else {
      const store = loadAccountStore();
      if (findAccountByName(store, name)) {
        res.status(409).json({ error: "That account name is already taken." });
        return;
      }
      store.accounts.push(account);
      saveAccountStore(store);
    }

    res.json(issueAccountSession(account));
  } catch (error) {
    console.error("[Accounts] Register failed", error);
    res.status(500).json({ error: "Could not create account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const name = normalizeAccountName(req.body?.name);
  const password = String(req.body?.password || "");

  try {
    const account = useSupabaseStore()
      ? await findSupabaseAccountByName(name)
      : findAccountByName(loadAccountStore(), name);

    if (!account || !verifyPassword(password, account)) {
      res.status(401).json({ error: "Invalid account name or password." });
      return;
    }

    account.lastLoginAt = new Date().toISOString();
    account.lastSeenAt = account.lastLoginAt;
    if (useSupabaseStore()) {
      await patchSupabaseAccount(account.id, { last_login_at: account.lastLoginAt, last_seen_at: account.lastSeenAt });
    } else {
      const store = loadAccountStore();
      const localAccount = store.accounts.find((entry) => entry.id === account.id);
      localAccount.lastLoginAt = account.lastLoginAt;
      localAccount.lastSeenAt = account.lastSeenAt;
      saveAccountStore(store);
    }

    res.json(issueAccountSession(account));
  } catch (error) {
    console.error("[Accounts] Login failed", error);
    res.status(500).json({ error: "Could not sign in." });
  }
});

app.get("/api/auth/me", async (req, res) => {
  const authHeader = req.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const account = await getAccountFromToken(token);
  if (!account) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  res.json({ account });
});

app.get("/api/friends", async (req, res) => {
  const context = await requireAccountRecord(req, res);
  if (!context) return;
  res.json(await getFriendPayload(context));
});

app.post("/api/friends", async (req, res) => {
  const context = await requireAccountRecord(req, res);
  if (!context) return;

  const friendName = normalizeAccountName(req.body?.name);
  const friend = context.source === "supabase"
    ? await findSupabaseAccountByName(friendName)
    : findAccountByName(context.store, friendName);
  if (!friend) {
    res.status(404).json({ error: "No account found with that name." });
    return;
  }
  if (friend.id === context.account.id) {
    res.status(400).json({ error: "You cannot add yourself as a friend." });
    return;
  }

  if (context.source === "supabase") {
    const rows = [
      { account_id: context.account.id, friend_id: friend.id },
      { account_id: friend.id, friend_id: context.account.id }
    ];
    await supabaseRequest("gauntlet_friends?on_conflict=account_id,friend_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows)
    });
    await patchSupabaseAccount(context.account.id, { last_seen_at: new Date().toISOString() });
  } else {
    friend.friends = Array.isArray(friend.friends) ? friend.friends : [];
    if (!context.account.friends.includes(friend.id)) context.account.friends.push(friend.id);
    if (!friend.friends.includes(context.account.id)) friend.friends.push(context.account.id);
    context.account.lastSeenAt = new Date().toISOString();
    saveAccountStore(context.store);
  }
  res.json(await getFriendPayload(context));
});

app.delete("/api/friends/:friendId", async (req, res) => {
  const context = await requireAccountRecord(req, res);
  if (!context) return;

  const friendId = req.params.friendId;
  if (context.source === "supabase") {
    await supabaseRequest(`gauntlet_friends?account_id=eq.${encodeURIComponent(context.account.id)}&friend_id=eq.${encodeURIComponent(friendId)}`, { method: "DELETE" });
    await supabaseRequest(`gauntlet_friends?account_id=eq.${encodeURIComponent(friendId)}&friend_id=eq.${encodeURIComponent(context.account.id)}`, { method: "DELETE" });
    await patchSupabaseAccount(context.account.id, { last_seen_at: new Date().toISOString() });
  } else {
    const friend = context.store.accounts.find((entry) => entry.id === friendId);
    context.account.friends = context.account.friends.filter((id) => id !== friendId);
    if (friend) {
      friend.friends = Array.isArray(friend.friends) ? friend.friends.filter((id) => id !== context.account.id) : [];
    }
    context.account.lastSeenAt = new Date().toISOString();
    saveAccountStore(context.store);
  }
  res.json(await getFriendPayload(context));
});

app.post("/api/friends/:friendId/messages", async (req, res) => {
  const context = await requireAccountRecord(req, res);
  if (!context) return;

  const friend = context.source === "supabase"
    ? await findSupabaseAccountById(req.params.friendId)
    : context.store.accounts.find((entry) => entry.id === req.params.friendId);
  const isFriend = context.source === "supabase"
    ? (await supabaseRequest(`gauntlet_friends?account_id=eq.${encodeURIComponent(context.account.id)}&friend_id=eq.${encodeURIComponent(req.params.friendId)}&select=friend_id`)).length > 0
    : !!friend && context.account.friends.includes(friend.id);
  if (!friend || !isFriend) {
    res.status(404).json({ error: "Friend not found." });
    return;
  }

  const text = String(req.body?.text || "").trim().slice(0, 500);
  if (!text) {
    res.status(400).json({ error: "Enter a message first." });
    return;
  }

  const now = new Date().toISOString();
  const message = {
    id: crypto.randomUUID(),
    fromId: context.account.id,
    fromName: context.account.name,
    toId: friend.id,
    toName: friend.name,
    text,
    createdAt: now
  };
  if (context.source === "supabase") {
    await supabaseRequest("gauntlet_friend_messages", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        id: message.id,
        from_id: message.fromId,
        to_id: message.toId,
        text: message.text,
        created_at: message.createdAt
      })
    });
    await patchSupabaseAccount(context.account.id, { last_seen_at: now });
  } else {
    friend.messages = Array.isArray(friend.messages) ? friend.messages : [];
    context.account.messages.push(message);
    friend.messages.push(message);
    context.account.lastSeenAt = now;
    saveAccountStore(context.store);
  }
  res.json(await getFriendPayload(context));
});

app.get("/api/admin/account-stats", async (req, res) => {
  const authHeader = req.get("authorization") || "";
  const providedToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : req.get("x-owner-token");
  if (!OWNER_STATS_TOKEN || providedToken !== OWNER_STATS_TOKEN) {
    res.status(403).json({ error: "Owner stats token required." });
    return;
  }

  const accounts = useSupabaseStore()
    ? (await supabaseRequest("gauntlet_accounts?select=*")).map(accountFromSupabaseRow)
    : loadAccountStore().accounts;
  res.json({
    storage: useSupabaseStore() ? "supabase" : "local-json",
    totalAccounts: accounts.length,
    accounts: accounts.map((account) => ({
      name: account.name,
      createdAt: account.createdAt,
      lastLoginAt: account.lastLoginAt || null,
      lastSeenAt: account.lastSeenAt || null,
      gamesCreated: account.stats?.gamesCreated || 0,
      gamesJoined: account.stats?.gamesJoined || 0,
      gamesSpectated: account.stats?.gamesSpectated || 0,
      gamesWon: account.stats?.gamesWon || 0,
      gamesLost: account.stats?.gamesLost || 0,
      gamesDrawn: account.stats?.gamesDrawn || 0
    }))
  });
});

app.get("/api/leaderboard", async (_req, res) => {
  const accounts = useSupabaseStore()
    ? (await supabaseRequest("gauntlet_accounts?select=*")).map(accountFromSupabaseRow)
    : loadAccountStore().accounts;
  const leaderboard = accounts
    .map((account) => {
      const hasRankedStats =
        (account.stats?.rankedGamesPlayed || 0) > 0 ||
        (account.stats?.rankedGamesWon || 0) > 0 ||
        (account.stats?.rankedGamesLost || 0) > 0 ||
        (account.stats?.rankedGamesDrawn || 0) > 0;
      const wins = hasRankedStats ? account.stats?.rankedGamesWon || 0 : account.stats?.gamesWon || 0;
      const losses = hasRankedStats ? account.stats?.rankedGamesLost || 0 : account.stats?.gamesLost || 0;
      const draws = hasRankedStats ? account.stats?.rankedGamesDrawn || 0 : account.stats?.gamesDrawn || 0;
      const gamesPlayed = wins + losses;
      const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 1000) / 10 : 0;
      return {
        name: account.name,
        wins,
        losses,
        draws,
        gamesPlayed,
        winRate
      };
    })
    .filter((entry) => entry.gamesPlayed > 0)
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || a.losses - b.losses || a.name.localeCompare(b.name))
    .slice(0, 25);

  res.json({ leaderboard });
});

// ============ FACTION DATA ============
const factionsData = {
  rumin: {
    id: "rumin",
    name: "Rumin",
    cardImage: "/assets/gauntlet/rumin-card.webp",
    commander: { name: "Kaiser, the Jewel", image: "/assets/gauntlet/kaiser-gauntlet.webp", text: "Your fourth attack each turn gets +3 value." },
    general: { name: "Meerus", image: "/assets/gauntlet/meerus-gauntlet-2.webp", text: "Whenever you play your second attack each turn, you may play your third attack with cost 3 or less without paying its cost." },
    city: { name: "Rumie, City of the Empire", image: "/assets/gauntlet/rumie.webp", text: "Each turn, the first two attacks you play after your first that share a suit with your previous attack get +1 value." }
  },
  sheen: {
    id: "sheen",
    name: "Sheen",
    cardImage: "/assets/gauntlet/sheen-card.webp",
    commander: { name: "Emperor Nu", image: "/assets/gauntlet/leafen-gao.png", text: "Your blocking cards get +1 value. If it's your third or later time blocking, they get +2 instead." },
    general: { name: "Tang", image: "/assets/gauntlet/tang.webp", text: "Each turn, when you block for the second time, gain 2 life." },
    city: { name: "Beli, Living City", image: "/assets/gauntlet/beli.webp", text: "After your second block each turn, your next attack with cost 10+ gains +2 value." }
  },
  frumo: {
    id: "frumo",
    name: "Frumo",
    cardImage: "/assets/gauntlet/frumo-card.webp",
    commander: { name: "Lord Commander Polea", image: "/assets/gauntlet/polea.webp", text: "Once per turn, choose 1: put a card from your hand into an empty lane you control; switch the lanes of up to 2 cards you control; look at 1 face-down card; or one card you control gets +1 value until end of turn." },
    general: { name: "Lafayette", image: "/assets/gauntlet/lafayette.webp", text: "Once per turn, you may swap a lane card with a card from your hand." },
    city: { name: "Ristus, Sunken City", image: "/assets/gauntlet/ristus.webp", text: "Your first card played each turn with a consecutive value of the last card played gets +2." }
  },
  bizi: {
    id: "bizi",
    name: "Bizi",
    cardImage: "/assets/gauntlet/bizi-card.webp",
    commander: { name: "Focus, Conductor of Progress", image: "/assets/gauntlet/focus.jpg", text: "Whenever you overpay for a card by 2 or more, put an acceleration counter on this. Once per turn, you may remove an acceleration counter: target card gets +1 value until end of turn." },
    general: { name: "Hera", image: "/assets/gauntlet/hera.webp", text: "Once per turn: If you've played a card of a suit this turn, you may use a card of the same suit to pay 2 more than its value." },
    city: { name: "Constanti, Technology Hub", image: "/assets/gauntlet/constanti.webp", text: "Each turn, your first two attacks after the first that have a different suit from your previous attack get +1 value." }
  }
};

function listFactions() {
  return Object.values(factionsData);
}

function getFactionById(id) {
  return factionsData[id] || null;
}

const basicGameProfile = {
  id: "basic",
  name: "Basic Gauntlet",
  cardImage: null,
  commander: null,
  city: null,
  general: null
};

function getLobbyGameMode(roomState) {
  return roomState.lobby.gameMode === "basic" ? "basic" : "factions";
}

// ============ GAME STATE STORAGE ============
const rooms = new Map();
const matchmakingQueue = [];

function makeReconnectToken() {
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function createRoom() {
  const roomCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  const roomState = {
    roomCode,
    lobby: {
      gameMode: "factions",
      players: {
        1: { socket: null, connected: false, factionId: null, reconnectToken: null },
        2: { socket: null, connected: false, factionId: null, reconnectToken: null }
      },
      spectators: []
    },
    game: null,
    damageConfirmed: { 1: false, 2: false },
    ranked: false
  };
  rooms.set(roomCode, roomState);
  return roomState;
}

function removeFromMatchmaking(socketId) {
  const index = matchmakingQueue.findIndex((entry) => entry.socketId === socketId);
  if (index >= 0) matchmakingQueue.splice(index, 1);
}

function getMatchTolerance(waitMs) {
  return Math.min(1, 0.35 + Math.floor(waitMs / 20000) * 0.15);
}

function findMatchForEntry(entry) {
  const now = Date.now();
  let best = null;
  let bestScore = Infinity;

  for (const candidate of matchmakingQueue) {
    if (candidate.socketId === entry.socketId || candidate.accountId === entry.accountId) continue;
    const tolerance = Math.max(getMatchTolerance(now - entry.joinedAt), getMatchTolerance(now - candidate.joinedAt));
    const ratioGap = Math.abs(entry.winRatio - candidate.winRatio);
    if (ratioGap > tolerance) continue;
    const gamesGap = Math.abs(entry.gamesPlayed - candidate.gamesPlayed);
    const score = ratioGap + Math.min(gamesGap, 20) / 200;
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function createMatchedRoom(entryA, entryB) {
  const roomState = createRoom();
  roomState.ranked = true;
  const firstEntry = Math.random() < 0.5 ? entryA : entryB;
  const secondEntry = firstEntry === entryA ? entryB : entryA;
  const assignments = [
    { playerNum: 1, entry: firstEntry },
    { playerNum: 2, entry: secondEntry }
  ];

  for (const assignment of assignments) {
    const lobbyPlayer = roomState.lobby.players[assignment.playerNum];
    lobbyPlayer.reconnectToken = makeReconnectToken();
    lobbyPlayer.accountId = assignment.entry.accountId;
    lobbyPlayer.accountName = assignment.entry.accountName;
    lobbyPlayer.isGuest = false;
  }

  for (const assignment of assignments) {
    const playerSocket = io.sockets.sockets.get(assignment.entry.socketId);
    if (playerSocket) {
      attachPlayerSocket(roomState, playerSocket, assignment.playerNum);
      playerSocket.emit("matchmakingStatus", { inQueue: false, message: `Match found. Room ${roomState.roomCode}.` });
    }
  }

  emitLobbyState(roomState);
  return roomState;
}

function getRoom(roomCode) {
  return rooms.get(roomCode);
}

function deleteRoom(roomCode) {
  rooms.delete(roomCode);
}

function getRoomForSocket(socket) {
  for (const [code, room] of rooms) {
    if (room.lobby.players[1].socket === socket.id ||
        room.lobby.players[2].socket === socket.id ||
        room.lobby.spectators.includes(socket.id)) {
      return room;
    }
  }
  return null;
}

function sanitizeLobbyPlayer(player) {
  return {
    connected: player.connected,
    factionId: player.factionId,
    accountName: player.accountName || null,
    isGuest: !!player.isGuest,
    readyToStart: !!player.readyToStart,
    isAI: !!player.isAI
  };
}

function emitLobbyState(roomState) {
  io.to(roomState.roomCode).emit("lobbyState", {
    roomCode: roomState.roomCode,
    gameMode: getLobbyGameMode(roomState),
    players: {
      1: sanitizeLobbyPlayer(roomState.lobby.players[1]),
      2: sanitizeLobbyPlayer(roomState.lobby.players[2])
    },
    factions: listFactions(),
    spectatorCount: roomState.lobby.spectators.length
  });
}

function emitState(roomState) {
  if (!roomState.game) return;
  captureGameEvent(roomState.game);
  io.to(roomState.roomCode).emit("state", {
    ...roomState.game,
    spectatorCount: roomState.lobby.spectators.length
  });
}

function getOtherPlayer(playerNum) {
  return playerNum === 1 ? 2 : 1;
}

function getPlayerNumberBySocket(roomState, socketId) {
  if (roomState.lobby.players[1].socket === socketId) return 1;
  if (roomState.lobby.players[2].socket === socketId) return 2;
  return null;
}

async function getReconnectPlayerNumber(roomState, reconnectToken, authToken) {
  const account = await getAccountFromToken(authToken);
  for (const playerNum of [1, 2]) {
    const lobbyPlayer = roomState.lobby.players[playerNum];
    if (reconnectToken && lobbyPlayer.reconnectToken === reconnectToken) return playerNum;
    if (account?.id && lobbyPlayer.accountId === account.id) return playerNum;
  }
  return null;
}

function getDisconnectedSeatForIdentity(roomState, identity, reconnectToken) {
  for (const playerNum of [1, 2]) {
    const lobbyPlayer = roomState.lobby.players[playerNum];
    if (lobbyPlayer.socket) continue;
    if (reconnectToken && lobbyPlayer.reconnectToken === reconnectToken) return playerNum;
    if (identity.type === "account" && lobbyPlayer.accountId && lobbyPlayer.accountId === identity.id) return playerNum;
    if (identity.type === "guest" && lobbyPlayer.isGuest && lobbyPlayer.accountName === identity.name) return playerNum;
  }
  return null;
}

function attachPlayerSocket(roomState, socket, playerNum) {
  const lobbyPlayer = roomState.lobby.players[playerNum];
  lobbyPlayer.socket = socket.id;
  lobbyPlayer.connected = true;
  if (!lobbyPlayer.reconnectToken) lobbyPlayer.reconnectToken = makeReconnectToken();
  if (roomState.game?.players?.[playerNum]) roomState.game.players[playerNum].connected = true;

  socket.join(roomState.roomCode);
  socket.data.roomCode = roomState.roomCode;
  socket.data.role = "player";
  socket.data.playerNum = playerNum;

  socket.emit("assign", {
    role: "player",
    playerNum,
    roomCode: roomState.roomCode,
    reconnectToken: lobbyPlayer.reconnectToken
  });
}

function detachSocketFromRoom(roomState, socket, { leaveSocket = true } = {}) {
  for (const p of [1, 2]) {
    if (roomState.lobby.players[p].socket === socket.id) {
      roomState.lobby.players[p].connected = false;
      roomState.lobby.players[p].socket = null;
      if (roomState.game?.players?.[p]) roomState.game.players[p].connected = false;
    }
  }

  roomState.lobby.spectators = roomState.lobby.spectators.filter((socketId) => socketId !== socket.id);
  if (leaveSocket) socket.leave(roomState.roomCode);
  socket.data.roomCode = null;
  socket.data.role = null;
  socket.data.playerNum = null;

  if (roomState.game) emitState(roomState);
  else emitLobbyState(roomState);
}

function roomPlayersReady(roomState) {
  if (getLobbyGameMode(roomState) === "basic") {
    return roomState.lobby.players[1].socket && (roomState.lobby.players[2].socket || roomState.lobby.players[2].isAI);
  }
  return roomState.lobby.players[1].factionId && roomState.lobby.players[2].factionId;
}

function resetStartConfirmations(roomState) {
  for (const playerNum of [1, 2]) {
    roomState.lobby.players[playerNum].readyToStart = false;
  }
}

function playersConfirmedStart(roomState) {
  return [1, 2].every((playerNum) => roomState.lobby.players[playerNum].readyToStart || roomState.lobby.players[playerNum].isAI);
}

async function requirePlayerIdentity(socket, authToken, guestName) {
  const account = await getAccountFromToken(authToken || socket.data.authToken);
  if (account) {
    socket.data.authToken = authToken || socket.data.authToken;
    socket.data.account = account;
    return { type: "account", id: account.id, name: account.name };
  }

  const normalizedGuestName = normalizeGuestName(guestName);
  if (isValidGuestName(normalizedGuestName)) {
    return { type: "guest", id: null, name: normalizedGuestName };
  }

  socket.emit("errorMessage", "Sign in, create an account, or enter a 2-24 character guest name.");
  return null;
}

function resetPriorityPassed(game) {
  game.priorityPassed = { 1: false, 2: false };
}

function enterDamagePhase(game, message = "Damage phase. Click Resolve Damage.") {
  game.phase = "damage";
  game.message = message;
  return { 1: false, 2: false };
}

function captureGameEvent(game) {
  if (!game?.message) return;
  game.eventLog = Array.isArray(game.eventLog) ? game.eventLog : [];
  const last = game.eventLog[game.eventLog.length - 1];
  if (last && last.text === game.message && last.turn === game.turn && last.phase === game.phase) return;
  game.eventLog.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    turn: game.turn || 1,
    phase: game.phase || "setup",
    text: game.message,
    createdAt: new Date().toISOString()
  });
  if (game.eventLog.length > 300) game.eventLog = game.eventLog.slice(-300);
}

function describeCardValue(card, effectiveValue, notes = []) {
  const base = getBaseCardValue(card);
  const total = Number.isFinite(effectiveValue) ? effectiveValue : getCardCurrentValue(card);
  const valueText = total !== base ? `value ${base} -> ${total}` : `value ${total}`;
  const noteText = Array.isArray(notes) && notes.length > 0 ? `; ${notes.join(", ")}` : "";
  return `${card?.name || "card"} (${valueText}${noteText})`;
}

function createTurnData() {
  return {
    attacksDeclaredThisTurn: 0,
    blocksDeclaredThisTurn: 0,
    previousAttackSuit: null,
    previousPlayedValue: null,
    suitsPlayedThisTurn: [],
    ruminSharedSuitBuffsUsed: 0,
    biziDifferentSuitBuffsUsed: 0,
    meerusFreeAttackAvailable: false,
    beliHighCostAttackBuffAvailable: false,
    tangLifeGainUsed: false,
    ristusConsecutiveBuffUsed: false,
    poleaUsed: false,
    lafayetteUsed: false,
    focusBuffUsed: false,
    heraUsed: false
  };
}

function removeIndexesFromHandToDiscard(player, indexes) {
  const sorted = [...indexes].sort((a, b) => b - a);
  for (const idx of sorted) {
    if (idx >= 0 && idx < player.hand.length) {
      player.discard.push(player.hand[idx]);
      player.hand.splice(idx, 1);
    }
  }
}

function validateHandIndexes(player, indexes, excludedIndexes = []) {
  const rawIndexes = Array.isArray(indexes) ? indexes : [];
  const validIndexes = [];
  const seen = new Set();
  const excluded = new Set(Array.isArray(excludedIndexes) ? excludedIndexes : [excludedIndexes]);

  for (const rawIndex of rawIndexes) {
    const index = Number(rawIndex);
    if (!Number.isInteger(index) || index < 0 || index >= player.hand.length) {
      return { error: "Invalid payment card" };
    }
    if (excluded.has(index)) {
      return { error: "Selected card cannot also be payment" };
    }
    if (seen.has(index)) {
      return { error: "Duplicate payment card" };
    }
    seen.add(index);
    validIndexes.push(index);
  }

  return { indexes: validIndexes };
}

function removeSelectedCardsAndPayments(player, selectedIndexes, paymentIndexes) {
  const selectedCards = [];
  const removals = [
    ...selectedIndexes.map((index) => ({ index, role: "selected" })),
    ...paymentIndexes.map((index) => ({ index, role: "payment" }))
  ].sort((a, b) => b.index - a.index);

  for (const removal of removals) {
    const [card] = player.hand.splice(removal.index, 1);
    if (removal.role === "selected") selectedCards.unshift(card);
    else player.discard.push(card);
  }

  return selectedCards;
}

function removeSelectedCardAndPayments(player, selectedIndex, paymentIndexes) {
  return removeSelectedCardsAndPayments(player, [selectedIndex], paymentIndexes)[0] || null;
}

function registerCardPlayed(player, card) {
  const value = getBaseCardValue(card);
  if (card?.suit && !player.turnData.suitsPlayedThisTurn.includes(card.suit)) {
    player.turnData.suitsPlayedThisTurn.push(card.suit);
  }
  player.turnData.previousPlayedValue = value || null;
}

function applyPlayedCardBonuses(player, card) {
  const notes = [];
  const value = getBaseCardValue(card);

  if (
    player.faction?.id === "frumo" &&
    !player.turnData.ristusConsecutiveBuffUsed &&
    player.turnData.previousPlayedValue != null &&
    Math.abs(value - player.turnData.previousPlayedValue) === 1
  ) {
    card.tempBuff = (card.tempBuff || 0) + 2;
    player.turnData.ristusConsecutiveBuffUsed = true;
    notes.push("Ristus +2 consecutive value");
  }

  registerCardPlayed(player, card);
  return notes;
}

function getCardCurrentValue(card) {
  return getBaseCardValue(card) + (card?.tempBuff || 0);
}

function clearCardBuff(card) {
  if (card && card.tempBuff) delete card.tempBuff;
}

function clearEndTurnBuffs(game) {
  for (const p of [1, 2]) {
    const player = game.players[p];
    player.hand.forEach(clearCardBuff);
    player.deck.forEach(clearCardBuff);
    player.discard.forEach(clearCardBuff);
  }
  game.lanes.forEach((lane) => {
    clearCardBuff(lane.facedown[1]);
    clearCardBuff(lane.facedown[2]);
    clearCardBuff(lane.attack?.card);
    lane.block.forEach((block) => clearCardBuff(block.card));
  });
  game.handAttacks.forEach((attack) => {
    clearCardBuff(attack.card);
    attack.block.forEach((block) => clearCardBuff(block.card));
  });
}

function calculateAttackBonuses(player, card) {
  const notes = [];
  let value = 0;
  const attackNumber = player.turnData.attacksDeclaredThisTurn + 1;
  const cardBaseValue = getBaseCardValue(card);

  if (player.faction?.id === "rumin") {
    if (attackNumber === 4) {
      value += 3;
      notes.push("Kaiser fourth attack +3");
    }
    if (
      attackNumber > 1 &&
      player.turnData.ruminSharedSuitBuffsUsed < 2 &&
      player.turnData.previousAttackSuit === card.suit
    ) {
      value += 1;
      player.turnData.ruminSharedSuitBuffsUsed += 1;
      notes.push("Rumie shared suit +1");
    }
  }

  if (player.faction?.id === "sheen" && player.turnData.beliHighCostAttackBuffAvailable && cardBaseValue >= 10) {
    value += 2;
    player.turnData.beliHighCostAttackBuffAvailable = false;
    notes.push("Beli high-cost attack +2");
  }

  if (
    player.faction?.id === "bizi" &&
    attackNumber > 1 &&
    player.turnData.biziDifferentSuitBuffsUsed < 2 &&
    player.turnData.previousAttackSuit &&
    player.turnData.previousAttackSuit !== card.suit
  ) {
    value += 1;
    player.turnData.biziDifferentSuitBuffsUsed += 1;
    notes.push("Constanti different suit +1");
  }

  return { value, notes };
}

function getAttackPaymentRequirement(player, card) {
  const attackNumber = player.turnData.attacksDeclaredThisTurn + 1;
  const required = getBaseCardValue(card);

  if (
    player.faction?.id === "rumin" &&
    attackNumber === 3 &&
    player.turnData.meerusFreeAttackAvailable &&
    required <= 3
  ) {
    return { required: 0, freeAttackUsed: true };
  }

  return { required, freeAttackUsed: false };
}

function getPaymentTotal(player, paymentIndexes, useHeraBonus) {
  let total = 0;
  const paymentCards = paymentIndexes.map((idx) => player.hand[idx]).filter(Boolean);
  for (const idx of paymentIndexes) {
    if (player.hand[idx]) total += getBaseCardValue(player.hand[idx]);
  }
  let heraUsedNow = false;
  const hasHeraPaymentCard = paymentCards.some((card) => player.turnData.suitsPlayedThisTurn.includes(card.suit));
  if (
    useHeraBonus &&
    player.faction?.id === "bizi" &&
    !player.turnData.heraUsed &&
    player.turnData.suitsPlayedThisTurn.length > 0 &&
    hasHeraPaymentCard
  ) {
    total += 2;
    heraUsedNow = true;
  }
  return { total, heraUsedNow };
}

function finalizeAttackDeclaration(player, card, attackBonus, freeUsed) {
  const playedNotes = applyPlayedCardBonuses(player, card);
  let effectiveValue = getCardCurrentValue(card) + (attackBonus.value || 0);
  const notes = [...playedNotes, ...attackBonus.notes];
  if (freeUsed) notes.push("Meerus free attack");
  player.turnData.attacksDeclaredThisTurn++;
  player.turnData.previousAttackSuit = card?.suit;
  if (player.faction?.id === "rumin" && player.turnData.attacksDeclaredThisTurn === 2) {
    player.turnData.meerusFreeAttackAvailable = true;
  }
  if (player.faction?.id === "rumin" && player.turnData.attacksDeclaredThisTurn >= 3) {
    player.turnData.meerusFreeAttackAvailable = false;
  }
  return { effectiveValue, notes };
}

function applyBlockBonuses(player, card) {
  const playedNotes = applyPlayedCardBonuses(player, card);
  let effectiveValue = getCardCurrentValue(card);
  const notes = [...playedNotes];
  const faction = player.faction?.id;
  if (faction === "sheen") {
    effectiveValue += 1;
    notes.push("Emperor Nu +1");
    if (player.turnData.blocksDeclaredThisTurn >= 2) {
      effectiveValue += 1;
      notes.push("Emperor Nu third block +2");
    }
  }
  return { effectiveValue, notes };
}

function finalizeBlockDeclaration(player) {
  player.turnData.blocksDeclaredThisTurn++;
  if (player.faction?.id === "sheen" && player.turnData.blocksDeclaredThisTurn === 2) {
    if (!player.turnData.tangLifeGainUsed) {
      player.life += 2;
      player.turnData.tangLifeGainUsed = true;
    }
    player.turnData.beliHighCostAttackBuffAvailable = true;
  }
}

function addAccelerationIfOverpaid(player, paid, required) {
  if (player.faction?.id === "bizi" && paid - required >= 2) {
    player.accelerationCounters = (player.accelerationCounters || 0) + 1;
  }
}

function hasPendingAttacks(game) {
  return (game.handAttacks && game.handAttacks.length > 0) ||
    (game.lanes && game.lanes.some(l => l.attack));
}

function getControlledTargetCard(game, playerNum, targetType, lane, handAttackId) {
  const laneIndex = Number(lane);

  if (targetType === "laneCard") {
    if (!Number.isInteger(laneIndex) || laneIndex < 0 || laneIndex >= game.lanes.length) return null;
    return game.lanes[laneIndex].facedown[playerNum] || null;
  }

  if (targetType === "laneAttack") {
    if (!Number.isInteger(laneIndex) || laneIndex < 0 || laneIndex >= game.lanes.length) return null;
    const attack = game.lanes[laneIndex].attack;
    return attack?.player === playerNum ? attack.card : null;
  }

  if (targetType === "handAttack") {
    const attack = game.handAttacks.find((a) => a.id === handAttackId);
    return attack?.player === playerNum ? attack.card : null;
  }

  return null;
}

function canUsePriorityAbility(socket, game, playerNum, expectedFaction) {
  if (game.phase !== "priority") {
    socket.emit("errorMessage", "Not in priority phase");
    return false;
  }
  if (game.priority !== playerNum) {
    socket.emit("errorMessage", "Not your priority");
    return false;
  }
  if (game.players[playerNum].faction?.id !== expectedFaction) {
    socket.emit("errorMessage", "Wrong faction for this ability");
    return false;
  }
  return true;
}

function getBaseCardValue(card) {
  if (!card) return 0;
  const value = card.value;
  if (value === "A" || value === 14 || value === "14") return 14;
  if (value === "K" || value === 13 || value === "13") return 13;
  if (value === "Q" || value === 12 || value === "12") return 12;
  if (value === "J" || value === 11 || value === "11") return 11;
  return Number(value) || 0;
}

function applyGameOverState(game) {
  const p1Life = game.players[1].life;
  const p2Life = game.players[2].life;

  if (p1Life > 0 && p2Life > 0) return false;

  game.phase = "gameOver";
  if (p1Life === p2Life) {
    game.winner = null;
    game.message = `End of turn life check: both players are tied at ${p1Life}. Game Over - Draw!`;
  } else {
    game.winner = p1Life > p2Life ? 1 : 2;
    game.message = `End of turn life check: Player ${game.winner} has the higher life total and wins!`;
  }

  return true;
}

async function recordFinalGameStats(roomState) {
  const game = roomState.game;
  if (!game || game.statsRecorded) return;
  if (game.phase !== "gameOver") return;
  if (roomState.ranked === false || isTrainingAiRoom(roomState)) {
    game.statsRecorded = true;
    return;
  }

  if (game.winner == null) {
    await recordAccountGameResult(roomState.lobby.players[1].accountId, "draw");
    await recordAccountGameResult(roomState.lobby.players[2].accountId, "draw");
  } else {
    const loser = getOtherPlayer(game.winner);
    await recordAccountGameResult(roomState.lobby.players[game.winner].accountId, "win");
    await recordAccountGameResult(roomState.lobby.players[loser].accountId, "loss");
  }

  game.statsRecorded = true;
}

function resolveDamage(game, roomState) {
  const damageMessages = [];

  for (const attack of game.handAttacks) {
    let totalBlock = 0;
    for (const block of attack.block) {
      totalBlock += block.effectiveValue || 0;
    }
    const damage = Math.max(0, (attack.effectiveValue || 0) - totalBlock);
    const defender = getOtherPlayer(attack.player);
    const blockedText = totalBlock > 0 ? ` after ${totalBlock} block` : "";
    if (damage > 0) {
      game.players[defender].life -= damage;
      damageMessages.push(`Hand attack ${describeCardValue(attack.card, attack.effectiveValue, attack.notes)}${blockedText} = ${damage} damage to Player ${defender}`);
    } else {
      damageMessages.push(`Hand attack ${describeCardValue(attack.card, attack.effectiveValue, attack.notes)} was fully blocked by ${totalBlock}`);
    }

    game.players[attack.player].discard.push(attack.card);
    for (const block of attack.block) {
      game.players[block.player].discard.push(block.card);
    }
  }
  
  for (let i = 0; i < game.lanes.length; i++) {
    const lane = game.lanes[i];
    if (lane.attack) {
      let totalBlock = 0;
      for (const block of lane.block) {
        totalBlock += block.effectiveValue || 0;
      }
      const damage = Math.max(0, (lane.attack.effectiveValue || 0) - totalBlock);
      const defender = getOtherPlayer(lane.attack.player);
      const blockedText = totalBlock > 0 ? ` after ${totalBlock} block` : "";
      if (damage > 0) {
        game.players[defender].life -= damage;
        damageMessages.push(`Lane ${i + 1} attack ${describeCardValue(lane.attack.card, lane.attack.effectiveValue, lane.attack.notes)}${blockedText} = ${damage} damage to Player ${defender}`);
      } else {
        damageMessages.push(`Lane ${i + 1} attack ${describeCardValue(lane.attack.card, lane.attack.effectiveValue, lane.attack.notes)} was fully blocked by ${totalBlock}`);
      }
      game.players[lane.attack.player].discard.push(lane.attack.card);
      for (const block of lane.block) {
        game.players[block.player].discard.push(block.card);
      }
      lane.attack = null;
      lane.block = [];
    }
  }
  
  game.handAttacks = [];
  roomState.damageConfirmed = { 1: false, 2: false };
  if (damageMessages.length > 0) {
    game.message = damageMessages.join(" ");
    captureGameEvent(game);
  }
}

function startEndPhase(game) {
  game.phase = "end";
  game.endPlacementLaneIndex = 0;
  game.endPlacementFirstPlayer = game.startingPriorityThisTurn;
  game.endPlacementStep = 0;
  game.endPlaced = { 1: [false, false, false], 2: [false, false, false] };
  game.message = "End of Turn Phase - Place facedown cards in lanes";
}

async function advanceEndPlacement(roomState) {
  const game = roomState.game;
  game.endPlacementStep++;
  
  if (game.endPlacementStep >= 2) {
    game.endPlacementLaneIndex++;
    game.endPlacementStep = 0;
  }
  
  if (game.endPlacementLaneIndex >= 3) {
    for (const p of [1, 2]) {
      const player = game.players[p];
      while (player.hand.length < 8 && player.deck.length > 0) {
        player.hand.push(player.deck.pop());
      }
    }

    if (applyGameOverState(game)) {
      await recordFinalGameStats(roomState);
      io.to(roomState.roomCode).emit("gameEnded", { winner: game.winner, tie: game.winner == null });
      return;
    }
    
    game.phase = "priority";
    game.turn++;
    game.priority = getOtherPlayer(game.startingPriorityThisTurn);
    game.startingPriorityThisTurn = game.priority;
    game.lastActivePlayer = game.priority;
    game.mostRecentAttackDefender = null;
    resetPriorityPassed(game);
    
    clearEndTurnBuffs(game);
    for (const p of [1, 2]) {
      game.players[p].turnData = createTurnData();
    }
    game.message = `Turn ${game.turn} - Player ${game.priority} has priority`;
  }
}

function isTrainingAiRoom(roomState) {
  return !!roomState?.lobby?.players?.[2]?.isAI;
}

function getCurrentEndPlacementPlayer(game) {
  return game.endPlacementStep === 0 ? game.endPlacementFirstPlayer : getOtherPlayer(game.endPlacementFirstPlayer);
}

function findAiPaymentIndexes(hand, required, excludedIndexes = []) {
  const excluded = new Set(excludedIndexes);
  const candidates = hand
    .map((card, index) => ({ card, index, value: getBaseCardValue(card) }))
    .filter((entry) => !excluded.has(entry.index))
    .sort((a, b) => a.value - b.value);
  const indexes = [];
  let total = 0;
  for (const candidate of candidates) {
    indexes.push(candidate.index);
    total += candidate.value;
    if (total >= required) return indexes;
  }
  return null;
}

function declareAiHandAttack(roomState) {
  const game = roomState.game;
  const ai = game.players[2];
  const options = ai.hand
    .map((card, index) => ({ card, index, value: getBaseCardValue(card) }))
    .sort((a, b) => a.value - b.value);

  for (const option of options) {
    const paymentIndexes = findAiPaymentIndexes(ai.hand, option.value, [option.index]);
    if (!paymentIndexes) continue;

    const attackCard = ai.hand[option.index];
    const paymentTotal = getPaymentTotal(ai, paymentIndexes, false).total;
    removeSelectedCardAndPayments(ai, option.index, paymentIndexes);
    addAccelerationIfOverpaid(ai, paymentTotal, option.value);
    const attackInfo = finalizeAttackDeclaration(ai, attackCard, calculateAttackBonuses(ai, attackCard), false);
    const attack = {
      id: `attack-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      player: 2,
      card: attackCard,
      source: "hand",
      effectiveValue: attackInfo.effectiveValue,
      block: [],
      notes: attackInfo.notes
    };

    game.handAttacks.push(attack);
    resetPriorityPassed(game);
    game.priority = 1;
    game.mostRecentAttackDefender = 1;
    game.message = `Training AI attacked with ${describeCardValue(attackCard, attackInfo.effectiveValue, attackInfo.notes)} from hand. Player 1 can block or pass.`;
    return true;
  }

  return false;
}

async function aiResolveDamageIfReady(roomState) {
  const game = roomState.game;
  if (game.phase !== "damage") return false;
  roomState.damageConfirmed = roomState.damageConfirmed || { 1: false, 2: false };
  if (roomState.damageConfirmed[2] && !roomState.damageConfirmed[1]) return false;
  roomState.damageConfirmed[2] = true;
  if (!roomState.damageConfirmed[1]) {
    game.message = "Training AI confirmed damage. Player 1 can resolve damage.";
    return true;
  }

  resolveDamage(game, roomState);
  game.phase = "priority";
  game.priority = game.mostRecentAttackDefender || getOtherPlayer(game.priority);
  game.lastActivePlayer = game.priority;
  game.mostRecentAttackDefender = null;
  resetPriorityPassed(game);
  game.message = `Damage resolved. Player ${game.priority} has priority. Life totals will be checked at end of turn.`;
  return true;
}

function aiPassPriority(roomState) {
  const game = roomState.game;
  game.priorityPassed[2] = true;
  game.message = "Training AI passed priority.";

  if (game.priorityPassed[1] && game.priorityPassed[2]) {
    if (hasPendingAttacks(game)) {
      roomState.damageConfirmed = enterDamagePhase(game, "Both players passed - damage phase. Training AI is ready.");
      roomState.damageConfirmed[2] = true;
    } else {
      startEndPhase(game);
    }
    resetPriorityPassed(game);
  } else {
    game.priority = 1;
  }
}

function getPendingAttackList(game) {
  return [
    ...(game.handAttacks || []),
    ...(game.lanes || []).map((lane) => lane.attack).filter(Boolean)
  ];
}

function aiNeedsLaneSetup(game) {
  const ai = game.players[2];
  return ai.hand.length > 0 && game.lanes.some((lane) => !lane.facedown[2]);
}

async function aiEndPlacement(roomState) {
  const game = roomState.game;
  const ai = game.players[2];
  const lane = game.endPlacementLaneIndex;
  if (game.phase !== "end" || getCurrentEndPlacementPlayer(game) !== 2) return false;

  if (!game.lanes[lane].facedown[2] && ai.hand.length > 0) {
    const card = ai.hand.splice(0, 1)[0];
    game.lanes[lane].facedown[2] = card;
    game.endPlaced[2][lane] = true;
    game.message = `Training AI placed a face-down card in lane ${lane + 1}.`;
  } else {
    game.endPlaced[2][lane] = true;
    game.message = `Training AI skipped lane ${lane + 1}.`;
  }

  await advanceEndPlacement(roomState);
  return true;
}

async function runTrainingAi(roomState) {
  if (!isTrainingAiRoom(roomState) || !roomState.game || roomState.game.phase === "gameOver") return;
  const game = roomState.game;
  let acted = false;

  if (game.phase === "damage") {
    acted = await aiResolveDamageIfReady(roomState);
  } else if (game.phase === "end") {
    acted = await aiEndPlacement(roomState);
  } else if (game.phase === "priority" && game.priority === 2) {
    const pendingAttacks = getPendingAttackList(game);
    const humanStillDefendingAiAttack = pendingAttacks.some((attack) => attack.player === 2 && !(game.priorityPassed?.[1]) && (!attack.block || attack.block.length === 0));
    if (humanStillDefendingAiAttack) {
      game.priority = 1;
      game.message = "Player 1 can block or pass.";
      acted = true;
    } else if (pendingAttacks.length > 0 || aiNeedsLaneSetup(game)) {
      aiPassPriority(roomState);
      acted = true;
    } else {
      acted = declareAiHandAttack(roomState);
      if (!acted) {
        aiPassPriority(roomState);
        acted = true;
      }
    }
  }

  if (acted) {
    emitState(roomState);
    scheduleTrainingAi(roomState);
  }
}

function scheduleTrainingAi(roomState) {
  if (!isTrainingAiRoom(roomState) || roomState.aiMoveTimer) return;
  roomState.aiMoveTimer = setTimeout(() => {
    roomState.aiMoveTimer = null;
    runTrainingAi(roomState).catch((error) => console.error("[TrainingAI] Failed", error));
  }, 650);
}

function createGameFromLobby(roomState) {
  const gameMode = getLobbyGameMode(roomState);
  const faction1 = gameMode === "basic" ? basicGameProfile : getFactionById(roomState.lobby.players[1].factionId);
  const faction2 = gameMode === "basic" ? basicGameProfile : getFactionById(roomState.lobby.players[2].factionId);
  const startingPriority = Math.random() < 0.5 ? 1 : 2;
  
  const suits = ["♠", "♥", "♦", "♣"];
  const values = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const rankNames = { 11: "J", 12: "Q", 13: "K", 14: "A" };
  
  function createDeck(faction) {
    const deck = [];
    for (const suit of suits) {
      for (const value of values) {
        deck.push({
          id: `card-${Math.random().toString(36).slice(2)}-${Date.now()}`,
          value: value,
          suit: suit,
          name: `${rankNames[value] || value} of ${suit}`,
          rank: rankNames[value] || String(value),
          faction: faction.name,
          factionId: faction.id,
          image: faction.cardImage
        });
      }
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }
  
  const game = {
    roomCode: roomState.roomCode,
    gameMode,
    phase: "priority",
    turn: 1,
    priority: startingPriority,
    startingPriorityThisTurn: startingPriority,
    lastActivePlayer: startingPriority,
    mostRecentAttackDefender: null,
    priorityPassed: { 1: false, 2: false },
    players: {
      1: {
        accountName: roomState.lobby.players[1].accountName || null,
        faction: faction1,
        life: 42,
        hand: [],
        deck: createDeck(faction1),
        discard: [],
        lanes: [null, null, null],
        connected: true,
        turnData: createTurnData(),
        accelerationCounters: 0
      },
      2: {
        accountName: roomState.lobby.players[2].accountName || null,
        faction: faction2,
        life: 42,
        hand: [],
        deck: createDeck(faction2),
        discard: [],
        lanes: [null, null, null],
        connected: true,
        turnData: createTurnData(),
        accelerationCounters: 0
      }
    },
    lanes: [
      { facedown: { 1: null, 2: null }, attack: null, block: [] },
      { facedown: { 1: null, 2: null }, attack: null, block: [] },
      { facedown: { 1: null, 2: null }, attack: null, block: [] }
    ],
    handAttacks: [],
    endPlacementLaneIndex: 0,
    endPlacementFirstPlayer: null,
    endPlacementStep: 0,
    endPlaced: { 1: [false, false, false], 2: [false, false, false] },
    winner: null,
    drawOfferBy: null,
    message: `Turn 1 - Player ${startingPriority} starts with priority`,
    eventLog: []
  };
  
  for (const p of [1, 2]) {
    for (let i = 0; i < 8; i++) {
      if (game.players[p].deck.length > 0) {
        game.players[p].hand.push(game.players[p].deck.pop());
      }
    }
  }
  
  roomState.game = game;
  roomState.damageConfirmed = { 1: false, 2: false };
}

// ============ SOCKET HANDLERS ============
io.on("connection", (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  socket.on("joinMatchmaking", async ({ authToken } = {}) => {
    console.log("[Socket] joinMatchmaking");
    const account = await getAccountRecordFromToken(authToken || socket.data.authToken);
    if (!account) {
      socket.emit("matchmakingStatus", { inQueue: false, message: "Sign in to use matchmaking." });
      return;
    }
    if (socket.data.roomCode) {
      socket.emit("matchmakingStatus", { inQueue: false, message: "Leave your current room before entering matchmaking." });
      return;
    }

    removeFromMatchmaking(socket.id);
    const profile = getAccountMatchProfile(account);
    const entry = {
      socketId: socket.id,
      accountId: account.id,
      accountName: account.name,
      winRatio: profile.winRatio,
      gamesPlayed: profile.gamesPlayed,
      joinedAt: Date.now()
    };

    const match = findMatchForEntry(entry);
    if (match) {
      removeFromMatchmaking(match.socketId);
      createMatchedRoom(entry, match);
      return;
    }

    matchmakingQueue.push(entry);
    socket.data.authToken = authToken || socket.data.authToken;
    socket.emit("matchmakingStatus", {
      inQueue: true,
      message: `Searching for a similar record... ${matchmakingQueue.length} player${matchmakingQueue.length === 1 ? "" : "s"} in queue.`,
      queueSize: matchmakingQueue.length
    });
  });

  socket.on("leaveMatchmaking", () => {
    removeFromMatchmaking(socket.id);
    socket.emit("matchmakingStatus", { inQueue: false, message: "Left matchmaking queue." });
  });
  
  socket.on("createRoom", async ({ authToken, guestName } = {}) => {
    console.log("[Socket] createRoom");
    removeFromMatchmaking(socket.id);
    const identity = await requirePlayerIdentity(socket, authToken, guestName);
    if (!identity) return;
    const roomState = createRoom();
    roomState.lobby.players[1].socket = socket.id;
    roomState.lobby.players[1].connected = true;
    roomState.lobby.players[1].reconnectToken = makeReconnectToken();
    roomState.lobby.players[1].accountId = identity.id;
    roomState.lobby.players[1].accountName = identity.name;
    roomState.lobby.players[1].isGuest = identity.type === "guest";
    await touchAccountStats(identity.id, "gamesCreated");
    attachPlayerSocket(roomState, socket, 1);
    emitLobbyState(roomState);
  });

  socket.on("createAiTutorialRoom", async ({ authToken, guestName } = {}) => {
    console.log("[Socket] createAiTutorialRoom");
    removeFromMatchmaking(socket.id);
    const identity = await requirePlayerIdentity(socket, authToken, guestName);
    if (!identity) return;

    const roomState = createRoom();
    roomState.lobby.gameMode = "basic";
    roomState.lobby.players[1].socket = socket.id;
    roomState.lobby.players[1].connected = true;
    roomState.lobby.players[1].reconnectToken = makeReconnectToken();
    roomState.lobby.players[1].accountId = identity.id;
    roomState.lobby.players[1].accountName = identity.name;
    roomState.lobby.players[1].isGuest = identity.type === "guest";
    roomState.lobby.players[2].connected = true;
    roomState.lobby.players[2].accountId = null;
    roomState.lobby.players[2].accountName = "Training AI";
    roomState.lobby.players[2].isGuest = false;
    roomState.lobby.players[2].isAI = true;
    await touchAccountStats(identity.id, "gamesCreated");
    attachPlayerSocket(roomState, socket, 1);
    createGameFromLobby(roomState);
    roomState.game.players[2].connected = true;
    roomState.game.players[2].accountName = "Training AI";
    roomState.game.message = `Tutorial game started. Player ${roomState.game.priority} has priority.`;
    emitState(roomState);
    scheduleTrainingAi(roomState);
  });

  socket.on("joinRoom", async ({ roomCode, asSpectator = false, authToken, guestName, reconnectToken } = {}) => {
    console.log(`[Socket] joinRoom: ${roomCode}, spectator: ${asSpectator}`);
    removeFromMatchmaking(socket.id);
    if (!roomCode) {
      socket.emit("errorMessage", "Enter a room code.");
      return;
    }
    const normalized = roomCode.toUpperCase();
    const roomState = getRoom(normalized);
    if (!roomState) {
      socket.emit("errorMessage", "Room not found.");
      return;
    }
    if (asSpectator) {
      roomState.lobby.spectators.push(socket.id);
      socket.join(normalized);
      socket.data.roomCode = normalized;
      socket.data.role = "spectator";
      socket.emit("assignSpectator", { role: "spectator", roomCode: normalized });
      const spectatorAccount = await getAccountFromToken(authToken);
      if (spectatorAccount) await touchAccountStats(spectatorAccount.id, "gamesSpectated");
      if (roomState.game) emitState(roomState);
      else emitLobbyState(roomState);
      return;
    }
    const identity = await requirePlayerIdentity(socket, authToken, guestName);
    if (!identity) return;
    const reconnectSeat = getDisconnectedSeatForIdentity(roomState, identity, reconnectToken);
    if (reconnectSeat) {
      attachPlayerSocket(roomState, socket, reconnectSeat);
      if (roomState.game) emitState(roomState);
      else emitLobbyState(roomState);
      return;
    }
    if (!roomState.lobby.players[2].socket && !roomState.lobby.players[2].reconnectToken) {
      roomState.lobby.players[2].reconnectToken = makeReconnectToken();
      roomState.lobby.players[2].accountId = identity.id;
      roomState.lobby.players[2].accountName = identity.name;
      roomState.lobby.players[2].isGuest = identity.type === "guest";
      await touchAccountStats(identity.id, "gamesJoined");
      attachPlayerSocket(roomState, socket, 2);
      emitLobbyState(roomState);
      return;
    }
    socket.emit("errorMessage", "Room is full. Join as spectator instead.");
  });

  socket.on("reconnectToRoom", async ({ roomCode, reconnectToken, authToken, role } = {}) => {
    console.log(`[Socket] reconnectToRoom: ${roomCode}`);
    if (!roomCode) {
      socket.emit("errorMessage", "No room to reconnect to.");
      return;
    }

    const normalized = String(roomCode).toUpperCase();
    const roomState = getRoom(normalized);
    if (!roomState) {
      socket.emit("errorMessage", "That room is no longer active.");
      return;
    }

    const playerNum = await getReconnectPlayerNumber(roomState, reconnectToken, authToken);
    if (playerNum) {
      attachPlayerSocket(roomState, socket, playerNum);
      if (roomState.game) emitState(roomState);
      else emitLobbyState(roomState);
      return;
    }

    const requestedRole = role || socket.data.role;
    if (requestedRole === "spectator") {
      if (!roomState.lobby.spectators.includes(socket.id)) roomState.lobby.spectators.push(socket.id);
      socket.join(normalized);
      socket.data.roomCode = normalized;
      socket.data.role = "spectator";
      socket.emit("assignSpectator", { role: "spectator", roomCode: normalized });
      if (roomState.game) emitState(roomState);
      else emitLobbyState(roomState);
      return;
    }

    socket.emit("errorMessage", "Could not reconnect to that player seat.");
  });

  socket.on("selectFaction", ({ factionId }) => {
    console.log(`[Socket] selectFaction: ${factionId}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState || roomState.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    if (getLobbyGameMode(roomState) === "basic") {
      socket.emit("errorMessage", "Basic Mode does not use factions.");
      return;
    }
    if (!getFactionById(factionId)) {
      socket.emit("errorMessage", "Choose a valid faction.");
      return;
    }
    roomState.lobby.players[playerNum].factionId = factionId;
    resetStartConfirmations(roomState);
    emitLobbyState(roomState);
  });

  socket.on("setGameMode", ({ mode } = {}) => {
    console.log(`[Socket] setGameMode: ${mode}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState || roomState.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (playerNum !== 1) {
      socket.emit("errorMessage", "Only Player 1 can set the room mode.");
      return;
    }
    const nextMode = mode === "basic" ? "basic" : "factions";
    roomState.lobby.gameMode = nextMode;
    resetStartConfirmations(roomState);
    if (nextMode === "basic") {
      roomState.lobby.players[1].factionId = null;
      roomState.lobby.players[2].factionId = null;
    }
    emitLobbyState(roomState);
  });

  socket.on("startGame", () => {
    console.log(`[Socket] startGame`);
    const roomState = getRoomForSocket(socket);
    if (!roomState || roomState.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    if (!roomPlayersReady(roomState)) {
      socket.emit("errorMessage", getLobbyGameMode(roomState) === "basic" ? "Both player seats must be filled first." : "Both players must select a faction first.");
      return;
    }
    roomState.lobby.players[playerNum].readyToStart = true;
    if (!playersConfirmedStart(roomState)) {
      emitLobbyState(roomState);
      socket.emit("errorMessage", `Player ${getOtherPlayer(playerNum)} must also confirm start.`);
      return;
    }
    createGameFromLobby(roomState);
    emitState(roomState);
    scheduleTrainingAi(roomState);
  });

  socket.on("passPriority", () => {
    console.log(`[Socket] passPriority`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    
    if (game.phase !== "priority") {
      socket.emit("errorMessage", "Not in priority phase");
      return;
    }
    if (game.priority !== playerNum) {
      socket.emit("errorMessage", "Not your priority to pass");
      return;
    }
    
    game.priorityPassed[playerNum] = true;
    const passingAsBasicDefender =
      game.gameMode === "basic" &&
      getPendingAttackList(game).some((attack) => attack.player === getOtherPlayer(playerNum) && (!attack.block || attack.block.length === 0));
    if (passingAsBasicDefender) {
      roomState.damageConfirmed = enterDamagePhase(game, `Player ${playerNum} chose not to block. Resolve damage.`);
      emitState(roomState);
      scheduleTrainingAi(roomState);
      return;
    }

    game.message = `Player ${playerNum} passed priority (P1: ${game.priorityPassed[1] ? "✓" : "○"}, P2: ${game.priorityPassed[2] ? "✓" : "○"})`;
    
    if (game.priorityPassed[1] && game.priorityPassed[2]) {
      if (hasPendingAttacks(game)) {
        roomState.damageConfirmed = enterDamagePhase(game, "Both players passed - damage phase. Click Resolve Damage.");
      } else {
        startEndPhase(game);
      }
      resetPriorityPassed(game);
    } else {
      game.priority = getOtherPlayer(playerNum);
    }
    
    emitState(roomState);
    scheduleTrainingAi(roomState);
  });

  socket.on("resolveDamage", async () => {
    console.log(`[Socket] resolveDamage`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    
    if (game.phase !== "damage") {
      socket.emit("errorMessage", "Not in damage phase");
      return;
    }
    
    roomState.damageConfirmed[playerNum] = true;
    game.message = `Player ${playerNum} confirmed damage (${roomState.damageConfirmed[1] ? "✓" : "○"} ${roomState.damageConfirmed[2] ? "✓" : "○"})`;
    emitState(roomState);
    scheduleTrainingAi(roomState);
    
    if (roomState.damageConfirmed[1] && roomState.damageConfirmed[2]) {
      console.log("[resolveDamage] Both confirmed - resolving");
      resolveDamage(game, roomState);
      game.phase = "priority";
      game.priority = game.mostRecentAttackDefender || getOtherPlayer(game.priority);
      game.lastActivePlayer = game.priority;
      game.mostRecentAttackDefender = null;
      resetPriorityPassed(game);
      game.message = `Damage resolved. Player ${game.priority} has priority. Life totals will be checked at end of turn.`;
      
      emitState(roomState);
      scheduleTrainingAi(roomState);
    }
  });

  socket.on("concedeGame", async () => {
    console.log("[Socket] concedeGame");
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;

    if (game.phase === "gameOver") {
      socket.emit("errorMessage", "Game is already over");
      return;
    }

    const winner = getOtherPlayer(playerNum);
    game.phase = "gameOver";
    game.winner = winner;
    game.drawOfferBy = null;
    game.message = `Player ${playerNum} conceded. Player ${winner} wins!`;
    await recordFinalGameStats(roomState);
    io.to(roomState.roomCode).emit("gameEnded", { winner, tie: false, concededBy: playerNum });
    emitState(roomState);
    scheduleTrainingAi(roomState);
  });

  socket.on("offerDraw", async () => {
    console.log("[Socket] offerDraw");
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;

    if (game.phase === "gameOver") {
      socket.emit("errorMessage", "Game is already over");
      return;
    }

    if (game.drawOfferBy && game.drawOfferBy !== playerNum) {
      game.phase = "gameOver";
      game.winner = null;
      game.drawOfferBy = null;
      game.message = "Players agreed to an intentional draw.";
      await recordFinalGameStats(roomState);
      io.to(roomState.roomCode).emit("gameEnded", { winner: null, tie: true, intentionalDraw: true });
      emitState(roomState);
      return;
    }

    if (game.drawOfferBy === playerNum) {
      socket.emit("errorMessage", "You already offered an intentional draw");
      return;
    }

    game.drawOfferBy = playerNum;
    game.message = `Player ${playerNum} offered an intentional draw. Player ${getOtherPlayer(playerNum)} may accept.`;
    emitState(roomState);
    scheduleTrainingAi(roomState);
  });

  socket.on("confirmAttack", ({ from, lane, attackCardIndex, paymentIndexes, useHeraBonus }) => {
    console.log(`[Socket] confirmAttack: from=${from}, lane=${lane}, idx=${attackCardIndex}, payments=${paymentIndexes}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];
    
    if (game.phase !== "priority") {
      socket.emit("errorMessage", "Not in priority phase");
      return;
    }
    if (game.priority !== playerNum) {
      socket.emit("errorMessage", "Not your priority to attack");
      return;
    }
    if (hasPendingAttacks(game)) {
      socket.emit("errorMessage", "Resolve current attacks and damage before declaring another attack");
      return;
    }
    if (from !== "hand" && from !== "lane") {
      socket.emit("errorMessage", "Invalid attack source");
      return;
    }

    const selectedAttackIndex = Number(attackCardIndex);
    const laneIndex = Number(lane);
    let attackCard;
    let paymentValidation;

    if (from === "hand") {
      if (!Number.isInteger(selectedAttackIndex) || !player.hand[selectedAttackIndex]) {
        socket.emit("errorMessage", "Invalid attack card");
        return;
      }
      attackCard = player.hand[selectedAttackIndex];
      paymentValidation = validateHandIndexes(player, paymentIndexes, [selectedAttackIndex]);
    } else {
      if (!Number.isInteger(laneIndex) || laneIndex < 0 || laneIndex >= game.lanes.length) {
        socket.emit("errorMessage", "Invalid lane");
        return;
      }
      if (game.lanes[laneIndex].attack) {
        socket.emit("errorMessage", "Lane already has an attack");
        return;
      }
      attackCard = game.lanes[laneIndex].facedown[playerNum];
      if (!attackCard) {
        socket.emit("errorMessage", "No face-down card in that lane");
        return;
      }
      paymentValidation = validateHandIndexes(player, paymentIndexes, []);
    }

    if (paymentValidation.error) {
      socket.emit("errorMessage", paymentValidation.error);
      return;
    }
    
    const attackPayment = getAttackPaymentRequirement(player, attackCard);
    const payment = getPaymentTotal(player, paymentValidation.indexes, useHeraBonus);
    const required = attackPayment.required;
    
    if (payment.total < required) {
      socket.emit("errorMessage", `Need ${required} payment, have ${payment.total}`);
      return;
    }

    if (from === "hand") {
      removeSelectedCardAndPayments(player, selectedAttackIndex, paymentValidation.indexes);
    } else {
      removeIndexesFromHandToDiscard(player, paymentValidation.indexes);
      game.lanes[laneIndex].facedown[playerNum] = null;
    }
    if (payment.heraUsedNow) player.turnData.heraUsed = true;
    addAccelerationIfOverpaid(player, payment.total, required);
    const attackInfo = finalizeAttackDeclaration(player, attackCard, calculateAttackBonuses(player, attackCard), attackPayment.freeAttackUsed);
    
    const attackId = `attack-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const attack = {
      id: attackId,
      player: playerNum,
      card: attackCard,
      source: from,
      effectiveValue: attackInfo.effectiveValue,
      block: [],
      notes: attackInfo.notes
    };

    if (from === "hand") game.handAttacks.push(attack);
    else game.lanes[laneIndex].attack = attack;
    
    // Reset passed flags and give priority to defender
    resetPriorityPassed(game);
    game.priority = getOtherPlayer(playerNum);
    game.mostRecentAttackDefender = game.priority;
    game.message = `Player ${playerNum} attacked with ${describeCardValue(attackCard, attackInfo.effectiveValue, attackInfo.notes)}${from === "lane" ? ` from lane ${laneIndex + 1}` : " from hand"}. Player ${game.priority} can block or pass.`;
    
    emitState(roomState);
    scheduleTrainingAi(roomState);
  });

  socket.on("confirmBlock", ({ lane, handAttackId, blockCardIndex, blockCardIndexes, paymentIndexes, useHeraBonus }) => {
    console.log(`[Socket] confirmBlock: lane=${lane}, attackId=${handAttackId}, blockIdx=${blockCardIndex}, payments=${paymentIndexes}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];
    
    if (game.phase !== "priority") {
      socket.emit("errorMessage", "Not in priority phase");
      return;
    }
    
    const laneIndex = lane === undefined || lane === null ? null : Number(lane);
    const isLaneBlock = laneIndex !== null;
    const laneState = isLaneBlock && Number.isInteger(laneIndex) && laneIndex >= 0 && laneIndex < game.lanes.length
      ? game.lanes[laneIndex]
      : null;
    const attack = isLaneBlock ? laneState?.attack : game.handAttacks.find(a => a.id === handAttackId);
    if (!attack) {
      socket.emit("errorMessage", "Attack not found");
      return;
    }
    if (attack.block && attack.block.length > 0) {
      socket.emit("errorMessage", "Attack is already blocked");
      return;
    }
    
    const defender = getOtherPlayer(attack.player);
    if (playerNum !== defender) {
      socket.emit("errorMessage", "Not the defender");
      return;
    }
    if (game.priority !== defender) {
      socket.emit("errorMessage", "Defender does not have priority to block");
      return;
    }
    if (game.priorityPassed?.[defender]) {
      socket.emit("errorMessage", "You already passed on this attack and cannot block it now");
      return;
    }
    
    const noHandBlockSelected =
      !isLaneBlock &&
      (blockCardIndex === undefined || blockCardIndex === null || blockCardIndex === -1) &&
      (!Array.isArray(blockCardIndexes) || blockCardIndexes.length === 0);

    // If take damage (no block card)
    if (noHandBlockSelected) {
      console.log(`[Socket] No block card - passing priority to take damage`);
      game.priorityPassed[playerNum] = true;
      game.message = `Player ${playerNum} chose not to block.`;

      if (game.gameMode === "basic") {
        roomState.damageConfirmed = enterDamagePhase(game, `Player ${playerNum} chose not to block. Resolve damage.`);
        emitState(roomState);
        scheduleTrainingAi(roomState);
        return;
      }
      
      if (game.priorityPassed[1] && game.priorityPassed[2]) {
        if (hasPendingAttacks(game)) {
          roomState.damageConfirmed = enterDamagePhase(game, "Both players passed - damage phase. Click Resolve Damage.");
        } else {
          startEndPhase(game);
        }
        resetPriorityPassed(game);
      } else {
        game.priority = getOtherPlayer(playerNum);
      }
      emitState(roomState);
      scheduleTrainingAi(roomState);
      return;
    }
    if (isLaneBlock && !laneState.facedown[playerNum]) {
      console.log(`[Socket] No lane blocker - passing priority to take damage`);
      game.priorityPassed[playerNum] = true;
      game.message = `Player ${playerNum} chose not to block.`;

      if (game.gameMode === "basic") {
        roomState.damageConfirmed = enterDamagePhase(game, `Player ${playerNum} chose not to block. Resolve damage.`);
        emitState(roomState);
        scheduleTrainingAi(roomState);
        return;
      }

      if (game.priorityPassed[1] && game.priorityPassed[2]) {
        if (hasPendingAttacks(game)) {
          roomState.damageConfirmed = enterDamagePhase(game, "Both players passed - damage phase. Click Resolve Damage.");
        } else {
          startEndPhase(game);
        }
        resetPriorityPassed(game);
      } else {
        game.priority = getOtherPlayer(playerNum);
      }
      emitState(roomState);
      scheduleTrainingAi(roomState);
      return;
    }
    
    const selectedBlockIndexes = isLaneBlock
      ? []
      : (Array.isArray(blockCardIndexes) ? blockCardIndexes : [blockCardIndex])
          .map((index) => Number(index))
          .filter((index) => Number.isInteger(index));

    if (!isLaneBlock) {
      if (selectedBlockIndexes.length === 0) {
        socket.emit("errorMessage", "Select at least one block card");
        return;
      }
      const uniqueBlockIndexes = new Set(selectedBlockIndexes);
      if (uniqueBlockIndexes.size !== selectedBlockIndexes.length) {
        socket.emit("errorMessage", "Duplicate block card");
        return;
      }
      if (selectedBlockIndexes.some((index) => index < 0 || index >= player.hand.length || !player.hand[index])) {
        socket.emit("errorMessage", "Invalid block card");
        return;
      }
    }

    const blockCards = isLaneBlock
      ? [laneState.facedown[playerNum]]
      : selectedBlockIndexes.map((index) => player.hand[index]);
    const blockCardValue = blockCards.reduce((sum, card) => sum + getBaseCardValue(card), 0);
    const paymentValidation = validateHandIndexes(player, paymentIndexes, selectedBlockIndexes);
    if (paymentValidation.error) {
      socket.emit("errorMessage", paymentValidation.error);
      return;
    }
    const payment = getPaymentTotal(player, paymentValidation.indexes, useHeraBonus);
    
    console.log(`[Socket] Block payment check: need ${blockCardValue}, have ${payment.total}`);
    
    if (payment.total < blockCardValue) {
      socket.emit("errorMessage", `Need ${blockCardValue} payment to block, have ${payment.total}`);
      return;
    }
    
    // Process block
    if (isLaneBlock) {
      removeIndexesFromHandToDiscard(player, paymentValidation.indexes);
      laneState.facedown[playerNum] = null;
    } else {
      removeSelectedCardsAndPayments(player, selectedBlockIndexes, paymentValidation.indexes);
    }
    if (payment.heraUsedNow) player.turnData.heraUsed = true;
    addAccelerationIfOverpaid(player, payment.total, blockCardValue);

    const blockEntries = blockCards.map((blockCard) => {
      const blockInfo = applyBlockBonuses(player, blockCard);
      return {
        player: playerNum,
        card: blockCard,
        source: isLaneBlock ? "lane" : "hand",
        effectiveValue: blockInfo.effectiveValue,
        notes: blockInfo.notes
      };
    });
    finalizeBlockDeclaration(player);
    
    attack.block.push(...blockEntries);
    
    if (game.gameMode === "basic") {
      roomState.damageConfirmed = enterDamagePhase(game, `Player ${playerNum} blocked with ${blockEntries.map((entry) => describeCardValue(entry.card, entry.effectiveValue, entry.notes)).join(", ")}. Basic Mode moves directly to damage.`);
    } else {
      // The attack remains pending until damage resolution. Priority returns to
      // the attacker, who can pass to move combat toward damage.
      resetPriorityPassed(game);
      game.priority = attack.player;
      game.message = `Player ${playerNum} blocked with ${blockEntries.map((entry) => describeCardValue(entry.card, entry.effectiveValue, entry.notes)).join(", ")} (paid ${payment.total}, blocker cost ${blockCardValue}). Player ${attack.player} has priority.`;
    }
    
    emitState(roomState);
    scheduleTrainingAi(roomState);
  });

  socket.on("usePolea", ({ mode, handIndex, lane, laneA, laneB, targetPlayer, targetType, handAttackId }) => {
    console.log(`[Socket] usePolea: mode=${mode}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];

    if (!canUsePriorityAbility(socket, game, playerNum, "frumo")) return;
    if (player.turnData.poleaUsed) {
      socket.emit("errorMessage", "Polea already used this turn");
      return;
    }

    const selectedMode = Number(mode);
    if (selectedMode === 1) {
      const selectedHandIndex = Number(handIndex);
      const laneIndex = Number(lane);
      if (!Number.isInteger(selectedHandIndex) || !player.hand[selectedHandIndex]) {
        socket.emit("errorMessage", "Invalid hand card");
        return;
      }
      if (!Number.isInteger(laneIndex) || laneIndex < 0 || laneIndex >= game.lanes.length || game.lanes[laneIndex].facedown[playerNum]) {
        socket.emit("errorMessage", "Invalid empty lane");
        return;
      }
      const [card] = player.hand.splice(selectedHandIndex, 1);
      game.lanes[laneIndex].facedown[playerNum] = card;
      player.turnData.poleaUsed = true;
      resetPriorityPassed(game);
      game.message = `Player ${playerNum} used Polea to put a card into lane ${laneIndex + 1}.`;
      emitState(roomState);
      return;
    }

    if (selectedMode === 2) {
      const firstLane = Number(laneA);
      const secondLane = Number(laneB);
      if (
        !Number.isInteger(firstLane) ||
        !Number.isInteger(secondLane) ||
        firstLane < 0 ||
        secondLane < 0 ||
        firstLane >= game.lanes.length ||
        secondLane >= game.lanes.length ||
        firstLane === secondLane ||
        !game.lanes[firstLane].facedown[playerNum] ||
        !game.lanes[secondLane].facedown[playerNum]
      ) {
        socket.emit("errorMessage", "Choose two occupied lanes you control");
        return;
      }
      [game.lanes[firstLane].facedown[playerNum], game.lanes[secondLane].facedown[playerNum]] = [game.lanes[secondLane].facedown[playerNum], game.lanes[firstLane].facedown[playerNum]];
      player.turnData.poleaUsed = true;
      resetPriorityPassed(game);
      game.message = `Player ${playerNum} used Polea to switch lanes ${firstLane + 1} and ${secondLane + 1}.`;
      emitState(roomState);
      return;
    }

    if (selectedMode === 3) {
      const peekPlayer = Number(targetPlayer);
      const laneIndex = Number(lane);
      if (![1, 2].includes(peekPlayer) || !Number.isInteger(laneIndex) || laneIndex < 0 || laneIndex >= game.lanes.length || !game.lanes[laneIndex].facedown[peekPlayer]) {
        socket.emit("errorMessage", "Invalid face-down target");
        return;
      }
      const card = game.lanes[laneIndex].facedown[peekPlayer];
      player.turnData.poleaUsed = true;
      resetPriorityPassed(game);
      socket.emit("peekResult", `Player ${peekPlayer} lane ${laneIndex + 1}: ${card.name}`);
      game.message = `Player ${playerNum} used Polea to look at a face-down card.`;
      emitState(roomState);
      return;
    }

    if (selectedMode === 4) {
      const target = getControlledTargetCard(game, playerNum, targetType, lane, handAttackId);
      if (!target) {
        socket.emit("errorMessage", "Invalid target");
        return;
      }
      target.tempBuff = (target.tempBuff || 0) + 1;
      player.turnData.poleaUsed = true;
      resetPriorityPassed(game);
      game.message = `Player ${playerNum} used Polea to give ${describeCardValue(target, getCardCurrentValue(target), ["Polea +1"])} this turn.`;
      emitState(roomState);
      return;
    }

    socket.emit("errorMessage", "Invalid Polea mode");
  });

  socket.on("useLafayette", ({ lane, handIndex }) => {
    console.log(`[Socket] useLafayette: lane=${lane}, handIndex=${handIndex}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];

    if (!canUsePriorityAbility(socket, game, playerNum, "frumo")) return;
    if (player.turnData.lafayetteUsed) {
      socket.emit("errorMessage", "Lafayette already used this turn");
      return;
    }

    const laneIndex = Number(lane);
    const selectedHandIndex = Number(handIndex);
    if (!Number.isInteger(laneIndex) || laneIndex < 0 || laneIndex >= game.lanes.length || !game.lanes[laneIndex].facedown[playerNum]) {
      socket.emit("errorMessage", "Invalid lane card");
      return;
    }
    if (!Number.isInteger(selectedHandIndex) || !player.hand[selectedHandIndex]) {
      socket.emit("errorMessage", "Invalid hand card");
      return;
    }

    const handCard = player.hand[selectedHandIndex];
    player.hand[selectedHandIndex] = game.lanes[laneIndex].facedown[playerNum];
    game.lanes[laneIndex].facedown[playerNum] = handCard;
    player.turnData.lafayetteUsed = true;
    resetPriorityPassed(game);
    game.message = `Player ${playerNum} used Lafayette to swap a lane card with a hand card.`;
    emitState(roomState);
  });

  socket.on("useFocusBuff", ({ targetType, lane, handAttackId }) => {
    console.log(`[Socket] useFocusBuff: targetType=${targetType}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];

    if (!canUsePriorityAbility(socket, game, playerNum, "bizi")) return;
    if (player.turnData.focusBuffUsed) {
      socket.emit("errorMessage", "Focus already used this turn");
      return;
    }
    if ((player.accelerationCounters || 0) <= 0) {
      socket.emit("errorMessage", "No acceleration counters");
      return;
    }

    const target = getControlledTargetCard(game, playerNum, targetType, lane, handAttackId);
    if (!target) {
      socket.emit("errorMessage", "Invalid target");
      return;
    }

    player.accelerationCounters -= 1;
    player.turnData.focusBuffUsed = true;
    target.tempBuff = (target.tempBuff || 0) + 1;
    resetPriorityPassed(game);
    game.message = `Player ${playerNum} removed an acceleration counter to give ${describeCardValue(target, getCardCurrentValue(target), ["Focus +1"])} this turn.`;
    emitState(roomState);
  });

  socket.on("placeFacedown", async ({ lane, handIndex }) => {
    console.log(`[Socket] placeFacedown: lane ${lane}, handIndex ${handIndex}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    const player = game.players[playerNum];
    
    if (game.phase !== "end") {
      socket.emit("errorMessage", "Not in end phase");
      return;
    }
    
    if (lane !== game.endPlacementLaneIndex) {
      socket.emit("errorMessage", "Wrong lane");
      return;
    }
    
    const currentPlayer = game.endPlacementStep === 0 ? game.endPlacementFirstPlayer : getOtherPlayer(game.endPlacementFirstPlayer);
    if (playerNum !== currentPlayer) {
      socket.emit("errorMessage", "Not your turn to place");
      return;
    }
    
    if (game.endPlaced[playerNum][lane]) {
      socket.emit("errorMessage", "Already placed in this lane");
      return;
    }
    
    if (!player.hand[handIndex]) {
      socket.emit("errorMessage", "Invalid card");
      return;
    }
    
    const card = player.hand.splice(handIndex, 1)[0];
    game.lanes[lane].facedown[playerNum] = card;
    game.endPlaced[playerNum][lane] = true;
    game.message = `Player ${playerNum} placed a card in lane ${lane + 1}`;
    
    await advanceEndPlacement(roomState);
    emitState(roomState);
    scheduleTrainingAi(roomState);
  });

  socket.on("skipEndPlacement", async ({ lane }) => {
    console.log(`[Socket] skipEndPlacement: lane ${lane}`);
    const roomState = getRoomForSocket(socket);
    if (!roomState?.game) return;
    const playerNum = getPlayerNumberBySocket(roomState, socket.id);
    if (!playerNum) return;
    const game = roomState.game;
    
    if (game.phase !== "end") {
      socket.emit("errorMessage", "Not in end phase");
      return;
    }
    
    if (lane !== game.endPlacementLaneIndex) {
      socket.emit("errorMessage", "Wrong lane");
      return;
    }
    
    const currentPlayer = game.endPlacementStep === 0 ? game.endPlacementFirstPlayer : getOtherPlayer(game.endPlacementFirstPlayer);
    if (playerNum !== currentPlayer) {
      socket.emit("errorMessage", "Not your turn to skip");
      return;
    }
    
    if (game.endPlaced[playerNum][lane]) {
      socket.emit("errorMessage", "Already processed");
      return;
    }
    
    game.endPlaced[playerNum][lane] = true;
    game.message = `Player ${playerNum} skipped lane ${lane + 1}`;
    
    await advanceEndPlacement(roomState);
    emitState(roomState);
    scheduleTrainingAi(roomState);
  });

  socket.on("leaveRoom", () => {
    console.log("[Socket] leaveRoom");
    removeFromMatchmaking(socket.id);
    const roomState = getRoomForSocket(socket);
    if (!roomState) return;
    detachSocketFromRoom(roomState, socket);
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
    removeFromMatchmaking(socket.id);
    const roomState = getRoomForSocket(socket);
    if (roomState) {
      detachSocketFromRoom(roomState, socket, { leaveSocket: false });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
