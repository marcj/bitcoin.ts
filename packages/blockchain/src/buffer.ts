import * as varUint from 'varuint-bitcoin';

export function varUintBytes(n: number): number {
    return varUint.encodingLength(n);
}

export class BitcoinReader {
    public size: number;
    public dataView: DataView;

    constructor(public buffer: Buffer, public offset: number = 0) {
        this.size = buffer.byteLength;
        this.dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }

    isParsing(): boolean {
        return this.offset < this.buffer.byteLength;
    }

    eatByte(): number {
        return this.buffer[this.offset++];
    }

    eatBuffer(size: number): Uint8Array {
        this.offset += size;
        return this.buffer.slice(this.offset - size, this.offset);
    }

    eatUInt32(): number {
        this.offset += 4;
        return this.dataView.getUint32(this.offset - 4, true);
    }

    eatSlice(length: number): Uint8Array {
        const slice = this.buffer.slice(this.offset, this.offset + length);
        this.offset += length;
        return slice;
    }

    eatVarUint(): number {
        const v = varUint.decode(this.buffer, this.offset);
        this.offset += varUint.decode.bytes;
        return v;
    }

    eatBigInt64(): bigint {
        const n = this.dataView.getBigUint64(this.offset, true);
        this.offset += 8;
        return n;
    }
}

export class BitcoinWriter {
    public dataView: DataView;

    constructor(public buffer: Buffer, public offset: number = 0) {
        this.dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }

    writeUint32(v: number) {
        this.dataView.setUint32(this.offset, v, true);
        this.offset += 4;
    }

    writeBuffer(buffer: Uint8Array, offset: number = 0) {
        for (let i = offset; i < buffer.byteLength; i++) {
            this.buffer[this.offset++] = buffer[i];
        }
    }

    writeByte(v: number) {
        this.buffer[this.offset++] = v;
    }

    writeBigUint(v: bigint) {
        this.dataView.setBigUint64(this.offset, v, true);
        this.offset += 8;
    }

    writeVarUint(v: number) {
        varUint.encode(v, this.buffer, this.offset);
        this.offset += varUint.encode.bytes;
    }
}