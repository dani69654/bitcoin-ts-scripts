/**
 * 01-p2pkh-transaction.ts
 *
 * Build and sign a Pay-to-Public-Key-Hash (P2PKH) transaction from scratch.
 *
 * P2PKH is the classic Bitcoin transaction format, used since the beginning.
 * The locking script (scriptPubKey) looks like:
 *   OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG
 *
 * To spend it, the unlocking script (scriptSig) must provide:
 *   <signature> <publicKey>
 *
 * Bitcoin then verifies: hash(publicKey) == pubKeyHash, and the signature is valid.
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';

const ECPair = ECPairFactory(ecc);

// Use testnet so we don't need real funds
const network = bitcoin.networks.testnet;

// ── 1. Generate a key pair ────────────────────────────────────────────────────
//
// In production you'd derive keys from a BIP39 mnemonic via BIP32/BIP44.
// Here we generate a random key for demonstration.
const keyPair = ECPair.makeRandom({ network });

const { address } = bitcoin.payments.p2pkh({
  pubkey: Buffer.from(keyPair.publicKey),
  network,
});

console.log('=== Key Pair ===');
console.log('Address (P2PKH):', address);
console.log('Public key (hex):', Buffer.from(keyPair.publicKey).toString('hex'));
// Never log private keys in production!
console.log('Private key (WIF):', keyPair.toWIF());

// ── 2. Build the transaction ──────────────────────────────────────────────────
//
// A Bitcoin transaction has:
//   - inputs:  references to previous UTXOs being spent
//   - outputs: new UTXOs being created
//
// Each input must reference a UTXO by its txid + vout index.
// The value is implicit — Bitcoin nodes look it up from their UTXO set.

const txb = new bitcoin.Psbt({ network });

// Add a fake input (in reality this would be a real UTXO from your wallet)
// txid: the transaction that created this UTXO
// vout: which output index in that transaction
txb.addInput({
  hash: 'a'.repeat(64), // fake txid (32 bytes hex)
  index: 0,
  // For P2PKH we need the full scriptPubKey of the UTXO we're spending
  nonWitnessUtxo: buildFakeUtxoTx(address!, network),
});

// Add outputs: recipient + change back to ourselves
// Amounts in satoshis (1 BTC = 100_000_000 satoshis)
const SEND_AMOUNT = 50_000;   // 0.0005 BTC
const CHANGE_AMOUNT = 49_000; // 0.00049 BTC (difference = 1000 sat fee)

txb.addOutput({
  address: 'mvNyptwisQTmwL3vN8VMaVUrA3swVCX83c', // recipient (testnet addr)
  value: SEND_AMOUNT,
});

txb.addOutput({
  address: address!, // change back to ourselves
  value: CHANGE_AMOUNT,
});

// ── 3. Sign the input ─────────────────────────────────────────────────────────
//
// Default SIGHASH is SIGHASH_ALL (0x01), which commits to:
//   - all inputs
//   - all outputs
//   - the sequence numbers
//
// This prevents any part of the transaction from being modified after signing.

txb.signInput(0, {
  publicKey: Buffer.from(keyPair.publicKey),
  sign: (hash: Buffer) => Buffer.from(ecc.sign(hash, keyPair.privateKey!)),
});

txb.finalizeAllInputs();

const tx = txb.extractTransaction();

console.log('\n=== Transaction ===');
console.log('TXID:', tx.getId());
console.log('Size:', tx.byteLength(), 'bytes');
console.log('vSize:', tx.virtualSize(), 'vbytes');
console.log('Weight:', tx.weight(), 'WU');
console.log('\nRaw hex:');
console.log(tx.toHex());

// Decode the scriptSig to show what's inside
const input = tx.ins[0];
const scriptSigAsm = bitcoin.script.toASM(input.script);
console.log('\nscriptSig (ASM):', scriptSigAsm);
// You'll see: <DER signature> <public key>

// ── Helper: build a fake previous transaction ─────────────────────────────────
//
// nonWitnessUtxo requires the full serialized previous transaction.
// In production you'd fetch this from a node or block explorer.
function buildFakeUtxoTx(toAddress: string, net: bitcoin.Network): Buffer {
  const fakeTx = new bitcoin.Transaction();
  fakeTx.addInput(Buffer.alloc(32), 0); // coinbase-style fake input
  fakeTx.addOutput(
    bitcoin.address.toOutputScript(toAddress, net),
    100_000 // 0.001 BTC — the UTXO we'll spend
  );
  return fakeTx.toBuffer();
}
