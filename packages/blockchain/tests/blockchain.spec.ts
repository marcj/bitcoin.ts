import { Block, COIN } from '../src/block';
import { Transaction } from '../src/transaction';
import { createWallet, } from '../src/wallet';
import { createCoinbase, extractPubKeyHashFromPayToPubKeyHashScript, lockPayToPubKeyHash, transferMoneyFromTo } from '../src/transfer';
import { BlockChain } from '../src/blockchain';
import { getUTXO } from '../src/balance';
import { bufferToHex, hash160 } from '../src/utils';
import { validateBlock } from '../src/validate';
import { genesisBlock } from '../src/genesis';

(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

test('simple block', () => {
    const block = new Block(0n);
    expect(block.getBuffer().byteLength).toBe(85);
});

test('block', () => {
    const block = new Block(0n);
    const helloWorld = Buffer.from('hello world', 'utf8');
    const t = new Transaction();
    t.addInput(new Uint8Array(32), 0);
    t.addOutput(50n);
    block.addTransaction(t);

    t.input[0].scriptSig = helloWorld;

    expect(bufferToHex(t.getHash())).toBe(bufferToHex(t.clone().getHash()));

    const buffer = block.getBuffer();
    const block2 = Block.fromBuffer(buffer);
    expect(block2.version).toBe(block.version);
    expect(block2.timestamp).toBe(block.timestamp);
    expect(block2.previous).toBe(block.previous);
    expect(block2.nBits).toBe(block.nBits);
    expect([...block2.merkleRoot]).toEqual([...block.merkleRoot]);
    expect(block2.transactions.length).toBe(block.transactions.length);

    expect(block2.transactions.length).toBe(1);
    expect(block2.transactions[0].input.length).toBe(1);
    expect(block2.transactions[0].output.length).toBe(1);

    for (let i = 0; i < block2.transactions.length; i++) {
        const actual = block2.transactions[i];
        const expected = block.transactions[i];
        expect(actual.input.length).toBe(expected.input.length);
        expect(actual.output.length).toBe(expected.output.length);

        for (let input = 0; input < actual.input.length; input++) {
            const inputActual = actual.input[input];
            const inputExpected = expected.input[input];
            expect([...inputActual.scriptSig]).toEqual([...helloWorld]);
            expect([...inputActual.transaction]).toEqual([...inputExpected.transaction]);
            expect([...inputActual.scriptSig]).toEqual([...inputExpected.scriptSig]);
            expect(inputActual.outputIndex).toEqual(inputExpected.outputIndex);
        }

        for (let output = 0; output < actual.output.length; output++) {
            const outputActual = actual.output[output];
            const outputExpected = expected.output[output];
            expect([...outputActual.scriptPubKey]).toEqual([...outputExpected.scriptPubKey]);
            expect(outputActual.amount).toEqual(outputExpected.amount);
        }
    }
});

test('blockchain low-level', () => {
    const chain = new BlockChain();
    const minerWallet = createWallet();
    const myWallet = createWallet();

    const block1 = chain.createBlock();
    const transaction1 = block1.addCoinbaseTransaction(50n * COIN);
    lockPayToPubKeyHash(minerWallet.pubKeyHash, transaction1, 0);
    expect(getUTXO(chain, minerWallet.pubKeyHash).total).toBe(50n * COIN);
    expect([...extractPubKeyHashFromPayToPubKeyHashScript(transaction1.output[0].scriptPubKey)!]).toEqual([...hash160(minerWallet.publicKey)]);

    {
        const block2 = chain.createBlock();
        const coinbase2 = block2.addCoinbaseTransaction(50n * COIN);
        lockPayToPubKeyHash(minerWallet.pubKeyHash, coinbase2, 0);

        const transaction2 = block2.createTransaction();

        //move money from the minerWallet to our pockets
        transaction2.addInput(transaction1.getHash(), 0);
        transaction2.addOutput(2n, myWallet.address);
        transaction2.addOutput(50n * COIN - 2n, minerWallet.address);

        //it's important to first lock UXTO, before creating input unlocks/signs
        lockPayToPubKeyHash(myWallet.pubKeyHash, transaction2, 0);
        lockPayToPubKeyHash(minerWallet.pubKeyHash, transaction2, 1);

        minerWallet.unlockPayToPubKeyHash(transaction1, transaction2, 0);

        expect(validateBlock(chain, block2)).toBe(true);

        expect(getUTXO(chain, minerWallet.pubKeyHash).total).toBe(50n * COIN - 2n);
        expect(getUTXO(chain, myWallet.pubKeyHash).total).toBe(2n);
    }
});

test('blockchain high-level', () => {
    const chain = new BlockChain();
    const minerWallet = createWallet();
    const myWallet = createWallet();

    createCoinbase(chain.createBlock(), minerWallet, 50n);
    expect(validateBlock(chain, chain.getHead())).toBe(true);

    expect(getUTXO(chain, minerWallet.pubKeyHash).total).toBe(50n);
    expect(getUTXO(chain, myWallet.pubKeyHash).total).toBe(0n);

    chain.createBlock().addTransaction(transferMoneyFromTo(chain, minerWallet, myWallet.pubKeyHash, 5n));
    expect(validateBlock(chain, chain.getHead())).toBe(true);

    expect(getUTXO(chain, minerWallet.pubKeyHash).total).toBe(45n);
    expect(getUTXO(chain, myWallet.pubKeyHash).total).toBe(5n);
});


test('blockchain from genesis valid', () => {
    const chain = new BlockChain();
    const myWallet = createWallet();

    const block = chain.createBlock();
    const transaction = block.createTransaction();
    transaction.addInput(genesisBlock.transactions[0].getHash(), 0);
    transaction.addOutput(50n);
    lockPayToPubKeyHash(myWallet.pubKeyHash, transaction, 0);

    expect(validateBlock(chain, block)).toBe(true);
});
