/**
 * 02-op-return-data.ts
 *
 * Embed arbitrary data in a Bitcoin transaction using OP_RETURN.
 *
 * OP_RETURN creates an "unspendable" output that stores up to 80 bytes
 * of arbitrary data on-chain. It's how protocols like Ordinals, Stamps,
 * and various timestamping services anchor data to Bitcoin.
 *
 * The output looks like:
 *   OP_RETURN <data>
 *
 * Bitcoin nodes mark it as provably unspendable (UTXO set never stores it),
 * but the data is permanently in the blockchain.
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import * as crypto from 'crypto';

const ECPair = ECPairFactory(ecc);
const network = bitcoin.networks.testnet;

// ── 1. What data can we embed? ────────────────────────────────────────────────
//
// Anything up to 80 bytes. Common use cases:
//   - SHA256 hash of a document (proof of existence / timestamping)
//   - Protocol magic bytes + data (Omni, Counterparty, etc.)
//   - Short text messages
//   - Content identifiers (CIDs, IDs)

const documentContent = 'This document existed at Bitcoin block height X.';
const documentHash = crypto.createHash('sha256').update(documentContent).digest();

console.log('=== OP_RETURN Data Embedding ===');
console.log('Document:', documentContent);
console.log('SHA-256 hash (32 bytes):', documentHash.toString('hex'));
console.log('Byte length:', documentHash.length, '(well within 80-byte limit)');

// ── 2. Build the OP_RETURN script ─────────────────────────────────────────────
//
// bitcoin.payments.embed() creates the scriptPubKey:
//   OP_RETURN OP_PUSHDATA <hash>
//
// This is equivalent to:
//   bitcoin.script.compile([bitcoin.opcodes.OP_RETURN, documentHash])

const { output: opReturnScript } = bitcoin.payments.embed({
  data: [documentHash],
  network,
});

console.log('\n=== OP_RETURN Script ===');
console.log('Script (hex):', opReturnScript!.toString('hex'));
console.log('Script (ASM):', bitcoin.script.toASM(opReturnScript!));
// Output: OP_RETURN OP_PUSHDATA1 <32-byte-hash>

// ── 3. Build a transaction with OP_RETURN output ──────────────────────────────
//
// Convention: OP_RETURN output value is always 0 satoshis.
// You can have at most 1 OP_RETURN output per standard transaction.

const keyPair = ECPair.makeRandom({ network });
const { address: changeAddress } = bitcoin.payments.p2wpkh({
  pubkey: Buffer.from(keyPair.publicKey),
  network,
});

const psbt = new bitcoin.Psbt({ network });

// Fake input (0.001 BTC UTXO)
const UTXO_VALUE = 100_000; // satoshis
const FEE = 2_000;

psbt.addInput({
  hash: 'b'.repeat(64),
  index: 0,
  witnessUtxo: {
    script: bitcoin.payments.p2wpkh({
      pubkey: Buffer.from(keyPair.publicKey),
      network,
    }).output!,
    value: UTXO_VALUE,
  },
});

// Output 1: OP_RETURN (0 value — unspendable by design)
psbt.addOutput({
  script: opReturnScript!,
  value: 0,
});

// Output 2: change back to ourselves
psbt.addOutput({
  address: changeAddress!,
  value: UTXO_VALUE - FEE,
});

// Sign
psbt.signInput(0, {
  publicKey: Buffer.from(keyPair.publicKey),
  sign: (hash: Buffer) => Buffer.from(ecc.sign(hash, keyPair.privateKey!)),
});
psbt.finalizeAllInputs();

const tx = psbt.extractTransaction();

console.log('\n=== Transaction ===');
console.log('TXID:', tx.getId());
console.log('Outputs:');
tx.outs.forEach((out, i) => {
  const asm = bitcoin.script.toASM(out.script);
  const isOpReturn = asm.startsWith('OP_RETURN');
  console.log(`  [${i}] ${out.value} sat | ${isOpReturn ? '🔒 OP_RETURN (unspendable)' : '💰 P2WPKH'}`);
  if (isOpReturn) {
    // Extract the embedded data
    const chunks = bitcoin.script.decompile(out.script)!;
    const embedded = chunks[1] as Buffer;
    console.log(`       Embedded data: ${embedded.toString('hex')}`);
    console.log(`       Matches doc hash: ${embedded.equals(documentHash) ? '✅ YES' : '❌ NO'}`);
  }
});

// ── 4. Verify: anyone can extract and verify the hash ────────────────────────
//
// To prove the document existed at this transaction's block height:
//   1. Take the raw document
//   2. SHA256 it
//   3. Find the matching OP_RETURN output in any Bitcoin explorer
//   4. The block timestamp is your proof of existence

console.log('\n=== Proof of Existence ===');
console.log('Anyone can verify this document by:');
console.log('1. SHA256 the document →', documentHash.toString('hex').slice(0, 16) + '...');
console.log('2. Look up txid:', tx.getId());
console.log('3. Check OP_RETURN output contains the same hash ✅');
console.log('\nThis is immutable, trustless timestamping — no notary needed.');
