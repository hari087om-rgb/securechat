# 🔐 SecureChat — End-to-End Encrypted Chat App

A real-time, end-to-end encrypted chat application built with Node.js, WebSockets, and the Web Crypto API.

## 🛡️ Security Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Key Exchange | RSA-2048 (OAEP + SHA-256) | Safely share the AES session key |
| Message Encryption | AES-256-GCM | Encrypt every message |
| Integrity | GCM Auth Tag (128-bit) | Tamper detection built-in |
| IV | 96-bit random per message | Prevents ciphertext patterns |
| Crypto Engine | Web Crypto API | Native, hardware-accelerated |

**The server NEVER sees your plaintext.** It only relays ciphertext between clients.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ installed

### Install & Run

```bash
# Install dependencies
npm install

# Start the server
npm start
```

Open **http://localhost:3000** in your browser.

## 💬 How to Chat

1. **Person A**: Enter a username → click **"Create New Room"**
2. **Person A**: Copy the 8-character Room ID shown in the top bar
3. **Person B**: Open the same URL, enter a username, paste the Room ID → click **"Join Existing Room"**
4. RSA key exchange happens automatically — a shared AES-256 session key is established
5. Start chatting! Every message is encrypted before it leaves your browser

## 🔒 How Encryption Works

```
Step 1: Alice & Bob each generate RSA-2048 key pairs in the browser
Step 2: Public keys are exchanged via the WebSocket server (safe to share)
Step 3: Alice generates a random AES-256 session key
Step 4: Alice encrypts the AES key with Bob's RSA public key → sends to server
Step 5: Bob decrypts it using his RSA private key (server can't read it!)
Step 6: Both now share the AES-256 key — all messages are encrypted with it
Step 7: Each message uses a fresh 96-bit IV → server sees only random ciphertext
```

## 📁 Project Structure

```
securechat/
├── server.js          # Node.js + Express + WebSocket server
├── package.json       # Dependencies
├── public/
│   └── index.html    # Frontend (HTML + CSS + JS, Web Crypto API)
└── README.md
```

## 🔧 Tech Stack

- **Backend**: Node.js, Express, `ws` (WebSocket library)
- **Frontend**: Vanilla HTML/CSS/JS (no framework needed)
- **Cryptography**: Web Crypto API (browser-native, no library)
- **Transport**: WebSocket for real-time bidirectional messaging

## 🌐 Deploy to Production

### Using environment variable for port:
```bash
PORT=8080 node server.js
```

### Using PM2 (process manager):
```bash
npm install -g pm2
pm2 start server.js --name securechat
pm2 save
```

### For HTTPS (required for production Web Crypto):
- Use a reverse proxy like Nginx with Let's Encrypt SSL
- Or deploy to platforms like Railway, Render, or Fly.io

## ⚠️ Notes

- Max 2 users per room (by design for E2E encryption simplicity)
- Messages are NOT stored anywhere — they exist only in memory during the session
- Closing/refreshing destroys your session keys permanently
- The server is a blind relay — it cannot decrypt any messages
