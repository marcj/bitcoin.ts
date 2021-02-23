import { bigIntTo32Buffer, bufferToBigInt, doubleSHA256, hashBuffer } from './utils';
import { BitcoinReader, BitcoinWriter, varUintBytes } from './buffer';
import { entity, t } from '@deepkit/type';
import { Transaction } from './transaction';

export const COIN = 1_000_000n as const;

export const EmptyScript = new Uint8Array([0x00]);

/**
 * The block in the chain.
 *
 * The binary format is as follows:
 *
 *   <size uint32><header><txCount varUint>[<transaction>]
 *
 * <header>:
 *   <version uint32><previous char[32]><merkleRoot char[32]><timestamp uint32><difficulty uint32><nonce uint32>
 *
 * <transaction> is an array of size of <txCount> where each item is a transaction.
 */
@entity.name('chain/block')
export class Block {
    @t protected hash: bigint = 0n;

    @t version: number = 1;
    @t merkleRoot: Uint8Array = new Uint8Array(32);
    @t timestamp: number = Math.ceil(Date.now() / 1000);

    /**
     * Difficulty encoded as 4 bytes stored in little-endian order (inverted to JS 0xn syntax).
     * See https://en.bitcoin.it/wiki/Difficulty
     *
     * The generated hash must be below the difficulty.
     *
     * 0x1d00_ffffn => difficulty of 00000000ffff0000000000000000000000000000000000000000000000000000
     * 0x1e00_ffffn => difficulty of 000000ffff000000000000000000000000000000000000000000000000000000
     * 0x1f00_ffffn => difficulty of 0000ffff00000000000000000000000000000000000000000000000000000000
     * 0x2000_ffffn => difficulty of 00ffff0000000000000000000000000000000000000000000000000000000000
     */
    @t nBits: bigint = 0x1f00_ffffn;

    constructor(
        public previous: bigint,
    ) {
    }

    get difficulty(): bigint {
        return ((this.nBits & 0x00ffffffn) * 2n ** (8n * ((this.nBits >> 24n) - 3n)));
    }

    @t nonce: number = 0;

    @t.array(Transaction) transactions: Transaction[] = [];

    /**
     * The binary representation of this block.
     * This is filled when read from the blockchain file or received from a peer.
     */
    protected buffer?: Uint8Array;

    /**
     * Build the binary header, which can be used to create a block hash.
     * This is mainly useful for finding a hash that satisfies a difficulty.
     */
    getHeaderBuffer(): Uint8Array {
        const buffer = Buffer.allocUnsafe(80);
        const writer = new BitcoinWriter(buffer);
        writer.writeUint32(1); //version
        const previous = bigIntTo32Buffer(this.previous);
        previous.reverse();
        //hashes are stored in reversed order
        writer.writeBuffer(previous); //previous

        //calculate merkleRoot
        this.merkleRoot = calculateMerkleRoot(this.transactions);
        //hashes are stored in reversed order
        this.merkleRoot.reverse();

        writer.writeBuffer(this.merkleRoot); //merkleRoot
        writer.writeUint32(this.timestamp); //timestamp
        writer.writeUint32(Number(this.nBits)); //nBits aka difficulty
        writer.writeUint32(this.nonce); //nonce
        return buffer;
    }

    getBuffer(): Uint8Array {
        if (this.buffer) return this.buffer;
        let transactionSize = 0;
        for (const transaction of this.transactions) transactionSize += transaction.getBuffer().byteLength;
        const buffer = Buffer.allocUnsafe(4 + 4 + 32 + 32 + 4 + 4 + 4 + varUintBytes(this.transactions.length) + transactionSize);
        const writer = new BitcoinWriter(buffer);

        writer.writeUint32(buffer.byteLength); //size
        writer.writeUint32(1); //version
        writer.writeBuffer(bigIntTo32Buffer(this.previous)); //previous

        //calculate merkleRoot
        this.merkleRoot = calculateMerkleRoot(this.transactions);

        writer.writeBuffer(this.merkleRoot); //merkleRoot
        writer.writeUint32(this.timestamp); //timestamp
        writer.writeUint32(Number(this.nBits)); //nBits aka difficulty
        writer.writeUint32(this.nonce); //nonce

        writer.writeVarUint(this.transactions.length); //transaction count
        for (const transaction of this.transactions) {
            writer.writeBuffer(transaction.getBuffer());
        }

        this.buffer = buffer;
        return buffer;
    }

    static fromBuffer(reader: Uint8Array | BitcoinReader): Block {
        reader = reader instanceof BitcoinReader ? reader : new BitcoinReader(Buffer.from(reader));
        const block = new Block(0n);
        const size = reader.eatUInt32();

        block.version = reader.eatUInt32();
        block.previous = bufferToBigInt(reader.eatSlice(32));
        block.merkleRoot = reader.eatSlice(32);
        block.timestamp = reader.eatUInt32();
        block.nBits = BigInt(reader.eatUInt32());
        block.nonce = reader.eatUInt32();
        const transactionsLength = reader.eatVarUint(); //txCount
        for (let i = 0; i < transactionsLength; i++) {
            block.transactions.push(Transaction.fromBuffer(reader));
        }

        return block;
    }

    /**
     * The primary identifier of a block is its cryptographic hash, a digital fingerprint, made by hashing the block header twice through the SHA256 algorithm.
     */
    getHash(): bigint {
        if (this.hash === 0n) {
            //we only hash the header, which is of fixed size, exactly 80 bytes.
            this.hash = hashBuffer(this.getBuffer().slice(4, 84));
        }

        return this.hash;
    }

    isValid(): boolean {
        if (this.transactions.length === 0) {
            throw new Error(`No transactions`);
        }

        // Does each block require at least a coinbase transaction + one more?
        // if (this.transactions.length < 2) {
        //     throw new Error(`Too few transactions. A coinbase and at least one more transaction is required. Given ${this.transactions.length} transactions.`);
        // }

        for (const transaction of this.transactions) {
            if (!transaction.isValid()) return false;
        }

        return true;
    }

    createTransaction(): Transaction {
        const transaction = new Transaction();
        this.addTransaction(transaction);
        return transaction;
    }

    addTransaction(transaction: Transaction) {
        this.hash = 0n;
        this.transactions.push(transaction);
    }

    addCoinbaseTransaction(amount: bigint, scriptPubKey: Uint8Array = EmptyScript): Transaction {
        const transaction = new Transaction();
        transaction.addOutput(amount, scriptPubKey);
        this.transactions.unshift(transaction);
        return transaction;
    }
}

export function calculateMerkleRoot(transactions: Transaction[]): Uint8Array {
    if (!transactions.length) return new Uint8Array(32);

    const transactionHashes: Uint8Array[] = [];
    for (const transaction of transactions) {
        transactionHashes.push(transaction.getHash());
    }

    // merkel trees need even number of transactions. we add the last twice if length is odd
    if (transactionHashes.length % 2 !== 0) transactionHashes.push(transactionHashes[transactionHashes.length - 1]);

    while (transactionHashes.length !== 1) {
        let i = transactionHashes.length;
        do {
            transactionHashes[i - 2] = doubleSHA256(Buffer.concat([transactionHashes[i - 2], transactionHashes[i - 1]]));
            transactionHashes.pop();
        } while (i -= 2);
    }

    return transactionHashes[0];
}
