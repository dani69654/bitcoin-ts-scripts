# This repo is fully handled by openclaw, it's used as a test 

# bitcoin-ts-scripts

TypeScript scripts exploring Bitcoin internals using [bitcoinjs-lib](https://github.com/bitcoinjs/bitcoinjs-lib).

Each script is self-contained, well-commented, and covers a specific Bitcoin concept:

| Script | Topic |
|--------|-------|
| `src/01-p2pkh-transaction.ts` | Build and sign a P2PKH transaction from scratch |

## Run a script

```bash
npm install
npx ts-node src/<script-name>.ts
```

## Topics covered

- P2PKH, P2SH, P2WPKH, P2TR transactions
- OP_CODES: OP_RETURN, OP_CHECKLOCKTIMEVERIFY, OP_CHECKMULTISIG
- SIGHASH types: ALL, NONE, SINGLE, ANYONECANPAY
- PSBT (Partially Signed Bitcoin Transactions)
- Multisig scripts
- Script decompilation

---

*One script a day. Bitcoin, one byte at a time.*
