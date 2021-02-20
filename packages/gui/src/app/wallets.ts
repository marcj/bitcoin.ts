import { jsonSerializer, t } from '@deepkit/type';
import { ApiWallet } from '@mycoin/miner-api';


export class Wallets {
    @t.array(ApiWallet) wallets: ApiWallet[] = [];

    restore() {
        const parsed = JSON.parse(localStorage.getItem('mycoin/wallets') || '{}');
        const w = jsonSerializer.for(Wallets).deserialize(parsed);
        this.wallets = w.wallets;
    }

    add(wallet: ApiWallet) {
        this.wallets.push(wallet);
        this.save();
    }

    save() {
        localStorage.setItem('mycoin/wallets', JSON.stringify(jsonSerializer.for(Wallets).serialize(this)));
    }
}
