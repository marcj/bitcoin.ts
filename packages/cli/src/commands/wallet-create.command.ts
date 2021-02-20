import { cli, Command } from '@deepkit/app';
import { Logger } from '@deepkit/logger';
import { coinAddress, createWallet, hash160, uncompressedPublicKey } from '@mycoin/blockchain';

@cli.controller('wallet:create', {
    description: 'Create a new wallet, printing its private and public key as hex. Use the public key or its hash as coin address, and hide and lock the private key.'
})
export class WalletCreateCommand implements Command {
    constructor(protected logger: Logger) {
    }

    async execute(): Promise<any> {
        const wallet = createWallet();
        this.logger.log('<green>You new wallet has been created</green>');
        this.logger.log(`<green>The coin address: ${coinAddress(wallet.publicKey)}</green>`);
        this.logger.log(`<green>Public key: ${Buffer.from(wallet.publicKey).toString('hex')}</green>`);
        this.logger.log(`<green>Public key (uncompressed): ${Buffer.from(uncompressedPublicKey(wallet.publicKey)).toString('hex')}</green>`);
        this.logger.log(`<green>RIPEMD-160 Hash: ${Buffer.from(hash160(wallet.publicKey)).toString('hex')}</green>`);
        this.logger.log(`<red>Private key: ${Buffer.from(wallet.privateKey).toString('hex')}</red> (keep private!)`);
    }
}