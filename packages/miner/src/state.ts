import { Block, BlockChain, coinAddress, createWallet, hash160, Transaction, Wallet } from '@mycoin/blockchain';
import { appConfig } from './app.config';
import { injectable } from '@deepkit/injector';
import { Logger } from '@deepkit/logger';
import { Subject } from 'rxjs';

export class MinerWalletConfig extends appConfig.slice(['minerWalletPrivateKey', 'minerWalletPublicKey']) {
}

@injectable()
export class MinerWallet {
    wallet: Wallet;

    constructor(
        protected minerConfig: MinerWalletConfig,
        protected logger: Logger,
    ) {
        if (!minerConfig.minerWalletPrivateKey || !minerConfig.minerWalletPublicKey) {
            this.wallet = createWallet();
            this.logger.warning('<red>minerWalletPrivateKey or minerWalletPublicKey not set!</red>');
            this.logger.warning(` Mining reward is payed to address: ${Buffer.from(this.wallet.publicKey).toString('hex')}`);
            this.logger.warning(` PubKeyHash: ${Buffer.from(hash160(this.wallet.publicKey)).toString('hex')}`);
            this.logger.warning(` Coin address: ${coinAddress(this.wallet.publicKey)}`);
            this.logger.warning(` <red>Using private key</red>: ${Buffer.from(this.wallet.privateKey).toString('hex')} `);
        } else {
            this.wallet = new Wallet(
                Buffer.from(minerConfig.minerWalletPrivateKey, 'hex'),
                Buffer.from(minerConfig.minerWalletPublicKey, 'hex'),
            );
        }
    }

    static create() {
        const wallet = createWallet();
        return new MinerWallet({
            minerWalletPrivateKey: Buffer.from(wallet.privateKey).toString('hex'),
            minerWalletPublicKey: Buffer.from(wallet.publicKey).toString('hex'),
        }, new Logger);
    }
}

export class MainBlockchain {
    protected chain: BlockChain = new BlockChain();

    public newBlock = new Subject<Block>();

    setChain(chain: BlockChain) {
        this.chain = chain;
    }

    getChain(): BlockChain {
        return this.chain;
    }
}

export class TransactionPool {
    transactions: Transaction[] = [];

    onNewTransaction?: () => void;

    getSize() {
        return this.transactions.length;
    }

    pop(size: number): Transaction[] {
        return this.transactions.splice(0, size);
    }

    add(...transactions: Transaction[]) {
        this.transactions.push(...transactions);
        setTimeout(() => {
            if (this.onNewTransaction) this.onNewTransaction();
        }, 100);
    }
}
