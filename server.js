const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from public/
app.use(express.static(path.join(__dirname, 'public')));

// In-memory room store
// rooms[roomId] = { clients: Map<ws, {username, publicKey}> }
const rooms = new Map();

function generateRoomId() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function broadcast(room, message, excludeWs = null) {
  if (!rooms.has(room)) return;
  const { clients } = rooms.get(room);
  const payload = JSON.stringify(message);
  clients.forEach((info, ws) => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

function sendTo(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function getRoomMembers(room) {
  if (!rooms.has(room)) return [];
  const { clients } = rooms.get(room);
  return Array.from(clients.values()).map(c => ({
    username: c.username,
    publicKey: c.publicKey,
  }));
}

wss.on('connection', (ws) => {
  let currentRoom = null;
  let currentUser = null;

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    switch (msg.type) {

      // Client creates a new room
      case 'create_room': {
        const roomId = generateRoomId();
        rooms.set(roomId, { clients: new Map() });
        sendTo(ws, { type: 'room_created', roomId });
        break;
      }

      // Client joins a room with username + RSA public key
      case 'join': {
        const { roomId, username, publicKey } = msg;
        if (!rooms.has(roomId)) {
          sendTo(ws, { type: 'error', message: 'Room not found' });
          return;
        }
        const room = rooms.get(roomId);
        if (room.clients.size >= 2) {
          sendTo(ws, { type: 'error', message: 'Room is full (max 2 users)' });
          return;
        }

        currentRoom = roomId;
        currentUser = username;
        // Track join order: first joiner is initiator
        const joinOrder = room.clients.size; // 0 = first, 1 = second
        room.clients.set(ws, { username, publicKey, joinOrder });

        // Confirm join + send existing members' public keys + role
        sendTo(ws, {
          type: 'joined',
          roomId,
          isInitiator: joinOrder === 0, // first joiner generates AES key
          members: getRoomMembers(roomId).filter(m => m.username !== username)
        });

        // Notify others of new member + their public key
        broadcast(roomId, {
          type: 'user_joined',
          username,
          publicKey,
          members: getRoomMembers(roomId)
        }, ws);

        console.log(`[${roomId}] ${username} joined (${room.clients.size}/2)`);
        break;
      }

      // Relay encrypted AES key (wrapped with recipient's RSA public key)
      case 'key_exchange': {
        if (!currentRoom) return;
        const { to, wrappedKey } = msg;
        const room = rooms.get(currentRoom);
        room.clients.forEach((info, clientWs) => {
          if (info.username === to) {
            sendTo(clientWs, {
              type: 'key_exchange',
              from: currentUser,
              wrappedKey
            });
          }
        });
        break;
      }

      // Relay encrypted message (server never sees plaintext)
      case 'message': {
        if (!currentRoom) return;
        const { ciphertext, iv, timestamp, msgId } = msg;
        broadcast(currentRoom, {
          type: 'message',
          from: currentUser,
          ciphertext,
          iv,
          timestamp,
          msgId
        }, ws);
        console.log(`[${currentRoom}] Encrypted message relayed from ${currentUser} (${ciphertext.length} chars)`);
        break;
      }

      // Typing indicator
      case 'typing': {
        if (!currentRoom) return;
        broadcast(currentRoom, {
          type: 'typing',
          from: currentUser,
          isTyping: msg.isTyping
        }, ws);
        break;
      }

      default:
        break;
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom);
      room.clients.delete(ws);
      broadcast(currentRoom, {
        type: 'user_left',
        username: currentUser,
        members: getRoomMembers(currentRoom)
      });
      console.log(`[${currentRoom}] ${currentUser} left`);
      // Clean up empty rooms
      if (room.clients.size === 0) {
        rooms.delete(currentRoom);
        console.log(`[${currentRoom}] Room closed`);
      }
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🔐 SecureChat server running at http://localhost:${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}\n`);
});
