import { rpc } from '@deepkit/rpc';
import { MainBlockchain, TransactionPool } from '../state';
import { ApiAddress, ApiAddressResolved, ApiBlock, ApiTransaction, ApiTransactionInput, ApiTransactionOutput, ApiWallet, MinerControllerInterface } from '@mycoin/miner-api';
import {
    BitcoinScriptVM,
    Block,
    BlockChain,
    bufferEqual,
    bufferToHex,
    bytesToHex,
    coinAddress,
    coinAddressFromHash,
    createWallet,
    extractHash160FromCoinAddress,
    extractPubKeyHashFromPayToPubKeyHashScript,
    genesisBlock,
    genesisText,
    getUTXO,
    Input,
    isCoinAddress,
    lockPayToPubKeyHash,
    Output,
    Transaction,
    transferMoneyFromTo,
    validateTransaction,
    Wallet
} from '@mycoin/blockchain';
import { BehaviorSubject } from 'rxjs';
import { t } from '@deepkit/type';
import { Logger } from '@deepkit/logger';


function getAddressFromOutput(output: Output): string {
    if (bufferEqual(genesisText, output.scriptPubKey)) return 'Genesis';

    //Pay-To-PubKey-hash contains the public key hash, which we want
    //we might, in the future, try to detect more scripts like Pay-To-pubKey.
    const pubKeyHash = extractPubKeyHashFromPayToPubKeyHashScript(output.scriptPubKey);
    if (!pubKeyHash) return 'unknown';
    return coinAddressFromHash(pubKeyHash);
}

function getAddressFromInput(chain: BlockChain, input: Input): string {
    const o = chain.getTransaction(input.transaction).transaction.output[input.outputIndex];
    if (!o) return 'unknown';
    return getAddressFromOutput(o);
}

function convertTransaction(chain: BlockChain, entry: { block: Block, transaction: Transaction }): ApiTransaction {
    return new ApiTransaction(
        entry.block.getHash().toString(16),
        entry.block.timestamp,
        Buffer.from(entry.transaction.getHash()).toString('hex'),
        entry.transaction.input.map(v => getAddressFromInput(chain, v)),
        entry.transaction.output.map(getAddressFromOutput),
        entry.transaction.output.reduce((v, t) => v + Number(t.amount), 0)
    );
}

function convertTransactionInput(input: Input): ApiTransactionInput {
    const script = new BitcoinScriptVM(input.scriptSig).toString();
    return new ApiTransactionInput(bufferToHex(input.transaction), input.outputIndex, script, input.sequenceNumber);
}

function convertTransactionOutput(output: Output): ApiTransactionOutput {
    const script = new BitcoinScriptVM(output.scriptPubKey).toString();
    return new ApiTransactionOutput(Number(output.amount), script);
}

@rpc.controller(MinerControllerInterface)
export class MinerController {
    constructor(
        protected transactionPool: TransactionPool,
        protected mainChain: MainBlockchain,
        protected logger: Logger,
    ) {
    }

    @rpc.action()
    @t.generic(t.array(ApiTransaction))
    getTransactions(): BehaviorSubject<ApiTransaction[]> {
        const chain = this.mainChain.getChain();

        const subject = new BehaviorSubject<ApiTransaction[]>(
            chain.getLastTransactions(50).map(v => convertTransaction(chain, v))
        );

        const newBlockSub = this.mainChain.newBlock.subscribe((block) => {
            subject.next(block.transactions.map(v => {
                return { block: block, transaction: v };
            }).map(v => convertTransaction(chain, v)));
        });

        subject.subscribe().add(() => {
            newBlockSub.unsubscribe();
        });

        return subject;
    }

    @rpc.action()
    addTransaction(fromPrivateKey: Uint8Array, fromPublicKey: Uint8Array, to: string, amount: number): void {
        //to needs to be parsed. can be hash160 (pubKeyHash) or coinAddress
        if (to.length < 16) throw new Error('Invalid receiver');
        if (amount < 0) throw new Error('Invalid amount');

        const toPubKeyHash = isCoinAddress(to) ? extractHash160FromCoinAddress(to) : Buffer.from(to, 'hex');
        const amountBigInt = BigInt(Math.ceil(amount * 1_000_000));

        if (fromPublicKey.byteLength === 0) {
            this.logger.log(`New genesis transaction of $${amountBigInt} to ${Buffer.from(toPubKeyHash).toString('hex')}`);
            //we assume its from genesis
            const transaction = new Transaction();
            transaction.addInput(genesisBlock.transactions[0].getHash(), 0);
            transaction.addOutput(amountBigInt);
            lockPayToPubKeyHash(toPubKeyHash, transaction, 0);
            this.transactionPool.add(transaction);
            return;
        }

        const fromWallet = new Wallet(fromPrivateKey, fromPublicKey);
        this.logger.log(`New transaction from ${Buffer.from(fromWallet.pubKeyHash).toString('hex')} of $${amountBigInt} to ${Buffer.from(toPubKeyHash).toString('hex')}`);
        const transaction = transferMoneyFromTo(this.mainChain.getChain(), fromWallet, toPubKeyHash, amountBigInt);
        if (!validateTransaction(this.mainChain.getChain(), transaction)) throw new Error('Transaction declined');
        this.transactionPool.add(transaction);
    }

    @rpc.action()
    @t.array(ApiBlock)
    getBlocks(): ApiBlock[] {
        const result: ApiBlock[] = [];
        const chain = this.mainChain.getChain();
        const blocks = this.mainChain.getChain().blocks;

        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            const apiBlock = new ApiBlock(block.timestamp, block.getHash().toString(16), block.previous.toString(16), i, block.difficulty.toString(16).padStart(64, '0'));
            apiBlock.transactions = block.transactions.map(v => convertTransaction(chain, { block: block, transaction: v }));
            result.push(apiBlock);
        }

        return result;
    }

    @rpc.action()
    resolveAddress(address: string): ApiAddressResolved {
        const resolved = new ApiAddressResolved;

        if (address.length <= 64 && address.length > 40) {
            //transaction or block hash
            let b: { height: number, block: Block } | undefined;
            try {
                b = this.mainChain.getChain().getBlock(BigInt('0x' + address));
            } catch {
            }

            if (b) {
                resolved.block = new ApiBlock(b.block.timestamp, b.block.getHash().toString(16), b.block.previous.toString(16), b.height, b.block.difficulty.toString(16).padStart(64, '0'));
                for (const t of b.block.transactions) {
                    const apiT = convertTransaction(this.mainChain.getChain(), { block: b.block, transaction: t });
                    apiT.input = t.input.map(convertTransactionInput);
                    apiT.output = t.output.map(convertTransactionOutput);
                    resolved.block.transactions.push(apiT);
                }
                return resolved;
            }

            let transaction: { block: Block, timestamp: number, transaction: Transaction } | undefined;
            try {
                transaction = this.mainChain.getChain().getTransaction(Buffer.from(address, 'hex'));
            } catch {
            }
            if (transaction) {
                resolved.transaction = convertTransaction(this.mainChain.getChain(), transaction);
                resolved.transaction.input = transaction.transaction.input.map(convertTransactionInput);
                resolved.transaction.output = transaction.transaction.output.map(convertTransactionOutput);
                return resolved;
            }
        }

        if (address.length === 40) {
            //publicKeyHash
            resolved.address = new ApiAddress(address, coinAddressFromHash(Buffer.from(address, 'hex')));
        } else if (isCoinAddress(address)) {
            resolved.address = new ApiAddress(bytesToHex(extractHash160FromCoinAddress(address)), address);
        } else {
            throw new Error('Invalid address given');
        }

        for (const utxo of getUTXO(this.mainChain.getChain(), Buffer.from(resolved.address.publicKeyHash, 'hex')).utxo) {
            const apiT = convertTransaction(this.mainChain.getChain(), { block: utxo.block, transaction: utxo.transaction });
            apiT.input = utxo.transaction.input.map(convertTransactionInput);
            apiT.output = utxo.transaction.output.map(convertTransactionOutput);
            resolved.address.transactions.push(apiT);
        }

        return resolved;
    }


    @rpc.action()
    createWallet(): ApiWallet {
        const wallet = createWallet();
        const w = new ApiWallet(wallet.privateKey, wallet.publicKey);
        w.address = coinAddress(wallet.publicKey);
        return w;
    }
}
