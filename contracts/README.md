# Nexoria contracts

`FixedSupplyToken` mints once, to the recipient passed by the deployer, and has no owner. `NexoriaTokenFactory` deploys that token and mints to `msg.sender`. Neither contract can mint again, pull tokens, or accept native USDC.

The app does not call a pre-set factory address. Token creation deploys `FixedSupplyToken` bytecode from `pulse-app/src/contracts/FixedSupplyToken.json`. Payments do not use these contracts. USDC, EURC, memos, and batch transfers use Arc's predeployed contracts.

`solc` is a dev dependency of `pulse-app`. Rebuild the artifacts from that directory after a Solidity change:

```bash
node ../contracts/compile.mjs
```

The compiler must be 0.8.28, matching the pragma. Deployment gas is USDC, quoted with the same fee floor as payments.
