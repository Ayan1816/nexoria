
# 🌌 NEXORIA - Omnichain Asset Telemetry & AI Command Matrix

Nexoria is a next-generation Web3 dApp designed to simplify on-chain interactions through AI-powered automation, secure omnichain telemetry, and agentic workflows. Built with a strong focus on user experience and enterprise-grade security.

## 🚀 Key Features

*   **🤖 AI Batch Delegate:** Execute complex, multi-wallet token transfers simultaneously using natural language commands (e.g., *"Send 1 USDC to 0x..."*).
*   **🛡️ Enterprise-Grade Security:**
    *   **Firebase Anonymous Auth:** Secure off-chain transaction logging with strict per-user data isolation (`auth.currentUser.uid`).
    *   **Race-Condition Safe:** Robust React lifecycle management ensures data is never overwritten during network delays.
    *   **Gas Reserve Protection:** Smart validation prevents transaction failures when sending max balances.
*   **⚡ Agentic Automation:** Schedule time-delayed transactions and smart triggers without manual intervention.
*   **📩 On-Chain Pager:** Send permanent, hex-encoded secure messages directly to recipient wallets on the blockchain.
*   **🌐 Network Agnostic Architecture:** Currently optimized for **Arc Testnet** (with Faucet integration & EURC support), with UI foundations ready for Ethereum, Polygon, Arbitrum, and BSC Mainnets.

## 🛠️ Technology Stack

*   **Frontend:** React, Tailwind CSS, Lucide Icons
*   **Web3 Integration:** ethers.js (v6), MetaMask & Rabby Wallet Support
*   **Backend & DB:** Firebase (Firestore, Authentication)
*   **Deployment:** Vercel

## 🔒 Security Architecture (For Judges & Reviewers)

Security is a primary focus of Nexoria. To bridge the gap between Web3 wallets and Web2 databases (Firebase) without a dedicated Node.js backend, we implemented:
1.  **Anonymous Authentication Session:** Generates a secure, temporary session for the browser.
2.  **Strict Firestore Rules:** `allow write: if request.auth != null && request.auth.uid == userId;` ensuring users can only write to their specific document.
3.  **Cross-Wallet Data Isolation:** Database keys are dynamically generated using `${walletAddress}_${key}` to prevent data collision when switching accounts on the same device.
*Note: Future production updates will transition from Anonymous Auth to full SIWE (Sign-In with Ethereum) for cross-device synchronization.*

## ⚙️ Local Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Ayan1816/nexoria

 * Install dependencies:
   npm install

 * Run the development server:
   npm run dev

🔗 Live Demo
Experience Nexoria Here https://nexoria-app.vercel.app (Connect via MetaMask or Rabby on Arc Testnet)
Built with ❤️ for the Web3 Ecosystem.


