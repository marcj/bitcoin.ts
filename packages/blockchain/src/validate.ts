import { BlockChain } from './blockchain';
import { Transaction } from './transaction';
import { BitcoinScriptVM, OP_TRUE_b, TransactionValidation } from './script';
import { Block } from './block';
import { genesisBlock } from './genesis';
import { bufferEqual } from './utils';

/**
 * Validates if the given transaction is valid.
 * This means mainly that all input unlock scripts + output lock scripts are valid (execution returns true).
 */
export function validateTransaction(chain: BlockChain, transaction: Transaction): boolean {
    let inputTotal: bigint = 0n;
    let outputTotal: bigint = 0n;

    for (let i = 0; i < transaction.input.length; i++) {
        const input = transaction.input[i];
        const previousTransaction = chain.getTransaction(input.transaction).transaction;
        const output = previousTransaction.output[input.outputIndex];

        // we allow all transaction from the genesis block
        if (bufferEqual(input.transaction, genesisBlock.transactions[0].getHash())) {
            return true;
        }

        const vmIn = new BitcoinScriptVM(input.scriptSig);
        vmIn.eval();

        const vmOut = new BitcoinScriptVM(output.scriptPubKey);
        vmOut.stack.push(...vmIn.stack);

        const transactionValidation = new TransactionValidation();
        transactionValidation.previousTransaction = previousTransaction;
        transactionValidation.transaction = transaction;
        transactionValidation.inputIndex = i;

        try {
            const result = vmOut.eval(transactionValidation);
            const valid = result.byteLength === 1 && result[0] === OP_TRUE_b;
            if (!valid) throw new Error('script returned invalid');
        } catch (error) {
            console.warn(`Signature invalid in transaction input script ${vmIn.toString()} for UXTO script ${vmOut.toString()}: ${error}`);
            return false;
        }

        inputTotal += output.amount;
    }

    for (let i = 0; i < transaction.output.length; i++) {
        const output = transaction.output[i];
        outputTotal += output.amount;
    }

    if (transaction.input.length > 0 && outputTotal > inputTotal) {
        console.warn(`Transaction has more output (${outputTotal}) than input (${inputTotal})`);
        return false;
    }

    return true;
}

/**
 * Verifies that a block is valid for given chain.
 * This includes checking whether limits are reached, transactions and unlock scripts are valid.
 *
 * @return Transaction[] valid transactions
 */
export function validateBlock(chain: BlockChain, block: Block): boolean {
    if (!block.isValid()) throw new Error('Block is not valid');

    // todo: validate coinbase transaction: exists? correct block reward? correct fees?

    for (let i = 0; i < block.transactions.length; i++) {
        const transaction = block.transactions[i];
        if (!validateTransaction(chain, transaction)) return false;
    }

    return true;
}
