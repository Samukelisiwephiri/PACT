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
2. Install the frontend and backend workspace dependencies:
   ```bash
   npm install
   ```
3. Copy `backend/.env.example` to `backend/.env`, then start the whole app from this directory:
   ```bash
   npm run dev
   ```
   Open `http://localhost:8080`. The development runner starts Vite and Express together,
   and Vite proxies `/api` requests to the backend on port 5000. For a single production
   server, run `npm start`; it builds the frontend and serves it with the Express API.
   Email accounts are stored in `backend/data/users.json` with scrypt-hashed passwords.
   To enable Google sign-in, create a Google OAuth web client, add `http://localhost:5173`
   as an authorized JavaScript origin, then set the same client ID as `GOOGLE_CLIENT_ID`
   in `backend/.env` and `VITE_GOOGLE_CLIENT_ID` in `frontend/.env`. Restart both servers
   after changing environment variables. In production, set `FRONTEND_URL` to the exact
   public app origin and serve the app over HTTPS.
   To enable PayFast contributions, add your PayFast **sandbox** merchant ID and key to
   `PAYFAST_MERCHANT_ID` and `PAYFAST_MERCHANT_KEY` in `backend/.env`, then leave
   `PAYFAST_SANDBOX=true`. Set `PAYFAST_PASSPHRASE` if one is configured on the merchant
   account. The amount is set server-side with `PACT_CONTRIBUTION_AMOUNT_ZAR` (defaults
   to `2500.00`); the browser cannot change the charged amount. PayFast only marks a
   contribution paid after its signed ITN is validated. For local testing, expose the
   backend through an HTTPS tunnel and set `PAYFAST_NOTIFY_BASE_URL` to that public API
   origin so PayFast can reach `/api/payments/notify`. For live payments, use production
   merchant credentials, set `PAYFAST_SANDBOX=false`, and configure HTTPS public URLs.
   Checkout uses PayFast's hosted page; the app never handles card details. A confirmed
   PayFast payment is recorded off-chain and does not automatically transfer money into
   the smart-contract pool.
4. **Smart Contracts**: Deploy `contracts/PACT.sol` using Remix IDE or Hardhat to Sepolia testnet.
5. **Hardware**: Flash `firmware/main.cpp` using PlatformIO plugin in VS Code.

The JSON account and payment stores are suitable for local development only. Before
deploying authentication or payment processing to Vercel or another serverless host,
replace them with a shared persistent database; serverless filesystem and in-memory
sessions are not durable across function instances.

## Deploy to Vercel

Import the repository into Vercel and set **Root Directory** to `PACT-main`. The
included `vercel.json` installs both workspaces, builds the Vite frontend, and includes
the built frontend in the Express function, so the website and `/api` endpoints deploy
under the same origin. Vercel detects the root `server.js` entry point automatically.

Set `FRONTEND_URL` to your public HTTPS app origin if you use a custom domain. If it is
unset, the app uses Vercel's `VERCEL_URL`. For Google sign-in, set `GOOGLE_CLIENT_ID`
and the build-time `VITE_GOOGLE_CLIENT_ID`. Add PayFast credentials and set
`PAYFAST_NOTIFY_BASE_URL` to the same public origin if you enable payments. Never
commit these values or private keys.

**Important:** signup, sessions, and payment orders currently use local JSON files
and in-memory sessions. Vercel functions do not provide durable writable storage or
shared memory, so those features require a persistent database/session store before
they can be relied on in a deployed app. The frontend and API can deploy together,
but this storage limitation must be addressed for production authentication/payments.
