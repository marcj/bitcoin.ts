import { BlockChain } from './blockchain';
import { hashBuffer } from './utils';
import { Output, Transaction, UTXO } from './transaction';
import { isSpendable } from './transfer';
import { Block } from './block';

/**
 * Returns all unspent transaction outputs, which are in total the current address' balance.
 */
export function getUTXO(chain: BlockChain, pubKeyHash: Uint8Array): { utxo: UTXO[], total: bigint } {
    const transactionMap = new Map<bigint, { block: Block, transaction: Transaction, i: number, output: Output }>();

    for (const block of chain.blocks) {
        for (const transaction of block.transactions) {
            if (transactionMap.size) {
                //we have UTXO, so check if it was spent, if so, remove from map
                for (const input of transaction.input) {
                    transactionMap.delete(hashBuffer(input.transaction));
                }
            }

            for (let i = 0; i < transaction.output.length; i++) {
                if (!isSpendable(pubKeyHash, transaction, i)) continue;
                transactionMap.set(hashBuffer(transaction.getHash()), { block, transaction, i, output: transaction.output[i] });
            }
        }
    }

    //the remaining items in transactionMap are unspent TXO.
    const outputs: UTXO[] = [];
    let total = 0n;
    for (const v of transactionMap.values()) {
        outputs.push({ block: v.block, transaction: v.transaction, outputIndex: v.i, amount: v.output.amount });
        total += v.output.amount;
    }

    return { utxo: outputs, total };
}
