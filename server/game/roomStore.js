const rooms = new Map();

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createEmptyRoom(roomCode) {
  return {
    roomCode,
    lobby: {
      players: {
        1: { socket: null, factionId: null, reconnectToken: null, connected: false },
        2: { socket: null, factionId: null, reconnectToken: null, connected: false }
      },
      spectators: []
    },
    game: null
  };
}

function createRoom() {
  let roomCode = generateRoomCode();
  while (rooms.has(roomCode)) {
    roomCode = generateRoomCode();
  }

  const roomState = createEmptyRoom(roomCode);
  rooms.set(roomCode, roomState);
  return roomState;
}

function getRoom(roomCode) {
  return rooms.get(roomCode) || null;
}

function deleteRoom(roomCode) {
  rooms.delete(roomCode);
}

function getRoomForSocket(socket) {
  const roomCode = socket.data.roomCode;
  if (!roomCode) return null;
  return getRoom(roomCode);
}

module.exports = {
  rooms,
  createRoom,
  getRoom,
  deleteRoom,
  getRoomForSocket
};