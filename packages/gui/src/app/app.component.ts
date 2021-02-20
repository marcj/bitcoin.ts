import { ChangeDetectorRef, Component } from '@angular/core';
import { ControllerClient } from './client';
import { Wallets } from './wallets';
import { DuiDialog } from '@deepkit/desktop-ui/src/components/dialog/dialog';
import { SendMoneyComponent } from './dialog/send-money.component';

@Component({
    selector: 'app-root',
    template: `
        <dui-window>
            <dui-window-header size="small">
                <dui-window-toolbar>
                    <dui-button-group padding="none">
                        <dui-button textured (click)="sendMoney()">Send $</dui-button>
                        <!--                    <dui-button>Receive $</dui-button>-->
                    </dui-button-group>
                </dui-window-toolbar>
            </dui-window-header>
            <dui-window-content>
                <dui-window-sidebar>
                    <dui-list>
                        <dui-list-title>Overview</dui-list-title>
                        <dui-list-item routerLink="/transactions">Transactions</dui-list-item>
                        <dui-list-item routerLink="/blockchain">Blockchain</dui-list-item>
                        <dui-list-title>Wallets</dui-list-title>
                        <dui-list-item
                            *ngFor="let wallet of wallets.wallets;"
                            routerLink="/address/{{wallet.address}}">{{wallet.address|slice:0:12}}</dui-list-item>
                        <dui-list-title>
                            <dui-button textured (click)="createWallet()">Create wallet</dui-button>
                        </dui-list-title>
                    </dui-list>
                </dui-window-sidebar>
                <router-outlet></router-outlet>
            </dui-window-content>
        </dui-window>
    `,
    styleUrls: ['./app.component.scss']
})
export class AppComponent {
    constructor(
        protected client: ControllerClient,
        protected cd: ChangeDetectorRef,
        protected dialog: DuiDialog,
        public wallets: Wallets,
    ) {
    }

    sendMoney(): void {
        this.dialog.open(SendMoneyComponent);
    }

    async createWallet(): Promise<void> {
        const wallet = await this.client.miner.createWallet();
        this.wallets.add(wallet);
        this.cd.detectChanges();
    }
}
