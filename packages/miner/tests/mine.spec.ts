import { Mine } from '../src/mine';
import { MainBlockchain, MinerWallet, TransactionPool } from '../src/state';
import { createCoinbase, createWallet, transferMoneyFromTo } from '@mycoin/blockchain';

test('mine', async () => {
    const mainChain = new MainBlockchain();
    const pool = new TransactionPool();
    const minerWallet = MinerWallet.create();
    createCoinbase(mainChain.getChain().createBlock(), minerWallet.wallet, 50n);
    expect(mainChain.getChain().getHeight()).toBe(2);

    const aliceWallet = createWallet();

    mainChain.getChain().createBlock().addTransaction(transferMoneyFromTo(mainChain.getChain(), minerWallet.wallet, aliceWallet.pubKeyHash, 5n));
    expect(mainChain.getChain().getHeight()).toBe(3);

    const mine = new Mine(mainChain, pool, minerWallet, { transactionPerBlock: 1 });
    await mine.mineNextBlockIfNecessary();
    expect(mainChain.getChain().getHeight()).toBe(3); //nothing is done

    pool.add(transferMoneyFromTo(mainChain.getChain(), minerWallet.wallet, aliceWallet.pubKeyHash, 5n));
    const minedBlock = await mine.untilCurrentMiningIsDone();
    console.log('mining took', minedBlock?.took, 'ms', minedBlock?.hashes, 'hashes');
    expect(mainChain.getChain().getHeight()).toBe(4);
});
