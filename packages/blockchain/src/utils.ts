import { createHash } from 'crypto';
import ripemd160lib from 'ripemd160';
import baseX from 'base-x';

const base58 = baseX('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz');

export function bufferEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.byteLength !== b.byteLength) return false;
    let i = a.byteLength;
    while (i--) if (a[i] !== b[i]) return false;
    return true;
}

export function bufferToHex(buffer: Uint8Array): string {
    return Buffer.from(buffer).toString('hex');
}

/**
 * The input is hashed twice: first with SHA-256 and then with RIPEMD-160.
 * Aka bitcoin address aka PubKeyHash.
 */
export function hash160(buffer: Uint8Array): Buffer {
    return ripemd160(SHA256(buffer));
}

/**
 * The coin address (same hash algorithm as Bitcoin).
 *
 * Check http://gobittest.appspot.com/Address for tests. They use uncompressed public keys though (we use compressed public keys).
 */
export function coinAddress(publicKey: Uint8Array): string {
    let hash = hash160(publicKey);
    return coinAddressFromHash(hash);
}

export function coinAddressFromHash(publicKeyHash: Uint8Array): string {
    publicKeyHash = Buffer.concat([new Uint8Array([0x00]), publicKeyHash]); //add version byte (Main Network)

    const checksum = doubleSHA256(publicKeyHash).slice(0, 4);
    const address = Buffer.concat([publicKeyHash, checksum]);
    return base58.encode(address);
}

export function bytesToHex(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString('hex');
}

export function isCoinAddress(coinAddress: string): boolean {
    try {
        const binary = base58.decode(coinAddress);
        return binary.byteLength === 25 && binary[0] === 0x00;
    } catch (error) {
        return false;
    }
}

export function extractHash160FromCoinAddress(coinAddress: string): Uint8Array {
    const binary = base58.decode(coinAddress);
    if (!isCoinAddress(coinAddress)) throw new Error(`Address ${coinAddress} is not a coind address.`);
    return binary.slice(1, 21);
}

export function ripemd160(buffer: Uint8Array): Buffer {
    return new ripemd160lib().update(buffer).digest();
}

export function SHA256(buffer: Uint8Array): Buffer {
    return createHash('sha256').update(buffer).digest();
}

export function doubleSHA256(buffer: Uint8Array): Buffer {
    return SHA256(SHA256(buffer));
}

export function hashBuffer(buffer: Uint8Array): bigint {
    return BigInt('0x' + doubleSHA256(buffer).toString('hex'));
}

export function bigIntTo32Buffer(n: bigint): Uint8Array {
    const sub = Buffer.from(n.toString(16), 'hex');
    const buffer = Buffer.alloc(32);
    if (sub.byteLength) sub.copy(buffer, 32 - sub.byteLength);
    return buffer;
}

export function bufferToBigInt(buffer: Uint8Array): bigint {
    return BigInt('0x' + Buffer.from(buffer).toString('hex'));
}
