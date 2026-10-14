# Nexoria

Nexoria is a non-custodial financial command suite for businesses that pay in USDC and EURC on Arc. The connected wallet holds the keys and signs every transfer. Nexoria never takes custody of funds.

The demo network is **Arc Testnet**: chain ID `5042002` (`0x4cef52`), RPC `https://rpc.testnet.arc.io`. The same app also speaks **Arc mainnet**: chain ID `5042` (`0x13b2`), RPC `https://rpc.mainnet.arc.io`. Gas on both networks is USDC.

## Vision

A business should be able to pay a vendor, run payroll, leave a public memo, schedule a payment, and export the receipts without giving a server the private key. Nexoria keeps that workflow in one dark-themed web app:

- Pay one recipient in USDC or EURC, after a pre-sign check of the address.
- Pay up to 25 recipients in one payroll transaction, from typed lines, saved contacts, or a CSV.
- Queue a payment and sign it only when it is due.
- Attach a public on-chain memo.
- Keep a local ledger and an address book, revoke token allowances, and deploy a fixed-supply token.

## Networks and contracts

| | Arc Testnet | Arc mainnet |
| --- | --- | --- |
| Chain ID | `5042002` / `0x4cef52` | `5042` / `0x13b2` |
| RPC | `https://rpc.testnet.arc.io` | `https://rpc.mainnet.arc.io` |
| Explorer | `https://explorer.testnet.arc.io` | `https://explorer.arc.io` |
| Faucet | [https://faucet.circle.com](https://faucet.circle.com) | none |
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` | `0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1` |

These addresses are the same on both networks:

| Use | Address |
| --- | --- |
| USDC | `0x3600000000000000000000000000000000000000` |
| Memo | `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` |
| Multicall3From | `0x522fAf9A91c41c443c66765030741e4AaCe147D0` |

The app does not use the retired `rpc.testnet.arc.network` host. If the wallet does not know the chain, Nexoria adds it with `wallet_addEthereumChain` after `wallet_switchEthereumChain` reports an unknown chain (`4902` or an unrecognized-chain message). Rejecting the switch does not add the chain. Connecting a wallet does not switch networks by itself.

## Arc mechanics and asset telemetry

Arc uses USDC for gas. Nexoria treats the two USDC scales as one balance and never mixes them.

- **Native USDC** has 18 decimals. `eth_getBalance` and the gas fee use this scale. The wallet native currency is registered as USDC with 18 decimals.
- **ERC-20 USDC** at the precompile above has 6 decimals. Transfers and approvals use this scale. The ERC-20 balance is the native balance with the last 12 decimals truncated.
- **EURC** is a separate 6-decimal token. A EURC payment still pays gas in USDC.

Before a send, the app quotes an EIP-1559 fee with `getFeeData` and the latest block:

- `maxFeePerGas` is the larger of twice the base fee and the quoted gas price.
- The fee is at least 20 gwei. Arc drops transactions under that floor.
- The fee is never above 20,000 gwei.
- `maxPriorityFeePerGas` sent by the app is `0`.
- The gas limit is the estimate plus 20 percent, and it must fit in a block.

The header shows live telemetry for the connected Arc network: USDC balance, EURC balance, the current block, and a reference fee for a normal ERC-20 transfer. The fee is displayed in USDC. On Arc Testnet the header links to the Circle faucet. A refresh button reads the balances again. If USDC or EURC does not report 6 decimals, balances stay hidden so a payment cannot use the wrong scale.

Payment transactions send **value 0**. USDC and EURC move with `transfer`. The quoted gas ceiling is shown in the execution log after confirmation. One confirmation is final. The sender is checked with `isBlacklisted` before the wallet is asked to sign. If that view is missing, the payment is not blocked on the view alone. `estimateGas` remains the backstop.

## Features

### 1. Batch payments and Send Guard

Batch payments is a single-recipient form: recipient, amount, **Send USDC**, and **Send EURC**. One click sends one `transfer`. It does not parse a sentence such as "Send 1 USDC to…". Multi-recipient payment lives in Payroll.

Send Guard runs after the recipient and amount are valid, and again immediately before the wallet signs. It does not call a language model. Two checks decide the color:

1. **Contract check.** `eth_getCode` on the recipient. Empty code (`0x`, `0x0`, or all-zero bytes) is a standard wallet. Any other bytecode is a contract. An EIP-7702 account that carries code is treated as a contract. If the node returns malformed code, the payment is not sent.
2. **History check.** The recipient is compared with the local ledger for this wallet. A matching `to` address is known. Anything else is new.

| Color | Meaning | What you must do |
| --- | --- | --- |
| Green | Known standard wallet | Send USDC or Send EURC |
| Yellow | New standard wallet | Press **Acknowledge & Proceed**, then send |
| Red | Smart contract | Press **Acknowledge & Proceed**, then send |

Acknowledging a new wallet does not authorize a later contract result. Changing the recipient or the amount runs the check again and clears the acknowledgement. Picking a saved contact fills the address and still runs Send Guard. Payroll and scheduled payments do not use Send Guard.

### 2. Payroll

Payroll pays many people in one transaction. Choose USDC or EURC, optionally set an amount that fills any line which omits one, then list recipients:

```text
0xabc… 1.5
0xdef…
```

A line is an address, or an address and an amount. Duplicate addresses are rejected. A batch holds at most **25** recipients. One recipient calls `transfer`. More than one recipient is packed into a single **Multicall3From** transaction.

**Upload CSV** reads a file in the browser. **Download sample CSV** saves `nexoria-payroll-sample.csv`.

Accepted shapes:

```text
0x1111111111111111111111111111111111111111,50
```

```text
address,amount
0x1111111111111111111111111111111111111111,50
Office Rent,25.5
```

The first column may be named `address`, `recipient`, `wallet`, `contact`, `contact name`, or `name`. The amount column may be named `amount` or `value`. A contact name must match a saved contact for this wallet exactly, ignoring case. Amounts must be greater than zero and may use at most 6 decimal places.

If any row is invalid, the recipient list is left unchanged and the screen lists the bad rows. A valid file replaces the list and shows how many recipients were loaded. **Select contact** can also append a saved address on its own line.

### 3. Scheduled payments

Scheduled payments queue a USDC or EURC payment for 1 minute to 7 days from now. The timer only moves the task from `pending` to `ready`. It never broadcasts a transaction. When the task is ready, you press send and the wallet signs it. Open tasks are capped at 20. Tasks survive a reload because they are stored with the ledger. After a reload, a still-pending timer is armed again. Nothing is signed until you confirm it.

### 4. On-chain memo

On-chain memo writes a public message through Arc's Memo contract. The message rides on a zero-value USDC `transfer` to the recipient you choose. The only USDC spent is gas. The text is calldata. Anyone who reads the transaction can read it. Messages must be 1 to 256 bytes of text, with no null character. The screen states that the memo is public before you send.

### 5. Utilities

Utilities has four tabs: Ledger, Contacts, Allowance, and Token.

#### Ledger and CSV export

Every confirmed or reverted payment, payroll, memo, scheduled send, and token deployment appends a receipt for the connected address. A receipt stores the transaction hash, display amount, token, recipient, chain ID, status (`confirmed` or `reverted`), and an ISO timestamp. The list keeps the newest 50 receipts. The Ledger tab shows a local date and time and links each hash to the explorer for the chain that mined it.

**Export CSV** waits for the save queue, reads the newer of localStorage and IndexedDB, and downloads `nexoria-ledger-{address}-{date}.csv`. Columns are **Date**, **Amount**, **Token**, and **Recipient Address**. ISO timestamps are written in UTC. Older receipts that only stored a clock time keep that clock time. The file is UTF-8 with a byte-order mark. Cells that start with `=`, `+`, `@`, a tab, or a carriage return are prefixed so a spreadsheet does not treat them as formulas. An empty ledger does not download a file.

**Clear history** asks for confirmation and removes the saved receipts for this wallet.

#### Contacts

Contacts is a local address book for the connected wallet. Save a name such as `Office Rent` or `Freelancer` with an EVM address. You can edit or delete a row. Delete asks for confirmation.

Rules:

- Names are 1 to 40 printable characters. Extra spaces are collapsed.
- Addresses must be non-zero `0x` addresses and are stored in lowercase.
- Names and addresses must be unique. Name checks ignore case.
- A wallet can store 100 contacts.

The book is not part of the ledger document and is not written to Firebase. Batch payments can autocomplete a name or use **Select contact**. Payroll can insert a contact or resolve a name from a CSV. Switching wallets loads that wallet's book.

#### Allowance Revoke Dashboard

The Allowance tab lists active USDC and EURC approvals granted by the connected wallet on **Arc Testnet**. Public RPC nodes cannot scan the full approval history, so discovery uses the testnet explorer log API, filtered to this owner and the ERC-20 `Approval` topic. A live `allowance(owner, spender)` call then drops spenders whose remaining allowance is zero. Amounts of `2^255` or more are shown as **Unlimited**.

**Revoke** sends `approve(spender, 0)` on that token and refreshes the list after the receipt. The button stays busy while the wallet is signing. On any other network the tab asks you to switch to Arc Testnet. It does not scan mainnet. A brand-new approval appears after the explorer indexes it.

#### Token

The Token tab deploys `FixedSupplyToken` from the compiled bytecode in `pulse-app/src/contracts/FixedSupplyToken.json`. You enter a name, a symbol (`A`–`Z` and digits, 2 to 8 characters), and a whole supply from 1 to 1,000,000,000,000,000. The constructor mints the entire supply, in 18 decimals, to the connected wallet. The contract has no owner and no second mint. Moving a non-zero allowance requires setting it to zero first. The app does not call a preset factory address. Deployment gas is USDC, quoted with the same fee floor as payments.

`contracts/src/NexoriaTokenFactory.sol` can deploy the same token, but the running app does not use it.

### 6. System terminal and wallets

The terminal is the execution log under the workspace. It records connects, confirmations, gas ceilings, exports, CSV loads, and errors, with a UTC clock time on each line. It keeps the newest 200 lines. It is not a shell and it cannot sign by itself.

Wallet discovery uses **EIP-6963**. Every announced provider appears in the connect dialog with its name and icon. That includes Rabby, Phantom, Nightly, and any other injected wallet that announces itself. If none announce, and `window.ethereum` exists, the dialog offers **Browser wallet**. Nexoria asks for accounts with `eth_requestAccounts` and then reads the chain. It does not request a seed phrase.

## How it works

1. Open the app and connect a wallet from the EIP-6963 list.
2. If the wallet is not on Arc, switch to Arc Testnet or Arc mainnet. On testnet, use **Testnet faucet** if the USDC balance is empty. The header then shows USDC, EURC, the block, and the reference gas fee.
3. Open **Utilities → Contacts** and save the people you pay. Names stay in this browser for this wallet.
4. Open **Batch payments**. Enter a recipient, or pick a contact, and an amount. Wait for Send Guard. A known wallet can send immediately. A new wallet or a contract needs **Acknowledge & Proceed**. Choose **Send USDC** or **Send EURC**. Confirm the signature in the wallet. The receipt lands in the ledger.
5. Open **Payroll** for a group payment. Type lines, pick contacts, or upload a CSV. Fix any row errors before **Send payroll**. One transaction pays the whole list, up to 25 people.
6. Open **Scheduled payments** to queue a future payment. Come back when it is marked ready and sign it yourself.
7. Open **On-chain memo** to attach a public note to a zero-value USDC transfer.
8. Open **Utilities → Allowance** on Arc Testnet and revoke any spender you no longer trust.
9. Open **Utilities → Ledger** and press **Export CSV** for the accounting file.
10. Open **Utilities → Token** only when you intend to deploy a new fixed-supply token. That is separate from USDC and EURC.

## Privacy and security

Nexoria is local-first and non-custodial.

- Private keys stay in the wallet. The app requests signatures through EIP-1193 and cannot move funds on its own.
- The recipient list, amounts, and memos are built in the browser. CSV parsing never leaves the device.
- Receipts and scheduled tasks are stored for the connected address under `nexoria.v1.{address}` in **localStorage** and in **IndexedDB** (`nexoria.ledger` / `wallets`). The copy with the newer `updatedAt` wins. On a tie, localStorage wins. A read repairs the older copy. A write succeeds if either store accepts it.
- Contacts use `nexoria.contacts.v1.{address}` in those same two stores. They are not uploaded.
- Optional cloud sync uses Firebase Anonymous Auth and Firestore. It is a browser-profile backup, not Sign-In with Ethereum. Without `VITE_FIREBASE_*` values, the app stays fully local. Auth or rules failures stay quiet and keep the local ledger. Firestore rules allow a wallet document to contain only `updatedAt`, `txHistory` (max 50), and `tasks` (max 20). Deletes are denied.
- Send Guard checks bytecode and local history before a one-to-one payment. The check runs a second time immediately before `sendTransfers`.
- USDC blocklist is checked on the sender before a payment is offered to the wallet.
- User rejection, an account change mid-flight, a chain change, and a reverted receipt are surfaced as errors. A reverted transaction can still be stored so the ledger shows that it failed.

The theme preference (`nexoria.theme`) is the only setting stored outside the wallet documents. Dark is the default.

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 19, Vite 8, Tailwind CSS 3 |
| Icons and motion | lucide-react, canvas-confetti |
| Chain access | ethers v6 `BrowserProvider` over the wallet's EIP-1193 provider |
| Wallet discovery | EIP-6963 |
| Optional backup | Firebase Auth (anonymous) and Cloud Firestore |
| Contracts | Solidity 0.8.28, compiled with `solc` |
| Tests | Node.js built-in test runner (`node --test`) |
| Lint | ESLint 10 with the React hooks plugin |

`package.json` also lists `viem`, `framer-motion`, and `@circle-fin/adapter-viem-v2` / `@circle-fin/app-kit`. The current UI does not import them. Payments, gas quotes, and contract calls go through ethers.

## Project structure

```text
nexoria/
  README.md                 this document
  contracts/
    compile.mjs             writes the JSON artifacts into the app
    src/FixedSupplyToken.sol
    src/NexoriaTokenFactory.sol
  pulse-app/                Vite application (Vercel root)
    index.html
    firestore.rules         deploy with the Firebase project; not applied by the app
    .env.example            Firebase web config names only
    src/App.jsx             screens
    src/main.jsx
    src/hooks/useAnnouncedWallets.js
    src/contracts/FixedSupplyToken.json
    src/lib/                payments, gas, networks, storage, guard, CSV, contacts
```

| Module | Responsibility |
| --- | --- |
| `networks.js` | Arc chain IDs, RPCs, explorers, precompiles |
| `arcGas.js` | 6-decimal versus 18-decimal USDC, fee floor and ceiling, gas buffer |
| `payments.js` | Balances, `transfer`, Multicall3From payroll, memo, allowance revoke, token deploy |
| `sendGuard.js` | Bytecode and ledger classification |
| `payrollCsv.js` | Local CSV parse and row validation |
| `parse.js` | Addresses, payroll lines, memo length, schedule delay |
| `storage.js` | Dual local ledger and optional Firestore |
| `contacts.js` | Dual local address book |
| `allowances.js` | Testnet approval discovery and live allowance reads |
| `ledgerCsv.js` | Accounting CSV download |
| `walletChain.js` | Switch chain, then add chain when the wallet does not know it |
| `state.js` | Receipt and task sanitizing, history cap, task cap |

## Getting started

Requirements: Node.js with `npm`, and a browser wallet that speaks EIP-1193.

```bash
cd pulse-app
npm install
npm test
npm run lint
npm run dev
```

The dev server listens on `http://localhost:5173/`. It is not exposed on the LAN unless you pass `--host`.

Production build:

```bash
cd pulse-app
npm run build
npm run preview
```

`npm run build` writes `pulse-app/dist`. That directory is gitignored.

Optional cloud backup:

```bash
cp .env.example .env
```

Fill in the Firebase web config. Do not commit `.env`. Deploy `pulse-app/firestore.rules` in the Firebase console. Until those values exist, receipts and scheduled tasks remain on the device.

After a Solidity change, rebuild the artifact from `pulse-app`:

```bash
node ../contracts/compile.mjs
```

The compiler must be solc 0.8.28, matching the pragma. `solc` is already a dev dependency of `pulse-app`.

### Tests

`npm test` runs the `src/lib/*.test.js` files with `node --test`. The suite covers amounts, Arc gas, payroll parsing, payroll CSV, networks, payments, chain add/switch, the dual ledger, allowances, ledger CSV, Send Guard, contacts, and an audit that the UI still sends USDC and EURC directly and does not call a preset factory. Storage tests print an expected quota error and an expected `auth/operation-not-allowed` error. Those cases are the success path for "keep the local copy when the browser or the cloud refuses."

## Deployment

Host the Vite app, not the repository root. For Vercel:

- Root directory: `pulse-app`
- Install: `npm install`
- Build: `npm run build`
- Output: `dist`
- Framework: Vite

Leave Firebase variables empty on Vercel unless you intend to turn on optional cloud sync. Never put a Firebase API key in source. `node_modules`, `dist`, and `.env` stay out of git.
