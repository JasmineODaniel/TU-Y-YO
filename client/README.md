# TU-Y-YO — End-to-End Encrypted Messaging

A secure, real-time messaging application built with **React + Vite** that uses **client-side end-to-end encryption (E2EE)**. The server never sees your plaintext messages — encryption and decryption happen entirely in your browser.

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (React + Vite)                   │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Web Crypto   │  │  IndexedDB   │  │  WebSocket Mgr   │   │
│  │  API Module   │  │  Key Store   │  │  (Real-time)     │   │
│  │              │  │              │  │                  │   │
│  │ • RSA-OAEP   │  │ • CryptoKey  │  │ • Auto-reconnect │   │
│  │ • AES-GCM    │  │   storage    │  │ • Event-based    │   │
│  │ • PBKDF2     │  │ • Never      │  │ • Exponential    │   │
│  │              │  │   serialized │  │   backoff        │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘   │
│         │                 │                    │             │
│  ┌──────┴─────────────────┴────────────────────┴─────────┐   │
│  │              Auth & Chat Contexts                     │   │
│  │  • Orchestrates crypto + API + key storage            │   │
│  │  • Manages tokens in memory (never localStorage)      │   │
│  │  • Auto token refresh before expiry                   │   │
│  └───────────────────────┬───────────────────────────────┘   │
│                          │                                   │
│  ┌───────────────────────┴───────────────────────────────┐   │
│  │                 React Components                      │   │
│  │  LoginPage │ ChatPage │ ConversationList │ ChatWindow  │   │
│  └───────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS / WSS
                             │ (only ciphertext crosses this boundary)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              TU-Y-YO API (Backend)                           │
│              https://whisperbox.koyeb.app                    │
│                                                             │
│  • Stores encrypted blobs only                              │
│  • Manages user identities & auth                           │
│  • Handles encrypted key exchange                           │
│  • NEVER accesses plaintext                                 │
└─────────────────────────────────────────────────────────────┘
```

## 🔐 Encryption Flow

### Registration
1. **Generate RSA-OAEP keypair** (4096-bit, SHA-256) using Web Crypto API
2. **Generate PBKDF2 salt** (128-bit random)
3. **Derive AES-GCM wrapping key** from password + salt (PBKDF2, 600k iterations)
4. **Wrap the private key** with AES-GCM and prepend random IV (encrypted private key blob)
5. **Export public key** as base64 (SPKI format)
6. **Send to server**: public key, wrapped private key, salt, credentials
7. **Store unwrapped private key** in IndexedDB as non-extractable CryptoKey

### Login
1. **Authenticate** with username/password → receive tokens + key material
2. **Re-derive wrapping key** from password + stored salt
3. **Unwrap private key** from the encrypted blob
4. **Import public key** from server-stored base64
5. **Store keys** in IndexedDB for session use

### Sending a Message
1. **Generate random AES-GCM key** (256-bit) + **random IV** (96-bit)
2. **Encrypt plaintext** with AES-GCM
3. **Encrypt AES key** with recipient's RSA public key → `encryptedKey`
4. **Encrypt AES key** with sender's own RSA public key → `encryptedKeyForSelf`
5. **Send** `{ ciphertext, iv, encryptedKey, encryptedKeyForSelf }` to server

### Receiving a Message
1. **Receive** encrypted payload via WebSocket
2. **Decrypt `encryptedKey`** with own RSA private key → recover AES key
3. **Decrypt ciphertext** with AES-GCM key + IV → plaintext

## 🔑 Key Management

| Key | Algorithm | Storage | Extractable? |
|-----|-----------|---------|-------------|
| RSA Public Key | RSA-OAEP 4096-bit | Server (base64) + IndexedDB | Yes |
| RSA Private Key | RSA-OAEP 4096-bit | IndexedDB (CryptoKey) | **No** |
| Wrapped Private Key | AES-GCM encrypted blob | Server (base64) | N/A |
| PBKDF2 Salt | 128-bit random | Server (base64) | N/A |
| Per-message AES Key | AES-GCM 256-bit | Never stored (ephemeral) | Yes (for RSA wrapping) |
| Wrapping Key | AES-GCM 256-bit | Never stored (derived on login) | No |

**Critical security properties:**
- Private keys are **never** sent to the server in plaintext
- Private keys stored in IndexedDB are **non-extractable** CryptoKey objects
- Tokens stored in **memory only** (not localStorage/sessionStorage)
- Per-message AES keys are **ephemeral** — generated fresh for each message

## 🛡 Security Trade-offs

### Strengths
- **True E2E encryption** — server cannot read messages even with database access
- **Web Crypto API** — browser-native crypto, no third-party crypto libraries
- **Non-extractable keys** — IndexedDB CryptoKey objects cannot be exported by JavaScript
- **Memory-only tokens** — resistant to XSS-based token theft from storage
- **PBKDF2 with 600k iterations** — strong key derivation resistant to brute force
- **Per-message random AES key + IV** — no key reuse across messages

### Known Limitations
- **No forward secrecy** — if the RSA private key is compromised, all past messages can be decrypted. A Double Ratchet protocol (like Signal) would provide forward secrecy but significantly increases complexity.
- **Trust on first use (TOFU)** — public keys are fetched from the server; a compromised server could serve fake public keys. Key fingerprint verification (QR codes) would mitigate this.
- **Browser tab isolation** — keys exist in IndexedDB per origin; multiple tabs share the same key store.
- **No message authentication between users** — messages are encrypted and integrity-protected (AES-GCM), but there's no separate digital signature to prove sender identity beyond the server's word.
- **Single device** — private key is tied to one browser's IndexedDB. Multi-device support would require a secure key sync protocol.

## 🚀 Setup & Development

```bash
# Install dependencies
cd client
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 📁 Project Structure

```
client/src/
├── lib/
│   ├── crypto.js          # Web Crypto API: RSA-OAEP, AES-GCM, PBKDF2
│   ├── keystore.js        # IndexedDB secure CryptoKey storage
│   ├── api.js             # REST API client with auto token refresh
│   └── websocket.js       # WebSocket manager with auto-reconnect
├── contexts/
│   ├── AuthContext.jsx     # Auth state + crypto key orchestration
│   └── ChatContext.jsx     # Chat state + real-time messaging
├── pages/
│   ├── LoginPage.jsx       # Login/Register with key generation
│   └── ChatPage.jsx        # Split-panel chat interface
├── components/
│   ├── ConversationList.jsx # Conversation sidebar
│   ├── ChatWindow.jsx      # Message display + input
│   ├── MessageBubble.jsx   # Individual message bubble
│   └── UserSearch.jsx      # User discovery search
├── App.jsx                 # Router + context providers
├── App.css                 # Component styles
├── index.css               # Design system + global styles
└── main.jsx                # Entry point
```

## 🛠 Tech Stack

- **Frontend**: React 19 + Vite 8
- **Routing**: React Router DOM v7
- **Crypto**: Web Crypto API (native browser)
- **Key Storage**: IndexedDB
- **Real-time**: WebSocket with auto-reconnect
- **API**: TU-Y-YO REST API (https://whisperbox.koyeb.app)
- **Styling**: Vanilla CSS with custom properties (Light glassmorphism theme)
