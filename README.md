# Nexoria

Nexoria is a non-custodial financial command suite for businesses that pay in official Arc tokens, including USDC, EURC, USYC, cirBTC, and WETH, plus custom ERC-20s saved in the browser. The connected wallet holds the keys and signs every transfer. Nexoria never takes custody of funds.

The production network is **Arc** (mainnet): chain ID `5042` (`0x13b2`), RPC `https://rpc.mainnet.arc.io`, explorer `https://explorer.arc.io`. **Arc Testnet** stays available in the same wallet switcher: chain ID `5042002` (`0x4cef52`), RPC `https://rpc.testnet.arc.io`, explorer `https://explorer.testnet.arc.io`. The Circle faucet is shown only while the wallet is on Arc Testnet. Gas on both networks is USDC. Connecting a wallet does not switch chains.

## Vision

A business should be able to pay a vendor, run payroll, leave a public memo, schedule a payment, and export the receipts without giving a server the private key. Nexoria keeps that workflow in one dark-themed web app:

- Pay one recipient in any official Arc token or a saved custom ERC-20, after a pre-sign check of the address.
- Pay up to 25 recipients in one payroll transaction, from typed lines, saved contacts, or a CSV.
- Queue a payment in any supported token and sign it only when it is due.
- Attach a public on-chain memo.
- Keep a local ledger and an address book, revoke token allowances, and deploy a fixed-supply token.

## Networks and contracts

| | Arc | Arc Testnet |
| --- | --- | --- |
| Chain ID | `5042` / `0x13b2` | `5042002` / `0x4cef52` |
| RPC | `https://rpc.mainnet.arc.io` | `https://rpc.testnet.arc.io` |
| Explorer | `https://explorer.arc.io` | `https://explorer.testnet.arc.io` |
| Faucet | none | [https://faucet.circle.com](https://faucet.circle.com) |

Official payment tokens were checked with `eth_getCode`, `name()`, `symbol()`, and `decimals()` on both RPCs. Each row is `isOfficial: true`. Gateway wallet and minter contracts are not payment tokens and are not listed.

| Token | Decimals | Arc | Arc Testnet |
| --- | --- | --- | --- |
| USDC | 6 | `0x3600000000000000000000000000000000000000` | `0x3600000000000000000000000000000000000000` |
| EURC | 6 | `0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1` | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` |
| USYC | 6 | `0x8a5D989Bbb96929F689B0200f435f53dA42bF490` | `0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C` |
| cirBTC | 8 | `0x171A4217b86A807A64eB94757Db6849fb4bDbAA0` | `0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF` |
| WETH | 18 | `0x128cC466B61f542da60c70e3aA11c10e19B84EDB` | `0x2c4047028a72803939b6fb674D01bC059B5C4961` |

USDC is the gas token. cirBTC is Circle Wrapped Bitcoin. USYC is US Yield Coin. WETH is the official bridged Wrapped Ether. A token that is not deployed on a network is omitted from that network; today these five are on both.

These contracts are the same on both networks and are not payment tokens:

| Use | Address |
| --- | --- |
| Memo | `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` |
| Multicall3From | `0x522fAf9A91c41c443c66765030741e4AaCe147D0` |

The app does not use the retired `rpc.testnet.arc.network` host. If the wallet does not know the chain, Nexoria adds it with `wallet_addEthereumChain` after `wallet_switchEthereumChain` reports an unknown chain (`4902` or an unrecognized-chain message). Rejecting the switch does not add the chain. Connecting a wallet does not switch networks by itself.

## Arc mechanics and asset telemetry

Arc uses USDC for gas. Nexoria treats the two USDC scales as one balance and never mixes them.

- **Native USDC** has 18 decimals. `eth_getBalance` and the gas fee use this scale. The wallet native currency is registered as USDC with 18 decimals.
- **ERC-20 USDC** at the precompile above has 6 decimals. Transfers and approvals use this scale. The ERC-20 balance is the native balance with the last 12 decimals truncated. The header shows that one USDC figure, not a second native balance.
- **EURC** and **USYC** are separate 6-decimal tokens. **cirBTC** uses 8 decimals. **WETH** and a deployed FixedSupplyToken use 18 decimals. Every non-USDC payment still pays gas in USDC.
- Before a transfer, payroll run, or scheduled send, `decimals()` on the token must match the registry or the saved custom token. A mismatch stops the payment.

Before a send, the app quotes an EIP-1559 fee with `getFeeData` and the latest block:

- `maxFeePerGas` is the larger of twice the base fee and the quoted gas price.
- The fee is at least 20 gwei. Arc drops transactions under that floor.
- The fee is never above 20,000 gwei.
- `maxPriorityFeePerGas` sent by the app is `0`.
- The gas limit is the estimate plus 20 percent, and it must fit in a block.

The header shows live telemetry for the connected Arc network: the USDC balance, then EURC, USYC, cirBTC, WETH, and saved custom tokens in a short scrolling list. The current block and a reference fee for a normal ERC-20 transfer stay visible. The fee is displayed in USDC. On Arc Testnet the header links to the Circle faucet. A refresh button reads the balances again. If USDC does not report 6 decimals, or the USDC contract balance does not match the native balance, balances stay hidden. A different token that fails its own decimals check is shown as unavailable and does not hide USDC.

Payment transactions send **value 0**. The selected token moves with `transfer`. The quoted gas ceiling is shown in the execution log after confirmation. One confirmation is final. The sender and recipients are checked with `isBlacklisted` before the wallet is asked to sign when that token exposes the view (USDC, EURC, and cirBTC do). USYC, WETH, and a normal ERC-20 that reverts the view are not blocked for that reason. `estimateGas` remains the backstop.

## Features

### 1. Batch payments and Send Guard

Batch payments is a single-recipient form: token, recipient, amount, and **Send**. The token list is the official Arc registry for the connected network plus custom tokens saved for that wallet and chain. One click sends one `transfer`. It does not parse a sentence such as "Send 1 USDC to…". Multi-recipient payment lives in Payroll.

Send Guard runs after the recipient and amount are valid, and again immediately before the wallet signs. It does not call a language model. Two checks decide the color:

1. **Contract check.** `eth_getCode` on the recipient. Empty code (`0x`, `0x0`, or all-zero bytes) is a standard wallet. Any other bytecode is a contract. An EIP-7702 account that carries code is treated as a contract. If the node returns malformed code, the payment is not sent.
2. **History check.** The recipient is compared with the local ledger for this wallet. A matching `to` address is known. Anything else is new.

| Color | Meaning | What you must do |
| --- | --- | --- |
| Green | Known standard wallet | Send the selected token |
| Yellow | New standard wallet | Press **Acknowledge & Proceed**, then send |
| Red | Smart contract | Press **Acknowledge & Proceed**, then send |

Acknowledging a new wallet does not authorize a later contract result. Changing the recipient or the amount runs the check again and clears the acknowledgement. Picking a saved contact fills the address and still runs Send Guard. Payroll and scheduled payments do not use Send Guard.

### 2. Payroll

Payroll pays many people in one transaction. Choose any official or custom token, optionally set an amount that fills any line which omits one, then list recipients:

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

The first column may be named `address`, `recipient`, `wallet`, `contact`, `contact name`, or `name`. The amount column may be named `amount` or `value`. A contact name must match a saved contact for this wallet exactly, ignoring case. Amounts must be greater than zero and may use at most as many decimal places as the selected token (6 for USDC, EURC, and USYC, 8 for cirBTC, 18 for WETH and a fixed-supply token).

If any row is invalid, the recipient list is left unchanged and the screen lists the bad rows. A valid file replaces the list and shows how many recipients were loaded. **Select contact** can also append a saved address on its own line.

### 3. Scheduled payments

Scheduled payments queue a payment in any supported token for 1 minute to 7 days from now. The timer only moves the task from `pending` to `ready`. It never broadcasts a transaction. When the task is ready, you press send and the wallet signs it. The saved task keeps the token id and, for a custom token, the contract address and decimals. Open tasks are capped at 20. Tasks survive a reload because they are stored with the ledger. After a reload, a still-pending timer is armed again. Nothing is signed until you confirm it. Older USDC and EURC tasks still load.

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

The Allowance tab lists active approvals for every official Arc token and every saved custom token on the connected network, on **Arc** and on **Arc Testnet**. Discovery tries that network's official explorer log API first (`https://explorer.arc.io/api` or `https://explorer.testnet.arc.io/api`), filtered to this owner and the ERC-20 `Approval` topic. If that request is challenged or does not return JSON, Nexoria tries the Blockscout v2 log route on the same explorer (`/api/v2/addresses/{token}/logs`). If that also fails, it asks the wallet RPC for `eth_getLogs` over the last 9,999 blocks, which stays inside the public 10,000-block cap. That RPC result is marked partial: older approvals can be missing. A result of 10,000 explorer logs is rejected as truncated instead of being replaced with a shorter window. A live `allowance(owner, spender)` call then drops spenders whose remaining allowance is zero. Amounts of `2^255` or more are shown as **Unlimited**. Each amount uses that token's decimals.

**Revoke** sends `approve(spender, 0)` on that token and refreshes the list after the receipt. The button stays busy while the wallet is signing. Gas for the revoke is USDC. On any chain other than Arc or Arc Testnet, the tab asks you to switch to Arc. A brand-new approval appears after the explorer indexes it. The partial RPC scan can show it immediately.

#### Token

The Token tab deploys `FixedSupplyToken` from the compiled bytecode in `pulse-app/src/contracts/FixedSupplyToken.json`. You enter a name, a symbol (`A`–`Z` and digits, 2 to 8 characters), and a whole supply from 1 to 1,000,000,000,000,000. The constructor mints the entire supply, in 18 decimals, to the connected wallet. The contract has no owner and no second mint. Moving a non-zero allowance requires setting it to zero first. The app does not call a preset factory address. Deployment gas is USDC, quoted with the same fee floor as payments.

After a deploy, Nexoria reads `name()`, `symbol()`, and `decimals()` from the new contract. When those match the form and decimals are 18, the token is saved as a custom token for this wallet on this chain. If the read does not match, the screen offers **Add {symbol} to custom tokens**. The same tab accepts any other Arc ERC-20 address. Nexoria checks that the address has code, is not already an official token, and returns a symbol, name, and 0 to 18 decimals. Custom tokens live at `nexoria.tokens.v1.{address}.{chainId}` in localStorage and in IndexedDB (`nexoria.ledger` / `wallets`). They are not written to Firebase. A wallet can store 100 custom tokens on each Arc network. Removing one asks for confirmation. Official addresses cannot be imported again.

`contracts/src/NexoriaTokenFactory.sol` can deploy the same token, but the running app does not use it.

### 6. System terminal and wallets

The terminal is the execution log under the workspace. It records connects, confirmations, gas ceilings, exports, CSV loads, and errors, with a UTC clock time on each line. It keeps the newest 200 lines. It is not a shell and it cannot sign by itself.

Wallet discovery uses **EIP-6963**. Every announced provider appears in the connect dialog with its name and icon. That includes Rabby, Phantom, Nightly, and any other injected wallet that announces itself. If none announce, and `window.ethereum` exists, the dialog offers **Browser wallet**. Nexoria asks for accounts with `eth_requestAccounts` and then reads the chain. It does not request a seed phrase.

## How it works

1. Open the app and connect a wallet from the EIP-6963 list.
2. If the wallet is not on Arc, switch to Arc or Arc Testnet. The network list puts Arc first. On testnet, use **Testnet faucet** if the USDC balance is empty. The header then shows USDC, the other Arc tokens, the block, and the reference gas fee.
3. Open **Utilities → Contacts** and save the people you pay. Names stay in this browser for this wallet. Open **Utilities → Token** to add a custom ERC-20 or to deploy one.
4. Open **Batch payments**. Choose a token, then enter a recipient, or pick a contact, and an amount. Wait for Send Guard. A known wallet can send immediately. A new wallet or a contract needs **Acknowledge & Proceed**. Press **Send**. Confirm the signature in the wallet. The receipt lands in the ledger.
5. Open **Payroll** for a group payment. Type lines, pick contacts, or upload a CSV. Fix any row errors before **Send payroll**. One transaction pays the whole list, up to 25 people.
6. Open **Scheduled payments** to queue a future payment. Come back when it is marked ready and sign it yourself.
7. Open **On-chain memo** to attach a public note to a zero-value USDC transfer.
8. Open **Utilities → Allowance** on Arc or Arc Testnet and revoke any spender you no longer trust.
9. Open **Utilities → Ledger** and press **Export CSV** for the accounting file.
10. Open **Utilities → Token** to deploy a fixed-supply token or to paste a custom ERC-20. A saved custom token can be selected in Batch payments, Payroll, and Scheduled payments.

## Privacy and security

Nexoria is local-first and non-custodial.

- Private keys stay in the wallet. The app requests signatures through EIP-1193 and cannot move funds on its own.
- The recipient list, amounts, and memos are built in the browser. CSV parsing never leaves the device.
- Receipts and scheduled tasks are stored for the connected address under `nexoria.v1.{address}` in **localStorage** and in **IndexedDB** (`nexoria.ledger` / `wallets`). The copy with the newer `updatedAt` wins. On a tie, localStorage wins. A read repairs the older copy. A write succeeds if either store accepts it.
- Contacts use `nexoria.contacts.v1.{address}` in those same two stores. They are not uploaded.
- Custom tokens use `nexoria.tokens.v1.{address}.{chainId}` in those same two stores. Mainnet and testnet lists stay separate. They are not uploaded.
- Optional cloud sync uses Firebase Anonymous Auth and Firestore. It is a browser-profile backup, not Sign-In with Ethereum. Without `VITE_FIREBASE_*` values, the app stays fully local. Auth or rules failures stay quiet and keep the local ledger. Firestore rules allow a wallet document to contain only `updatedAt`, `txHistory` (max 50), and `tasks` (max 20). Deletes are denied.
- Send Guard checks bytecode and local history before a one-to-one payment. The check runs a second time immediately before `sendTransfers`.
- Tokens that implement `isBlacklisted` are checked on the sender and the recipients before a payment is offered to the wallet. A token without that view is not blocked for lacking it.
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

Payments, gas quotes, and contract calls go through ethers. The app does not depend on `viem`, `framer-motion`, or the Circle App Kit packages.

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
| `networks.js` | Arc chain IDs, RPCs, explorers, and the official token registry |
| `arcGas.js` | Native USDC gas, per-token balances, fee floor and ceiling, gas buffer |
| `payments.js` | Balances, `transfer`, Multicall3From payroll, memo, allowance revoke, token deploy |
| `customTokens.js` | Dual local custom ERC-20 list and on-chain metadata checks |
| `sendGuard.js` | Bytecode and ledger classification |
| `payrollCsv.js` | Local CSV parse and row validation at the selected decimals |
| `parse.js` | Addresses, payroll lines, memo length, schedule delay |
| `storage.js` | Dual local ledger and optional Firestore |
| `contacts.js` | Dual local address book |
| `allowances.js` | Approval discovery on both Arc networks, with explorer and RPC fallbacks |
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

`npm test` runs the `src/lib/*.test.js` files with `node --test`. The suite covers 6, 8, and 18 decimal amounts, Arc gas, the official token registry, custom token checks, payroll parsing, payroll CSV, networks, payments, chain add/switch, the dual ledger, allowances and their explorer fallbacks, ledger CSV, Send Guard, contacts, and an audit that the payment screen keeps a token selector and Send Guard and does not call a preset factory. Storage tests print an expected quota error and an expected `auth/operation-not-allowed` error. Those cases are the success path for "keep the local copy when the browser or the cloud refuses."

## Deployment

Host the Vite app, not the repository root. For Vercel:

- Root directory: `pulse-app`
- Install: `npm install`
- Build: `npm run build`
- Output: `dist`
- Framework: Vite

Leave Firebase variables empty on Vercel unless you intend to turn on optional cloud sync. Never put a Firebase API key in source. `node_modules`, `dist`, and `.env` stay out of git.
