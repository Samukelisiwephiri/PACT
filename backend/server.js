const express = require("express");
const { ethers } = require("ethers");
const cors = require("cors");
require("dotenv").config();

const app = express();
const frontendOrigin = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
if (process.env.PAYFAST_TRUST_PROXY === "true" || process.env.VERCEL === "1") {
  app.set("trust proxy", 1);
}
app.use(express.json({ limit: "32kb" }));
app.use(cors({ origin: frontendOrigin, credentials: true }));
const authRouter = require("./auth");
app.use("/api/auth", authRouter);
app.use(
  "/api/payments/notify",
  express.raw({ type: "application/x-www-form-urlencoded", limit: "32kb" })
);
app.use("/api/payments", require("./payments"));

// Web3 Connection
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "http://127.0.0.1:8545");
const wallet = process.env.PRIVATE_KEY 
  ? new ethers.Wallet(process.env.PRIVATE_KEY, provider)
  : ethers.Wallet.createRandom().connect(provider);

const PACT_ABI = [
  "function depositContribution(uint256 _groupId, address _member) public payable",
  "function createGroup(string memory _name, uint256 _contributionAmount, uint256 _cycleInterval) external"
];

const pactContract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000",
  PACT_ABI,
  wallet
);

app.get("/api/health", (req, res) => {
  res.json({ status: "active", network: "Sepolia Testnet", node: "ESP32-PACT-01" });
});

app.post("/api/hardware/deposit", async (req, res) => {
  try {
    const { groupId, memberAddress, amountEth } = req.body;
    console.log(`Processing hardware node deposit for ${memberAddress || wallet.address}...`);

    if (process.env.CONTRACT_ADDRESS) {
      const tx = await pactContract.depositContribution(
        groupId || 1,
        memberAddress || wallet.address,
        { value: ethers.parseEther(amountEth || "0.01") }
      );
      await tx.wait();
      return res.status(200).json({ success: true, txHash: tx.hash });
    }

    // Mock response if contract address not set yet
    res.status(200).json({
      success: true,
      mock: true,
      txHash: "0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join("")
    });
  } catch (error) {
    console.error("Tx Execution Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const path = require('path');

// 1. Tell Express to look inside the frontend's 'dist' folder and serve those static files
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// 2. Catch-all route: If a user navigates to any URL path, send back the main index.html file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error("Request Error:", error);
  res.status(status).json({
    error: status >= 500 ? "The request could not be completed. Please try again." : error.message
  });
});

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`PACT Relay Server active on port ${PORT}`));
}

module.exports = app;
