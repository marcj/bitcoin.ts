import { BitcoinScript, BitcoinScriptVM, lastCodeBlock, OP_ADD, OP_CODESEPARATOR, OP_DUP, OP_EQUAL, OP_EQUALVERIFY, OP_FALSE_b, OP_HASH160, OP_PUSH, OP_SHA256, OP_TRUE_b, OP_VERIFY, scriptSeek, TransactionValidation } from '../src/script';
import { ripemd160, SHA256 } from '../src/utils';


test('bitcoin script simple push', () => {
    const script = new BitcoinScript();
    script.push(new Uint8Array([5]));

    expect(script.getBuffer().byteLength).toBe(2);

    const vm = new BitcoinScriptVM(script.getBuffer());
    expect([...vm.eval()]).toEqual([5]);
});

test('bitcoin script push hash', () => {
    const script = new BitcoinScript();
    script.push(SHA256(new Uint8Array([1, 2, 3])));

    expect(script.getBuffer().byteLength).toBe(1 + 32);

    const vm = new BitcoinScriptVM(script.getBuffer());
    expect(vm.eval().byteLength).toEqual(32);
});

test('bitcoin script simple push, returning always last', () => {
    const script = new BitcoinScript();
    script.push(new Uint8Array([5]));
    script.push(new Uint8Array([6]));
    script.push(new Uint8Array([7]));

    const vm = new BitcoinScriptVM(script.getBuffer());
    expect([...vm.eval()]).toEqual([7]);
});

test('bitcoin scriptSeek until', () => {
    const script = new BitcoinScript();
    script.push(new Uint8Array([5])); //2 bytes
    script.push(new Uint8Array([6])); //2 bytes
    script.add(new OP_ADD); //1 byte
    script.push(new Uint8Array([7])); //2 bytes

    const OD_ADDn = new OP_ADD().op();

    const reader = scriptSeek(script.getBuffer(), (op) => {
        return op === OD_ADDn;
    });

    expect(reader.offset).toBe(2 + 2 + 1);
    reader.offset--;
    expect(reader.eatByte()).toBe(OD_ADDn);
});

test('bitcoin scriptSeek after binary until', () => {
    const script = new BitcoinScript();
    script.push(SHA256(new Uint8Array([1, 2, 3]))); //33 bytes
    script.add(new OP_ADD); //1 byte
    script.push(new Uint8Array([7])); //2 bytes
    const OD_ADDn = new OP_ADD().op();

    const reader = scriptSeek(script.getBuffer(), (op) => {
        return op === OD_ADDn;
    });

    expect(reader.offset).toBe(33 + 1);
    reader.offset--;
    expect(reader.eatByte()).toBe(OD_ADDn);
});

test('bitcoin scriptSeek end', () => {
    const script = new BitcoinScript();
    script.push(new Uint8Array([5])); //2 bytes
    script.push(new Uint8Array([6])); //2 bytes
    script.add(new OP_ADD); //1 byte
    script.push(new Uint8Array([7])); //2 bytes

    expect(new OP_ADD().size()).toBe(1);
    expect(new OP_PUSH(new Uint8Array([7])).size()).toBe(2);

    const reader = scriptSeek(script.getBuffer(), (op) => {
        return false;
    });

    expect(script.getBuffer().byteLength).toBe(2 + 2 + 1 + 2);
    expect(reader.offset).toBe(2 + 2 + 1 + 2);
});

test('bitcoin lastCodeBlock full', () => {
    const script = new BitcoinScript();
    script.push(new Uint8Array([5])); //2 bytes
    script.push(new Uint8Array([6])); //2 bytes
    script.add(new OP_ADD); //1 byte
    script.push(new Uint8Array([7])); //2 bytes

    const lastBlock = lastCodeBlock(script.getBuffer());
    expect(lastBlock.byteLength).toBe(2 + 2 + 1 + 2);
});

test('bitcoin lastCodeBlock chunk', () => {
    const script = new BitcoinScript();
    script.push(new Uint8Array([5])); //2 bytes
    script.push(new Uint8Array([6])); //2 bytes
    script.add(new OP_ADD); //1 byte
    script.add(new OP_CODESEPARATOR()); //1 byte
    script.push(new Uint8Array([7])); //2 bytes

    const lastBlock = lastCodeBlock(script.getBuffer());
    expect(lastBlock.byteLength).toBe(2);
});

test('bitcoin script dup', () => {
    const script = new BitcoinScript();
    script.pushInt32(5);
    script.add(new OP_DUP);
    script.add(new OP_ADD);

    const vm = new BitcoinScriptVM(script.getBuffer());
    expect([...vm.eval()]).toEqual([10, 0, 0, 0]);
});

test('bitcoin script addition', () => {
    const script = new BitcoinScript();
    script.pushInt32(5);
    script.pushInt32(20);
    script.add(new OP_ADD);

    const vm = new BitcoinScriptVM(script.getBuffer());
    expect([...vm.eval()]).toEqual([25, 0, 0, 0]);
});

test('bitcoin script sha256', () => {
    const script = new BitcoinScript();
    script.push(new Uint8Array(['5'.charCodeAt(0)]));
    script.add(new OP_SHA256);

    const vm = new BitcoinScriptVM(script.getBuffer());
    expect([...vm.eval()]).toEqual([...Buffer.from('ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d', 'hex')]);
});

test('bitcoin script hash160', () => {
    const script = new BitcoinScript();
    script.push(new Uint8Array(['5'.charCodeAt(0)]));
    script.add(new OP_HASH160);

    //first argument is the sha256 of '5'
    const expected = ripemd160(Buffer.from('ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d', 'hex'));

    const vm = new BitcoinScriptVM(script.getBuffer());
    expect([...vm.eval()]).toEqual([...expected]);
});

test('bitcoin script equal + verify', () => {
    {
        const transactionValidation = new TransactionValidation;
        const script = new BitcoinScript();
        script.push(new Uint8Array([4, 44]));
        script.push(new Uint8Array([5, 55]));
        script.add(new OP_EQUAL);

        const vm1 = new BitcoinScriptVM(script.getBuffer());
        expect([...vm1.eval(transactionValidation)]).toEqual([OP_FALSE_b]);
        expect(transactionValidation.valid).toBe(true);


        script.add(new OP_VERIFY);
        const vm2 = new BitcoinScriptVM(script.getBuffer());
        expect(() => vm2.eval(transactionValidation)).toThrow('OP_VERIFY');
    }

    {
        const transactionValidation = new TransactionValidation;
        const script = new BitcoinScript();
        script.push(new Uint8Array([4, 44]));
        script.push(new Uint8Array([4, 44]));
        script.add(new OP_EQUAL);

        const vm1 = new BitcoinScriptVM(script.getBuffer());
        expect([...vm1.eval(transactionValidation)]).toEqual([OP_TRUE_b]);
        expect(transactionValidation.valid).toBe(true);

        script.add(new OP_VERIFY);
        const vm2 = new BitcoinScriptVM(script.getBuffer());
        expect(vm2.eval(transactionValidation)).toEqual(undefined);
    }
});

test('bitcoin script equalverify', () => {
    {
        const transactionValidation = new TransactionValidation;
        const script = new BitcoinScript();
        script.push(new Uint8Array([4, 44]));
        script.push(new Uint8Array([5, 55]));
        script.add(new OP_EQUALVERIFY());

        const vm1 = new BitcoinScriptVM(script.getBuffer());
        expect(() => vm1.eval(transactionValidation)).toThrow('OP_VERIFY failed');
    }

    {
        const transactionValidation = new TransactionValidation;
        const script = new BitcoinScript();
        script.push(new Uint8Array([4, 44]));
        script.push(new Uint8Array([4, 44]));
        script.add(new OP_EQUALVERIFY);

        const vm1 = new BitcoinScriptVM(script.getBuffer());
        expect(vm1.eval(transactionValidation)).toEqual(undefined);
    }
});