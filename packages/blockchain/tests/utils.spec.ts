import { bigIntTo32Buffer, bufferEqual, coinAddress, extractHash160FromCoinAddress, hash160 } from '../src/utils';
import { createWallet } from '../src/wallet';

(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

test('bigIntTo32Buffer', () => {
    const buffer = bigIntTo32Buffer(254n);
    expect(buffer.byteLength).toBe(32);
    const expected = new Uint8Array(32);
    expected[31] = 254;
    expect([...buffer]).toEqual([...expected]);
});

test('bufferEqual', () => {
    {
        const a = bigIntTo32Buffer(254n);
        const b = bigIntTo32Buffer(254n);
        expect(bufferEqual(a, b)).toBe(true);
    }

    {
        const a = bigIntTo32Buffer(254n);
        const b = bigIntTo32Buffer(253n);
        expect(bufferEqual(a, b)).toBe(false);
    }

    {
        const a = new Uint8Array(32);
        const b = new Uint8Array(32);
        a[4] = 55;
        expect(bufferEqual(a, b)).toBe(false);
    }
});

test('coinAddress', () => {
    const wallet = createWallet();
    const h160 = hash160(wallet.publicKey);
    const cAddress = coinAddress(wallet.publicKey);
    const backH160 = extractHash160FromCoinAddress(cAddress);
    expect([...backH160]).toEqual([...h160]);
});
