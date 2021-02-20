import { Block, COIN } from './block';

/**
 * The root block of the chain, aka genesis block.
 *
 * See https://github.com/bitcoin/bitcoin/blob/3955c3940eff83518c186facfec6f50545b5aab5/src/chainparams.cpp#L123
 */
export const genesisBlock = new Block(0n);
genesisBlock.timestamp = 1231006505;
genesisBlock.nonce = 2083236893;
genesisBlock.nBits = 0x1f00_ffffn;
export const genesisText = Buffer.from('The Times 03/Jan/2009 Chancellor on brink of second bailout for banks', 'utf8')

genesisBlock.addCoinbaseTransaction(50n * COIN, genesisText);
