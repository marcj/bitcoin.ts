import { genesisBlock } from './genesis';
import { Block } from './block';
import { Transaction } from './transaction';
import { bufferEqual } from './utils';


export class BlockChain {
    blocks: Block[] = [genesisBlock];

    addBlock(block: Block) {
        this.blocks.push(block);
    }

    /**
     * Creates a new block, append it to the chain, and return it.
     */
    createBlock(): Block {
        const block = new Block(this.getHead().getHash());
        this.addBlock(block);
        return block;
    }

    getHeight(): number {
        return this.blocks.length;
    }

    getHead(): Block {
        return this.blocks[this.blocks.length - 1];
    }

    getLastTransactions(amount: number): { block: Block, timestamp: number, transaction: Transaction }[] {
        const result: { block: Block, timestamp: number, transaction: Transaction }[] = [];

        for (let i = this.blocks.length - 1; i >= 0; i--) {
            const block = this.blocks[i];
            for (let j = block.transactions.length - 1; j >= 0; j--) {
                if (result.length >= amount) return result;
                result.push({ block, transaction: block.transactions[j], timestamp: block.timestamp });
            }
        }

        return result;
    }

    /**
     *
     * Note: This is on purpose operating directly on the chain and not using any DB/indices, to get a feeling
     * where the computation and memory complexity explodes.
     * At some point in the future (when everything works) we move blocks and transactions to a database.
     */
    getTransaction(hash: Uint8Array): { block: Block, timestamp: number, transaction: Transaction } {
        for (let i = this.blocks.length - 1; i >= 0; i--) {
            // note: we should use the MerkleTree instead to check whether the requested transaction hash
            // is part of the block. But for the moment until everything works this is ok.
            for (const transaction of this.blocks[i].transactions) {
                if (bufferEqual(transaction.getHash(), hash)) return { block: this.blocks[i], timestamp: this.blocks[i].timestamp, transaction };
            }
        }

        throw new Error(`No transaction with hash ${Buffer.from(hash).toString('hex')} found`);
    }

    /**
     *
     * Note: This is on purpose operating directly on the chain and not using any DB/indices, to get a feeling
     * where the computation and memory complexity explodes.
     * At some point in the future (when everything works) we move blocks and transactions to a database.
     */
    getBlock(hash: bigint): {height: number, block: Block} {
        for (let i = this.blocks.length - 1; i >= 0; i--) {
            if (this.blocks[i].getHash() === hash) return {height: i, block: this.blocks[i]};
        }

        throw new Error(`No block with hash ${hash} found`);
    }
}
