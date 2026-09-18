const OBJECT_EVENTS = new Set([
  "joinMatchmaking", "joinDraftLeague", "createRoom", "createFriendChallenge",
  "createFreeForAllRoom", "createDraftRoom", "createBotDraftRoom", "createAiTutorialRoom",
  "createCampaignRoom", "joinRoom", "reconnectToRoom", "selectFaction", "setGameMode",
  "draftPick", "setDraftDeckAdditions", "duelCommand", "requestMatchState", "respondDraw",
  "respondUndo", "confirmAttack", "confirmBlock", "usePolea", "useLafayette",
  "useFocusBuff", "placeFacedown", "skipEndPlacement"
]);
const STRING_FIELDS = ["authToken", "guestName", "roomCode", "reconnectToken", "role",
  "friendId", "factionId", "chapterId", "draftType", "cardCopyId", "commandId"];
const ROOM_ENTRY_EVENTS = new Set([
  "createRoom", "createFriendChallenge", "createFreeForAllRoom", "createDraftRoom",
  "createBotDraftRoom", "createAiTutorialRoom", "createCampaignRoom", "joinRoom"
]);

function validPayload(event, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  if (STRING_FIELDS.some((key) => payload[key] != null && typeof payload[key] !== "string")) return false;
  if (payload.mode != null && typeof payload.mode !== "string"
    && !(event === "usePolea" && Number.isInteger(payload.mode))) return false;
  if (["asSpectator", "accept", "approve"].some((key) => payload[key] != null && typeof payload[key] !== "boolean")) return false;
  if (["cardCopyIds", "selections"].some((key) => payload[key] != null && !Array.isArray(payload[key]))) return false;
  return true;
}

// Serialize operations on a connection so asynchronous identity/storage work
// cannot race a second room entry or disconnect. Never let a client exception
// become an unhandled rejection that terminates the process.
function createSocketBoundary(socket, { getRoomForSocket, onError = console.error }) {
  let queue = Promise.resolve();
  return function onClientEvent(event, handler) {
    socket.on(event, (...args) => {
      queue = queue.then(async () => {
        if (!socket.connected && event !== "disconnect") return;
        const ack = typeof args.at(-1) === "function" ? args.at(-1) : null;
        const reject = (code, message) => {
          socket.emit("errorMessage", message);
          ack?.({ ok: false, accepted: false, error: message, rejection: { code, message } });
        };
        if (OBJECT_EVENTS.has(event)) {
          const payload = typeof args[0] === "function" || args[0] === undefined ? {} : args[0];
          if (!validPayload(event, payload)) {
            reject("INVALID_PAYLOAD", "Invalid request. Please check your input and try again.");
            return;
          }
          args = ack ? [payload, ack] : [payload];
        }
        const currentRoom = (ROOM_ENTRY_EVENTS.has(event) || event === "reconnectToRoom")
          ? getRoomForSocket(socket) : null;
        if (currentRoom && (event !== "reconnectToRoom"
          || currentRoom.roomCode !== String(args[0].roomCode || "").trim().toUpperCase())) {
          reject("ALREADY_IN_ROOM", "Leave your current room before entering another table.");
          return;
        }
        try {
          await handler(...args);
        } catch (error) {
          onError(`[Socket] ${event} failed`, error);
          reject("REQUEST_FAILED", "The request could not be completed. Please try again.");
        }
      }).catch((error) => onError(`[Socket] ${event} boundary failed`, error));
    });
  };
}

module.exports = { createSocketBoundary };
