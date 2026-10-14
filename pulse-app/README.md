# Nexoria app

The Vite application lives in this directory. The full project guide is the repository [README](../README.md): networks, Send Guard, payroll CSV, ledger, contacts, allowances, storage, and deployment.

```bash
npm install
npm test
npm run lint
npm run dev
npm run build
```

Copy `.env.example` to `.env` only when you want optional Firebase sync. Without those values, receipts and scheduled tasks stay in localStorage and IndexedDB for the connected address. Do not commit `.env`. Deploy `firestore.rules` with the Firebase project if you enable sync.

Token deployment uses `src/contracts/FixedSupplyToken.json`. Payments call Arc's USDC, EURC, Memo, and Multicall3From contracts. After a Solidity change, rebuild the artifact from this directory:

```bash
node ../contracts/compile.mjs
```
