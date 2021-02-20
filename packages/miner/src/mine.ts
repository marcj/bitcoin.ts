import { Block, BlockChain, bufferToBigInt, COIN, createCoinbase, doubleSHA256, validateTransaction } from '@mycoin/blockchain';
import { MainBlockchain, MinerWallet, TransactionPool } from './state';
import { appConfig } from './app.config';
import { injectable } from '@deepkit/injector';
import { Logger } from '@deepkit/logger';

export class MineConfig extends appConfig.slice(['transactionPerBlock']) {
}

export class MineBlock {
    started: number = Date.now();
    ended: number = Date.now();
    hashes: number = 0;

    constructor(
        protected chain: BlockChain,
        protected block: Block,
        protected difficulty: bigint,
    ) {

    }

    get took(): number {
        return this.ended - this.started;
    }

    async start() {
        const header = Buffer.from(this.block.getHeaderBuffer());
        let hash = bufferToBigInt(doubleSHA256(header));

        // todo: move this to another thread
        while (hash > this.difficulty) {
            this.block.nonce += 1;
            // instead of creating a new buffer all the time, we modify the old one
            // hash = bufferToBigInt(doubleSHA256(block.getHeaderBuffer()));
            header.writeUInt32LE(this.block.nonce, 80 - 4);
            hash = bufferToBigInt(doubleSHA256(header));
            this.hashes++;
        }

        this.ended = Date.now();
    }
}

@injectable()
export class Mine {
    protected minePromise?: Promise<any>;
    protected mineBlock?: MineBlock;

    constructor(
        protected mainChain: MainBlockchain,
        protected transactionPool: TransactionPool,
        protected minerWallet: MinerWallet,
        protected config: MineConfig,
        protected logger: Logger = new Logger,
    ) {
    }

    start() {
        this.transactionPool.onNewTransaction = () => this.mineNextBlockIfNecessary();
    }

    async untilCurrentMiningIsDone(): Promise<MineBlock | undefined> {
        return this.minePromise;
    }

    /**
     * Starts a new mining when there is no current mining in progress and there are enough
     * transaction.
     */
    mineNextBlockIfNecessary() {
        this.logger.log('mineNextBlockIfNecessary', this.transactionPool.getSize() < this.config.transactionPerBlock);
        if (this.minePromise) return this.minePromise;
        if (this.transactionPool.getSize() < this.config.transactionPerBlock) return;

        this.minePromise = this.mine(this.mainChain.getChain());
        this.minePromise.then(() => {
            this.minePromise = undefined;
        });
        return this.minePromise;
    }

    /**
     * Mining a block means finding a hash that satisfies a difficulty (hash is smaller than difficulty).
     * This is achieved by changing the nonce as long as necessary.
     * Once a hash is found, the block is added to the chain.
     */
    protected async mine(chain: BlockChain): Promise<MineBlock> {
        const head = chain.getHead();
        this.logger.log('Mine new block');

        // todo: calculate fee
        let transactionFee: bigint = 0n;

        // todo: calculate block reward based on current blockchain height
        const blockReward: bigint = 5n * COIN;

        const block = new Block(head.getHash());
        //add new valid transactions from the pool
        do {
            const candidates = this.transactionPool.pop(256);

            for (const candidate of candidates) {
                // we have to check here again since the blockchain could have changed between adding
                // the transaction to the pool and now generating the block for it.
                if (!validateTransaction(chain, candidate)) continue;

                block.transactions.push(candidate);
            }
        } while (block.transactions.length < this.config.transactionPerBlock);

        const totalCoinbase = blockReward + transactionFee;
        createCoinbase(block, this.minerWallet.wallet, totalCoinbase);

        this.logger.info(`Start mining of ${block.transactions.length} transaction with reward&fees of ${totalCoinbase}.`);
        this.logger.info(` with difficulty ${head.difficulty.toString(16).padStart(64, '0')}`);

        // todo: adjust the difficulty based on the algorithm defined in Bitcoin.

        const mineBlock = new MineBlock(chain, block, head.difficulty);
        await mineBlock.start();

        const currentHead = chain.getHead();
        if (currentHead !== head) return mineBlock; //changed meanwhile

        this.logger.info(`Found block ${block.getHash().toString(16)} in ${mineBlock.took} ms`);
        block.timestamp = Math.ceil(Date.now() / 1000);
        chain.addBlock(block);
        this.mainChain.newBlock.next(block);

        return mineBlock;
    }
}
