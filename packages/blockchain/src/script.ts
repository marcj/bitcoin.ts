import { BitcoinReader, BitcoinWriter } from './buffer';
import { bufferEqual, hash160, SHA256 } from './utils';
import { Transaction } from './transaction';
import * as secp256k1 from 'secp256k1';
import { getTransactionHashForSignature } from './transfer';

export abstract class OP {
    abstract op(): number;

    abstract size(): number;

    abstract write(writer: BitcoinWriter): void;

    /**
     * Seeks over this OP, excluding the OP itself.
     */
    abstract seek(reader: BitcoinReader): void;

    abstract eval(stack: Uint8Array[], reader: BitcoinReader, transactionValidation: TransactionValidation): void;
}

export class OP_PUSH extends OP {
    constructor(public data: Uint8Array) {
        super();
        if (data.byteLength > 75) throw new Error('OP_PUSH currently only supports 1-75 bytes');
    }

    op(): number {
        return this.data.byteLength;
    }

    size(): number {
        return 1 + this.data.byteLength;
    }

    seek(reader: BitcoinReader): void {
        reader.offset += this.data.byteLength;
    }

    write(writer: BitcoinWriter): void {
        writer.writeByte(this.data.byteLength);
        writer.writeBuffer(this.data);
    }

    eval(stack: Uint8Array[], reader: BitcoinReader) {
        stack.push(reader.eatBuffer(this.data.byteLength));
    }
}

export class StaticOP extends OP {
    constructor(public byte: number) {
        super();
    }

    op(): number {
        return this.byte;
    }

    size(): number {
        return 1;
    }

    seek(reader: BitcoinReader): void {
        //no additional data on top of the OP itself.
    }

    eval(stack: Uint8Array[], reader: BitcoinReader, transactionValidation: TransactionValidation): void {
    }

    write(writer: BitcoinWriter): void {
        writer.writeByte(this.byte);
    }
}

class ArithmeticOP extends StaticOP {
    constructor(op: number) {
        super(op);
    }

    eval(stack: Uint8Array[], reader: BitcoinReader) {
        if (stack.length < 2) throw new Error(`OP ${this.op} requires stack size of at least 2, given ${stack.length}.`);
        if (stack[stack.length - 2].byteLength !== 4) throw new Error('OP expects stack-1 to be 4 bytes');
        if (stack[stack.length - 1].byteLength !== 4) throw new Error('OP expects stack-0 to be 4 bytes');

        const result = Buffer.alloc(4);
        result.writeInt32LE(
            this.output(Buffer.from(stack[stack.length - 2]).readInt32LE(), Buffer.from(stack[stack.length - 1]).readInt32LE())
        );
        stack.push(result);
    }

    protected output(a: number, b: number): number {
        return a + b;
    }
}

export class OP_ADD extends ArithmeticOP {
    constructor() {
        super(0x93);
    }

    output(a: number, b: number): number {
        return a + b;
    }
}

export class OP_CODESEPARATOR extends StaticOP {
    constructor() {
        super(0xab);
    }
}

export class OP_DUP extends StaticOP {
    constructor() {
        super(0x76);
    }

    eval(stack: Uint8Array[], reader: BitcoinReader): void {
        if (stack.length === 0) throw new Error('OP_DUP: stack empty');

        stack.push(stack[stack.length - 1]);
    }
}

export class OP_HASH160 extends StaticOP {
    constructor() {
        super(0xa9);
    }

    eval(stack: Uint8Array[], reader: BitcoinReader): void {
        if (stack.length === 0) throw new Error('OP_HASH160: stack empty');

        stack.push(hash160(stack.pop()!));
    }
}

export class OP_SHA256 extends StaticOP {
    constructor() {
        super(0xa8);
    }

    eval(stack: Uint8Array[], reader: BitcoinReader): void {
        if (stack.length === 0) throw new Error('OP_SHA256: stack empty');

        stack.push(SHA256(stack.pop()!));
    }
}

export class OP_EQUAL extends StaticOP {
    constructor() {
        super(0x87);
    }

    eval(stack: Uint8Array[], reader: BitcoinReader, transactionValidation: TransactionValidation): void {
        if (stack.length < 2) throw new Error('OP_EQUAL: stack too small');

        const a = stack.pop()!;
        const b = stack.pop()!;

        stack.push(new Uint8Array([
            bufferEqual(a, b) ? OP_TRUE_b : OP_FALSE_b,
        ]));
    }
}

/**
 * Same as OP_EQUAL+OP_VERIFY
 */
export class OP_EQUALVERIFY extends StaticOP {
    constructor() {
        super(0x88);
    }

    eval(stack: Uint8Array[], reader: BitcoinReader, transactionValidation: TransactionValidation): void {
        new OP_EQUAL().eval(stack, reader, transactionValidation);
        new OP_VERIFY().eval(stack, reader, transactionValidation);
    }
}

/**
 * Marks transaction as invalid if top stack value is not true. The top stack value is removed.
 */
export class OP_VERIFY extends StaticOP {
    constructor() {
        super(0x69);
    }

    eval(stack: Uint8Array[], reader: BitcoinReader, transactionValidation: TransactionValidation): void {
        if (stack.length < 1) throw new Error('OP_VERIFY: stack too small');

        const valid = stack[stack.length - 1][0] === OP_TRUE_b;
        if (!valid) throw new Error('OP_VERIFY failed');
        stack.pop();
    }
}

/**
 * The entire transaction's outputs, inputs, and script (from the most recently-executed OP_CODESEPARATOR to the end) are hashed.
 * The signature used by OP_CHECKSIG must be a valid signature for this hash and public key. If it is, 1 is returned, 0 otherwise.
 *
 * See https://en.bitcoin.it/wiki/OP_CHECKSIG
 */
export class OP_CHECKSIG extends StaticOP {
    constructor() {
        super(0xac);
    }

    eval(stack: Uint8Array[], reader: BitcoinReader, transactionValidation: TransactionValidation): void {
        if (stack.length < 2) throw new Error('OP_CHECKSIG: stack too small');

        let pubKey = stack.pop()!;
        let sig = stack.pop()!;
        if (sig.byteLength !== 71 && sig.byteLength !== 72) throw new Error(`Sig must be 71/72 bytes, got ${sig.byteLength}`);

        const hashTypeNumber = sig[sig.byteLength - 1];

        const transactionHash = getTransactionHashForSignature(
            transactionValidation.previousTransaction, transactionValidation.transaction, transactionValidation.inputIndex, hashTypeNumber
        );

        const sigDEC = sig.slice(0, sig.byteLength - 1);
        const signature = secp256k1.signatureImport(sigDEC);
        const verified = secp256k1.ecdsaVerify(signature, transactionHash, pubKey);

        stack.push(new Uint8Array([verified ? OP_TRUE_b : OP_FALSE_b]));
    }
}

/**
 * Same as OP_CHECKSIG+OP_VERIFY
 */
export class OP_CHECKSIGVERIFY extends StaticOP {
    constructor() {
        super(0xad);
    }

    eval(stack: Uint8Array[], reader: BitcoinReader, transactionValidation: TransactionValidation): void {
        new OP_CHECKSIG().eval(stack, reader, transactionValidation);
        new OP_VERIFY().eval(stack, reader, transactionValidation);
    }
}

export const OP_FALSE_b = 0x00;
export const OP_TRUE_b = 0x51;

const opHandlers: OP[] = [];
const ops: OP[] = [
    new OP_ADD, new OP_DUP, new OP_HASH160, new OP_SHA256,
    new OP_EQUAL, new OP_VERIFY, new OP_EQUALVERIFY, new OP_CHECKSIG,
    new OP_CODESEPARATOR, new OP_CHECKSIGVERIFY,
];

for (let i = 0x01; i <= 0x4b; i++) {
    opHandlers[i] = new OP_PUSH(new Uint8Array(i));
}

for (const op of ops) {
    opHandlers[op.op()] = op;
}

export class BitcoinScript {
    protected ops: OP[] = [];

    add(...ops: (OP | Uint8Array)[]) {
        for (const op of ops) {
            if (op instanceof Uint8Array) {
                this.ops.push(new OP_PUSH(op));
            } else {
                this.ops.push(op);
            }
        }
    }

    push(data: Uint8Array) {
        this.ops.push(new OP_PUSH(data));
    }

    pushInt32(v: number) {
        const buffer = Buffer.alloc(4);
        buffer.writeInt32LE(v);
        this.ops.push(new OP_PUSH(buffer));
    }

    getSize(): number {
        let size = 0;
        for (const op of this.ops) size += op.size();
        return size;
    }

    getBuffer(): Uint8Array {
        const writer = new BitcoinWriter(Buffer.alloc(this.getSize()));
        for (const op of this.ops) {
            op.write(writer);
        }
        return writer.buffer;
    }
}

export class TransactionValidation {
    valid: boolean = true;

    previousTransaction: Transaction = new Transaction();

    transaction: Transaction = new Transaction();
    inputIndex: number = 0;
}

export function scriptSeek(script: Uint8Array, until: (op: number, reader: BitcoinReader) => boolean): BitcoinReader {
    const reader = new BitcoinReader(Buffer.from(script));

    while (reader.isParsing()) {
        const op = reader.eatByte();
        if (until(op, reader)) return reader;

        const opHandler = opHandlers[op];
        if (!opHandler) throw new Error(`No OP handler for 0x${op.toString(16)} found.`);
        opHandler.seek(reader);
    }

    return reader;
}

/**
 * Cuts the script so that we get the part after the last OP_CODESEPARATOR. If no such OP is found, the whole script
 * is returned.*/
export function lastCodeBlock(script: Uint8Array): Uint8Array {
    const opCS = new OP_CODESEPARATOR().op();
    const reader = scriptSeek(script, (op) => op === opCS);
    //not found
    if (!reader.isParsing()) return script;

    return script.slice(reader.offset);
}

export class BitcoinScriptVM {
    stack: Uint8Array[] = [];

    constructor(public script: Uint8Array) {
    }

    toString(): string {
        const res: string[] = [];
        const reader = new BitcoinReader(Buffer.from(this.script));

        while (reader.isParsing()) {
            const op = reader.eatByte();
            const opHandler = opHandlers[op];
            if (!opHandler) {
                res.push(`0x${op.toString(16)}`);
                continue;
            }

            if (opHandler instanceof OP_PUSH) {
                const stack: any[] = [];
                opHandler.eval(stack, reader);
                res.push(`<${Buffer.from(stack[0]).toString('hex')}>`);
            } else {
                res.push(opHandler.constructor.name);
                opHandler.seek(reader);
            }
        }

        return res.join(' ');
    }

    eval(transactionValidation: TransactionValidation = new TransactionValidation): Uint8Array {
        const reader = new BitcoinReader(Buffer.from(this.script));

        while (reader.isParsing()) {
            const op = reader.eatByte();
            const opHandler = opHandlers[op];
            if (!opHandler) throw new Error(`No OP handler for 0x${op.toString(16)} found.`);
            opHandler.eval(this.stack, reader, transactionValidation);
        }

        return this.stack[this.stack.length - 1];
    }
}
