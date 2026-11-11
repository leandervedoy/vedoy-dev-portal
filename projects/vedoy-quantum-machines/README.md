# Vedoy Quantum Machines

Experimental educational research for quantum key distribution (QKD), browser QRNG source integration and word-segment encryption. NOT a real quantum network or production encryption.

## Features

- BB84 intercept-resend simulator with QBER, loss model, basis sifting and explicit 0 validated secret bits.
- Split each message into Unicode words AND separators, consume separate non-overlapping one-time byte ranges and return one flat ciphertext envelope. Word lengths are only visible in the LOCAL educational visualization, never as transport metadata.
- Require explicit verified quantum entropy adapter for quantum mode. No adapter exists yet, so quantum mode FAILS CLOSED, not silently falling back to pseudo-randomness. Adapter must implement readAttestedBytes(length) returning {bytes:Uint8Array, attestationVerified:true,provider:string}. The boolean is an assertion from the adapter, not verified by the lab.
- In demo mode WebCrypto getRandomValues supplies CSPRNG randomness. This is NOT proven information-theoretic One-Time Pad randomness.
- Independent local CSPRNG is XOR-mixed with adapter entropy before pad issuance.

## Security boundaries

**Do not send these keys or ciphertext to actual Sent users.** This demo has no out-of-band key exchange, authenticated envelope, key consumption ledger, replay detection, secure device key storage, or tamper protection. Pads must never be reused. A mathematically perfect OTP requires truly random, secret, never-reused key material as long as the message. Per-word segmentation does not make OTP stronger than using one pad for the whole message. The demo keeps the pad locally in JS memory for testing and does not export it as transport data.

**QKD is different from QRNG**: Quantum Key Distribution is a physical communication technique using a quantum channel to establish shared keys. Quantum Random Number Generation is an entropy source. Using quantum random bytes does not create a QKD link.

BB84 output is unverified and intentionally reports zero final secure key bits. The model omits authenticated classical channel, reconciliation, privacy amplification, hardware imperfections and finite-key analysis. External cryptographic and optical security reviews are needed.

## Commands

Requires Node.js 22 or later.

npm test

npm start

Open http://localhost:4173 after starting.

## References

ETSI QKD standards: https://www.etsi.org/technical-groups/qkd/

ETSI GS QKD 014: https://www.etsi.org/deliver/etsi_gs/QKD/001_099/014/01.01.01_60/gs_qkd014v010101p.pdf

Microsoft QDK: https://learn.microsoft.com/en-us/azure/quantum/install-overview-qdk
