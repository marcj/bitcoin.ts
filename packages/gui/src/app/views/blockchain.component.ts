import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ApiBlock } from '@mycoin/miner-api';
import { ControllerClient } from '../client';

@Component({
    template: `
        <div class="blocks" *ngIf="blocks">
            <div class="block" *ngFor="let block of blocks; let i = index">
                <h4>Block {{blocks.length - i}}</h4>
                <a routerLink="/address/{{block.hash}}">{{block.hash}}</a>
                <div>
                    {{block.transactions.length}} transactions.
                </div>
            </div>
        </div>
    `,
    styleUrls: ['./blockchain.component.scss']
})
export class BlockchainComponent implements OnInit {
    public blocks?: ApiBlock[];

    constructor(
        protected client: ControllerClient,
        protected cd: ChangeDetectorRef,
    ) {

    }

    async ngOnInit() {
        this.blocks = await this.client.miner.getBlocks();
        this.blocks.reverse();
        this.cd.detectChanges();
    }
}
