import { Keypair } from '@solana/web3.js';

const BATCH_SIZE = 100; // Smaller batch size for more frequent updates

const isValidVanityAddress = (
  address: string,
  prefix: string,
  suffix: string,
  caseSensitive: boolean
): boolean => {
  const addressToCheck = caseSensitive ? address : address.toLowerCase();
  const prefixToCheck = caseSensitive ? prefix : prefix.toLowerCase();
  const suffixToCheck = caseSensitive ? suffix : suffix.toLowerCase();

  return (
    addressToCheck.startsWith(prefixToCheck) &&
    addressToCheck.endsWith(suffixToCheck)
  );
};

self.onmessage = (e: MessageEvent) => {
  const { prefix, suffix, caseSensitive } = e.data;
  let attempts = 0;
  
  while (true) {
    // Process a batch of addresses
    for (let i = 0; i < BATCH_SIZE; i++) {
      const keypair = Keypair.generate();
      attempts++;

      if (isValidVanityAddress(
        keypair.publicKey.toBase58(),
        prefix,
        suffix,
        caseSensitive
      )) {
        self.postMessage({
          type: 'complete',
          attempts,
          publicKey: keypair.publicKey.toBase58(),
          secretKey: Array.from(keypair.secretKey),
        });
        return;
      }
    }

    // Update progress after each batch
    self.postMessage({ type: 'progress', attempts });
  }
};