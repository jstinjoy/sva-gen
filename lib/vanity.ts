import { Keypair } from "@solana/web3.js";

/**
 * Check if an address matches the given prefix and suffix
 */
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

/**
 * Generate a vanity address matching the provided prefix and suffix
 */
export const generateVanityAddress = (
  prefix: string,
  suffix: string,
  caseSensitive: boolean,
  incrementCounter: () => void
): Keypair => {
  let keypair = Keypair.generate();

  while (
    !isValidVanityAddress(
      keypair.publicKey.toBase58(),
      prefix,
      suffix,
      caseSensitive
    )
  ) {
    incrementCounter();
    keypair = Keypair.generate();
  }

  return keypair;
};