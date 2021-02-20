import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ControllerClient } from '../client';
import { ApiAddressResolved } from '@mycoin/miner-api';

@Component({
    template: `
        <div *ngIf="loading">Loading ...</div>
        <div *ngIf="!loading && resolved">
            <div *ngIf="resolved.transaction">
                <h3>Transaction</h3>
                <div class="text-selection">Hash: {{resolved.transaction.hash}}</div>
                <div>Block: <a routerLink="/address/{{resolved.transaction.block}}">{{resolved.transaction.block}}</a></div>

                <div class="transaction-input">
                    <h4>Input</h4>
                    <div *ngFor="let input of resolved.transaction.input; let i = index;">
                        {{i + 1}}. from transaction <a routerLink="/address/{{input.transaction}}">{{input.transaction}}</a><br/>
                        Script: <div class="text-selection script monospace">{{input.scriptSig}}</div>
                    </div>
                </div>

                <div class="transaction-output">
                    <h4>Output</h4>
                    <div *ngFor="let output of resolved.transaction.output; let i = index;">
                        {{i + 1}}. Amount: {{output.amount}}<br/>
                        Script: <div class="text-selection script monospace">{{output.scriptPubKey}}</div>
                    </div>
                </div>
            </div>
            <div *ngIf="resolved.block">
                <h3>Block</h3>
                <div class="text-selection">
                    <div>{{resolved.block.hash}}</div>
                    <div>Timestamp: {{resolved.block.timestamp|date:'short'}}</div>
                    <div>Height: {{resolved.block.height}}</div>
                </div>

                <h4>Transactions</h4>

                <div *ngFor="let t of resolved.block.transactions; let i = index">
                    {{i + 1}}. <a routerLink="/address/{{t.hash}}">{{t.hash}}</a> {{t.volume}}
                </div>

            </div>
            <div *ngIf="resolved.address">
                <h3>Address</h3>
                <div class="text-selection">
                    <div>Coin address: {{resolved.address.coinAddress}}</div>
                    <div>PubKeyHash: {{resolved.address.publicKeyHash}}</div>
                </div>

                <h4>Transactions</h4>
                <div *ngFor="let t of resolved.address.transactions; let i = index">
                    {{i + 1}}. <a routerLink="/address/{{t.hash}}">{{t.hash}}</a> {{t.volume}}
                </div>
            </div>
        </div>
    `,
    styleUrls: ['./address.component.scss']
})
export class AddressComponent implements OnInit {
    public loading = true;
    public resolved?: ApiAddressResolved;

    constructor(
        protected client: ControllerClient,
        protected activatedRoute: ActivatedRoute,
        protected cd: ChangeDetectorRef,
    ) {
    }

    ngOnInit(): void {
        this.activatedRoute.params.subscribe(params => {
            this.load(params.addr);
        });
    }

    async load(address: string) {
        this.loading = true;
        this.cd.detectChanges();

        try {
            this.resolved = await this.client.miner.resolveAddress(address);
        } finally {
            this.loading = false;
            this.cd.detectChanges();
        }
    }

}
