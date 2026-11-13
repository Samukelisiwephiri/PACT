# PACT - Peer-to-Peer Agreement & Community Trust

**Hackathon Track:** Mobile Money & Peer-to-Peer / Merchant & Machine Payments
**Team:** Hack2go

## Project Structure
```
pact_stokvel_app/
├── contracts/        # Solidity Smart Contracts (PACT.sol)
├── firmware/         # ESP32 C++ Microcontroller Firmware (main.cpp)
├── backend/          # Node.js/Express Web3 Relay Server
└── frontend/         # React / Vite Web Dashboard & Simulator
```

## Quick Start (VS Code)
1. Open this directory in **VS Code**.
2. **Backend**:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   npm run dev
   ```
3. **Frontend** (in another terminal):
   ```bash
   cd frontend
   cp .env.example .env
   npm install
   npm run dev
   ```
   Email accounts are stored in `backend/data/users.json` with scrypt-hashed passwords.
   To enable Google sign-in, create a Google OAuth web client, add `http://localhost:5173`
   as an authorized JavaScript origin, then set the same client ID as `GOOGLE_CLIENT_ID`
   in `backend/.env` and `VITE_GOOGLE_CLIENT_ID` in `frontend/.env`. Restart both servers
   after changing environment variables. In production, set `FRONTEND_URL` to the exact
   frontend origin and serve the app over HTTPS.
4. **Smart Contracts**: Deploy `contracts/PACT.sol` using Remix IDE or Hardhat to Sepolia testnet.
5. **Hardware**: Flash `firmware/main.cpp` using PlatformIO plugin in VS Code.
