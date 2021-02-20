import { AppModuleConfig } from '@deepkit/app';
import { t } from '@deepkit/type';

export const appConfig = new AppModuleConfig({
    transactionPerBlock: t.number.default(1),
    minerWalletPrivateKey: t.string.optional.description('private key of the miner wallet, where coinbase and transaction fees are transferred to. As hex string.'),
    minerWalletPublicKey: t.string.optional.description('public key of the private key. As hex string.'),
});