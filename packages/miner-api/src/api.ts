import { ControllerSymbol } from '@deepkit/rpc';
import { entity, t } from '@deepkit/type';
import { Subject } from 'rxjs';


@entity.name('miner/api/transaction/input')
export class ApiTransactionInput {
    constructor(
        @t public transaction: string,
        @t public outputIndex: number,
        @t public scriptSig: string,
        @t public sequenceNumber: number,
    ) {
    }
}

@entity.name('miner/api/transaction/output')
export class ApiTransactionOutput {
    constructor(
        @t public amount: number,
        @t public scriptPubKey: string,
    ) {
    }
}

@entity.name('miner/api/transaction')
export class ApiTransaction {
    @t.array(ApiTransactionInput) input: ApiTransactionInput[] = [];
    @t.array(ApiTransactionOutput) output: ApiTransactionOutput[] = [];

    constructor(
        @t public block: string,
        @t public timestamp: number,
        @t public hash: string,
        @t.array(t.string) public from: string[],
        @t.array(t.string) public to: string[],
        @t public volume: number,
    ) {
    }
}

@entity.name('miner/api/block')
export class ApiBlock {
    @t.array(ApiTransaction) transactions: ApiTransaction[] = [];

    constructor(
        @t public timestamp: number,
        @t public hash: string,
        @t public previous: string,
        @t public height: number,
        @t public difficulty: string,
    ) {
    }
}

@entity.name('miner/api/wallet')
export class ApiWallet {
    @t address: string = '';

    constructor(
        @t public privateKey: Uint8Array,
        @t public publicKey: Uint8Array,
    ) {
    }
}

@entity.name('miner/api/address')
export class ApiAddress {
    @t.array(ApiTransaction) transactions: ApiTransaction[] = [];

    constructor(
        @t public publicKeyHash: string,
        @t public coinAddress: string,
    ) {
    }
}

@entity.name('miner/api/addressResolved')
export class ApiAddressResolved {
    @t transaction?: ApiTransaction;
    @t block?: ApiBlock;
    @t address?: ApiAddress;
}

export const MinerControllerInterface = ControllerSymbol<MinerControllerInterface>('miner/controller', [ApiBlock, ApiWallet, ApiTransaction, ApiAddress, ApiAddressResolved]);

export interface MinerControllerInterface {
    addTransaction(fromPrivateKey: Uint8Array, fromPublicKey: Uint8Array, to: string, amount: number): void;

    getTransactions(): Subject<ApiTransaction[]>;

    getBlocks(): ApiBlock[];

    createWallet(): ApiWallet;

    resolveAddress(address: string): ApiAddressResolved;
}
