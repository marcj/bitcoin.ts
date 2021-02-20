import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ApiTransaction } from '@mycoin/miner-api';
import { ControllerClient } from '../client';
import { Subject } from 'rxjs';
import { Router } from '@angular/router';

@Component({
    template: `
        <div class="header">
            <div>Chain Height: 32</div>
            <div>Last Block: 0224f694c55a9</div>
            <div>Last block time: 234ms</div>
        </div>
        <div class="search">
            <dui-input round icon="search" (enter)="go()" [(ngModel)]="search" semiTransparent lightFocus placeholder="address, block, transaction, ..."></dui-input>
        </div>
        <div class="graphs">
            <div></div>
            <div></div>
        </div>
        <div class="transactions">
            <h3>Transactions</h3>
            <dui-table [items]="transactions" noFocusOutline borderless>
                <dui-table-column name="timestamp" header="Time" [width]="130">
                    <ng-container *duiTableCell="let row">
                        {{row.timestamp*1000|date:'short'}}
                    </ng-container>c
                </dui-table-column>
                <dui-table-column name="hash" header="Tranaction hash" [width]="250">
                    <ng-container *duiTableCell="let row">
                        <a routerLink="/address/{{row.hash}}">{{row.hash}}</a>
                    </ng-container>
                </dui-table-column>
                <dui-table-column name="from" header="From" [width]="330">
                    <ng-container *duiTableCell="let row">
                        <ng-container *ngIf="row.from.length === 0">
                            Block reward
                        </ng-container>
                        <a *ngFor="let item of row.from" routerLink="/address/{{item}}">{{item}}</a>
                    </ng-container>
                </dui-table-column>
                <dui-table-column name="to" header="To" [width]="330">
                    <ng-container *duiTableCell="let row">
                        <a *ngFor="let item of row.to" routerLink="/address/{{item}}">{{item}}</a>
                    </ng-container>
                </dui-table-column>
                <dui-table-column name="volume" header="Volume">
                    <ng-container *duiTableCell="let row">
                        {{row.volume/1000000}}
                    </ng-container>
                </dui-table-column>
            </dui-table>
        </div>
    `,
    styleUrls: ['./transactions.component.scss']
})
export class TransactionsComponent implements OnInit, OnDestroy {
    public transactions: ApiTransaction[] = [];
    protected subject?: Subject<ApiTransaction[]>;

    public search: string = '';

    constructor(
        protected client: ControllerClient,
        protected cd: ChangeDetectorRef,
        protected router: Router,
    ) {
    }

    go() {
        this.router.navigate(['/address', this.search]);
    }

    ngOnDestroy(): void {
        this.subject?.unsubscribe();
    }

    async ngOnInit() {
        this.subject = await this.client.miner.getTransactions();
        this.subject.subscribe((transactions) => {
            this.transactions.unshift(...transactions);
            this.transactions = this.transactions.slice();
            this.cd.detectChanges();
        });
    }
}
