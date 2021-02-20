import { entity, t } from '@deepkit/type';
import { BitcoinReader, BitcoinWriter, varUintBytes } from './buffer';
import { doubleSHA256 } from './utils';
import { Block, EmptyScript } from './block';

/**
 * Transaction output.
 *
 * The current implementation supports only unspent transaction outputs aka UTX0,
 * with a very limited range of supported locking script.
 */
@entity.name('chain/transaction/output')
export class Output {
    constructor(
        /**
         * The amount to be sent as (big) integer
         */
        @t public amount: bigint,
        /**
         * The locking script.
         *
         * Historically, the locking script was called a scriptPubKey, because it usually contained a public key or bitcoin address.
         * In our implementation we support only wallet addresses in this field, instead of a script string/binary.
         */
        @t public scriptPubKey: Uint8Array,
    ) {
    }
}

@entity.name('chain/transaction/input')
export class Input {
    constructor(
        /**
         * The transaction hash.
         */
        @t public transaction: Uint8Array,
        /**
         * The UTXO index of the transaction
         */
        @t public outputIndex: number,
        /**
         * The unlocking script. The unlocking script is usually a signature, proving ownership of the address that is in the locking script.
         *
         * Historically, the unlocking script is called scriptSig, because it usually contained a digital signature.
         * In our implementation we support only signatures, instead of a script string/binary.
         */
        @t public scriptSig: Uint8Array,
        @t public sequenceNumber: number,
    ) {
    }
}

export interface UTXO {
    block: Block;
    transaction: Transaction;
    outputIndex: number;
    amount: bigint;
}

/**
 * A block transaction.
 *
 * A transaction consists of inputs and outputs.
 * The very first transaction in a block is called a coinbase transaction and has no inputs, creating basically bitcoins out of nothing
 * as reward for mining the block.
 *
 * The binary structure of a transaction is as follows:
 *
 * <version uint32><inputCount varUint>[<input>]<outputCount varUint>[<output>]<lockTime uint32>
 *
 * where <input> is:
 * <transactionHash char[32]><outputIndex uint32><scriptSize varUint><script char[scriptSize]><sequenceNumber uint32>
 *
 * where <output> is:
 * <amount uint64><scriptSize varUint><script char[scriptSize]>
 */
@entity.name('chain/transaction')
export class Transaction {
    protected hash: Uint8Array = new Uint8Array(0);

    @t version: number = 1;
    @t.array(Input) input: Input[] = [];
    @t.array(Output) output: Output[] = [];

    @t locktime: number = 0;

    static SIGHASH_ALL = 0x00000001;
    static SIGHASH_NONE = 0x00000002;
    static SIGHASH_SINGLE = 0x00000003;
    static SIGHASH_ANYONECANPAY = 0x00000080;

    /**
     * The binary representation of this transaction.
     * This is filled when read from the blockchain file or received from a peer.
     */
    protected buffer?: Uint8Array;

    isBuilt(): boolean {
        return this.buffer !== undefined;
    }

    getBuffer(): Uint8Array {
        if (this.buffer) return this.buffer;

        let inputSize = 0;
        let outputSize = 0;
        for (const input of this.input) inputSize += (32 + 4 + varUintBytes(input.scriptSig.byteLength) + input.scriptSig.byteLength + 4);
        for (const output of this.output) outputSize += (8 + varUintBytes(output.scriptPubKey.byteLength) + output.scriptPubKey.byteLength);

        const buffer = Buffer.allocUnsafe(4 + varUintBytes(this.input.length) + inputSize + varUintBytes(this.output.length) + outputSize + 4);
        const writer = new BitcoinWriter(buffer);
        writer.writeUint32(1);
        writer.writeVarUint(this.input.length);

        for (const input of this.input) {
            writer.writeBuffer(input.transaction); //transactionHash
            writer.writeUint32(input.outputIndex); //outputIndex
            writer.writeVarUint(input.scriptSig.byteLength); //scriptSize
            writer.writeBuffer(input.scriptSig); //script, in our case signature
            writer.writeUint32(input.sequenceNumber); //sequenceNumber
        }

        writer.writeVarUint(this.output.length);
        for (const output of this.output) {
            writer.writeBigUint(output.amount);
            writer.writeVarUint(output.scriptPubKey.byteLength); //scriptSize
            writer.writeBuffer(output.scriptPubKey); //script, in our case address
        }

        writer.writeUint32(this.locktime); //locktime
        this.buffer = buffer;
        return buffer;
    }

    static fromBuffer(reader: BitcoinReader) {
        const transaction = new Transaction();
        const version = reader.eatUInt32();
        const inputs = reader.eatVarUint();
        for (let i = 0; i < inputs; i++) {
            transaction.input.push({
                transaction: reader.eatSlice(32),
                outputIndex: reader.eatUInt32(),
                scriptSig: reader.eatSlice(reader.eatVarUint()),
                sequenceNumber: reader.eatUInt32()
            });
        }

        const outputs = reader.eatVarUint();
        for (let i = 0; i < outputs; i++) {
            transaction.output.push({
                amount: reader.eatBigInt64(),
                scriptPubKey: reader.eatSlice(reader.eatVarUint())
            });
        }
        transaction.locktime = reader.eatUInt32();

        return transaction;
    }

    getHash(): Uint8Array {
        if (this.hash.byteLength === 0) {
            this.hash = doubleSHA256(this.getBuffer());
        }

        return this.hash;
    }

    clone(): Transaction {
        const t = new Transaction();
        t.version = this.version;
        t.locktime = this.locktime;
        t.input = this.input.map(v => {
            return { ...v };
        });
        t.output = this.output.map(v => {
            return { ...v };
        });
        return t;
    }

    isValid(): boolean {
        if (!this.output.length) throw new Error(`Transaction has no outputs`);

        return true;
    }

    addInput(transaction: Uint8Array, outputIndex: number, scriptSig: Uint8Array = EmptyScript, sequenceNumber: number = 0xffff_ffff) {
        if (transaction.byteLength !== 32) throw new Error('Transaction hash has to be 32 byte');
        this.input.push(new Input(transaction, outputIndex, scriptSig, sequenceNumber));
    }

    addOutput(amount: bigint, scriptPubKey: Uint8Array = EmptyScript) {
        this.output.push(new Output(amount, scriptPubKey));
    }
}
