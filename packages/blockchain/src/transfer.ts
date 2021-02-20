import { BlockChain } from './blockchain';
import { Block } from './block';
import { getUTXO } from './balance';
import { Transaction, UTXO } from './transaction';
import { BitcoinScript, lastCodeBlock, OP_CHECKSIG, OP_DUP, OP_EQUALVERIFY, OP_HASH160 } from './script';
import { bufferEqual, doubleSHA256 } from './utils';
import { Wallet } from './wallet';

export function createCoinbase(block: Block, wallet: Wallet, amount: bigint) {
    const transaction = block.addCoinbaseTransaction(amount);
    lockPayToPubKeyHash(wallet.pubKeyHash, transaction, 0);
}

export function transferMoneyFromTo(chain: BlockChain, from: Wallet, toPubKeyHash: Uint8Array, amount: bigint): Transaction {
    const uxtos = getUTXO(chain, from.pubKeyHash);
    if (uxtos.total < amount) throw new Error('Not enough money in the bank');

    let utxoTotal: bigint = 0n;

    const transaction = new Transaction();

    const usedUXTOs: UTXO[] = [];

    while (uxtos.utxo.length && utxoTotal < amount) {
        const next = uxtos.utxo.pop()!;
        utxoTotal += next.amount;
        usedUXTOs.push(next);
        transaction.addInput(next.transaction.getHash(), next.outputIndex);
    }

    // add output and lock
    transaction.addOutput(amount);
    lockPayToPubKeyHash(toPubKeyHash, transaction, 0);

    const change = utxoTotal - amount;
    if (change > 0) {
        // add change and lock it
        transaction.addOutput(change);
        lockPayToPubKeyHash(from.pubKeyHash, transaction, 1);
    }

    // sign inputs
    for (let i = 0; i < usedUXTOs.length; i++) {
        from.unlockPayToPubKeyHash(usedUXTOs[i].transaction, transaction, i);
    }

    return transaction;
}



/**
 * Sets the lock script (scriptPubKey) of the given transaction output (UXTO) to use Pay-To-Pub-Key.
 */
export function lockPayToPubKeyHash(pubKeyHash: Uint8Array, transaction: Transaction, outputIndex: number) {
    if (transaction.isBuilt()) throw new Error('Transaction already built');
    const script = new BitcoinScript();
    script.add(new OP_DUP, new OP_HASH160, pubKeyHash, new OP_EQUALVERIFY, new OP_CHECKSIG);
    transaction.output[outputIndex].scriptPubKey = script.getBuffer();
}

export function isSpendable(pubKeyHash: Uint8Array, transaction: Transaction, outputIndex: number): boolean {
    const scriptPubKey = transaction.output[outputIndex].scriptPubKey;

    // depending on scriptSig we create new scriptSig, to try to unlock.
    // For the moment we only support Pay-to-Pub-key, which means we build this script and just compare if equal.
    const unlockScript = new BitcoinScript();
    unlockScript.add(new OP_DUP, new OP_HASH160, pubKeyHash, new OP_EQUALVERIFY, new OP_CHECKSIG);
    return bufferEqual(scriptPubKey, unlockScript.getBuffer());

    // for anything else, we have to execute the actual script, like so:

    // const checkTransaction = new Transaction();
    // const scriptSig = 'build unlock script, based on the lock script.';
    // checkTransaction.addInput(transaction.getHash(), outputIndex, scriptSig);
    //
    // const vmIn = new BitcoinScriptVM(scriptSig);
    // vmIn.eval();
    //
    // const vmOut = new BitcoinScriptVM(scriptPubKey);
    // vmOut.stack.push(...vmIn.stack);
    //
    // const transactionValidation = new TransactionValidation();
    // transactionValidation.previousTransaction = transaction;
    // transactionValidation.transaction = checkTransaction;
    // transactionValidation.inputIndex = 0;
    //
    // const result = vmOut.eval(transactionValidation);
    // return result.byteLength === 1 && result[0] === OP_TRUE_b;
}

export function extractPubKeyHashFromPayToPubKeyHashScript(script: Uint8Array): Uint8Array | undefined {
    //scriptPubKey of pay-to-pubkey is: OP_DUP, new OP_HASH160, pubKeyHash, new OP_EQUALVERIFY, new OP_CHECKSIG
    // where pubKeyHash is `hash160`, which is 20 byte long
    if (script.byteLength < 23) return undefined;
    //todo: check first bytes being OP_DUP and OP_HASH160, and end OP_EQUALVERIFY, OP_CHECKSIG
    //offset of 3, because first is OP_DUP, second byte is OP_HASH160, third byte is the size of pubKeyHash, and then follows the actual hash.
    return script.slice(3, 23);
}

/**
 * The act of signing a transaction is rather complicated in Bitcoin.
 *
 * You can not directly sign an transaction input, since that would involve signing its own signature.
 * Before a transaction is signed, all its input scripts are cleared, and then depending on the hashType
 * further changes made. At the end of this process the transaction binary format is build, append with the hashType (strechted to 4 bytes, LE),
 * and then hashed using doubleSHA256. This hash will be signed externally when the unlock script is built, and then verified in the lock script.
 */
export function getTransactionHashForSignature(previousTransaction: Transaction, transaction: Transaction, inputIndex: number, hashType: number = 0x01): Uint8Array {
    const hashTypeBuffer = new Uint8Array([hashType, 0, 0, 0]); //LE

    const input = transaction.input[inputIndex];

    const prevTxOutScript = previousTransaction.output[input.outputIndex].scriptPubKey;
    const subScript = lastCodeBlock(prevTxOutScript);

    //step 6: copy transaction
    const txCopy = transaction.clone();

    //step 7: set all txIn to empty
    for (const input of txCopy.input) {
        input.scriptSig = new Uint8Array([0x00]);
    }

    //step 8: set subScript into the txIn script we're checking
    txCopy.input[inputIndex].scriptSig = subScript;

    if ((hashType & 31) === Transaction.SIGHASH_NONE) {
        txCopy.output.length = 0;
        for (const input of txCopy.input) input.sequenceNumber = 0;
    }

    if ((hashType & 31) === Transaction.SIGHASH_SINGLE) {
        txCopy.output.length = txCopy.input.length;
        for (let i = 0; i < txCopy.output.length; i++) {
            if (i === inputIndex) continue;
            txCopy.output[i].amount = 0n;
            txCopy.output[i].scriptPubKey = new Uint8Array([0x00]);
        }

        for (let i = 0; i < txCopy.input.length; i++) {
            if (i === inputIndex) continue;
            txCopy.input[i].sequenceNumber = 0;
        }
    }

    if (hashType & Transaction.SIGHASH_ANYONECANPAY) {
        txCopy.input = [txCopy.input[inputIndex]];
    }

    //step 9: serialize txCopy, append hashType
    // return txCopy.getHash();
    const txCopyBuffer = Buffer.concat([txCopy.getBuffer(), hashTypeBuffer]);
    return doubleSHA256(txCopyBuffer);
}
