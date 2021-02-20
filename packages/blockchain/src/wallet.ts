import { randomBytes } from 'crypto';
import * as secp256k1 from 'secp256k1';
import { Transaction } from './transaction';
import { BitcoinScript } from './script';
import { hash160 } from './utils';
import { getTransactionHashForSignature } from './transfer';

export function createPrivateKey(): Buffer {
    while (true) {
        const privateKey = randomBytes(32);
        if (secp256k1.privateKeyVerify(privateKey)) return privateKey;
    }
}

export function createWallet(): Wallet {
    const privateKey = createPrivateKey();

    // see https://en.bitcoin.it/wiki/Elliptic_Curve_Digital_Signature_Algorithm
    // secp256k1.publicKeyCreate creates compressed public key with the 0x02 prefix already
    const publicKey = secp256k1.publicKeyCreate(privateKey);

    return new Wallet(privateKey, publicKey);
}

export function uncompressedPublicKey(publicKey: Uint8Array): Uint8Array {
    return secp256k1.publicKeyConvert(publicKey, false);
}

export class Wallet {
    constructor(
        public privateKey: Uint8Array,
        public publicKey: Uint8Array,
    ) {
    }

    get addressHex(): string {
        return Buffer.from(this.publicKey).toString('hex');
    }

    get pubKeyHash(): Uint8Array {
        return hash160(this.publicKey);
    }

    get address(): Uint8Array {
        return this.publicKey;
    }

    /**
     * Sets the unlock script (scriptSig) of the given transaction input to use a signature for a Pay-To-Pub-Key UXTO.
     */
    unlockPayToPubKeyHash(previousTransaction: Transaction, transaction: Transaction, inputIndex: number) {
        if (transaction.isBuilt()) throw new Error('Transaction already built');
        const transactionHash = getTransactionHashForSignature(
            previousTransaction, transaction, inputIndex, 0x01
        );
        const script = new BitcoinScript();
        const signature = secp256k1.signatureExport(secp256k1.ecdsaSign(transactionHash, this.privateKey).signature);

        //todo: AFAIK the.publicKey needs to be reversed in order and then added. Confirm and change.
        script.add(Buffer.concat([signature, new Uint8Array([0x01])]), this.publicKey);
        transaction.input[inputIndex].scriptSig = script.getBuffer();
    }
}
