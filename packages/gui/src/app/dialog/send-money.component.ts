import { ChangeDetectorRef, Component } from '@angular/core';
import { ApiWallet } from '@mycoin/miner-api';
import { Wallets } from '../wallets';
import { ControllerClient } from '../client';
import { DialogComponent } from '@deepkit/desktop-ui/src/components/dialog/dialog.component';
import { DuiDialog } from '@deepkit/desktop-ui/src/components/dialog/dialog';

@Component({
    template: `
        <h3>Send money</h3>

        <dui-form>
            <dui-form-row label="Wallet">
                <dui-select [(ngModel)]="model.wallet">
                    <dui-option [value]="genesis">Genesis</dui-option>
                    <dui-option *ngFor="let wallet of wallets.wallets" [value]="wallet">{{wallet.address|slice:0:12}}</dui-option>
                </dui-select>
            </dui-form-row>

            <dui-form-row label="Receiver">
                <dui-button-group padding="none" style="width: 225px">
                    <dui-input style="width: 100%;" [(ngModel)]="model.receiver" placeholder="Address ..."></dui-input>
                    <dui-dropdown #drop>
                        <dui-dropdown-item *ngFor="let wallet of wallets.wallets" (click)="model.receiver = wallet.address">{{wallet.address|slice:0:12}}</dui-dropdown-item>
                    </dui-dropdown>
                    <dui-button tight icon="arrow-down" [disabled]="!wallets.wallets.length" [openDropdown]="drop"></dui-button>
                </dui-button-group>
            </dui-form-row>

            <dui-form-row label="Amount">
                <dui-input type="number" [(ngModel)]="model.amount"></dui-input>
            </dui-form-row>

        </dui-form>

        <dui-dialog-actions>
            <dui-button closeDialog>Abort</dui-button>
            <dui-button (click)="send()" [disabled]="sending">Send</dui-button>
        </dui-dialog-actions>
    `,
    styles: [`
        :host {
            display: block;
            padding-top: 20px;
        }
    `]
})
export class SendMoneyComponent {
    static dialogDefaults = {
        minWidth: 450,
        minHeight: 250,
    };

    genesis = new ApiWallet(new Uint8Array(0), new Uint8Array(0));

    model: { wallet?: ApiWallet, amount: number, receiver: string };

    sending = false;

    constructor(
        protected client: ControllerClient,
        protected dialogComponent: DialogComponent,
        protected dialog: DuiDialog,
        protected cd: ChangeDetectorRef,
        public wallets: Wallets,
    ) {
        this.model = {
            wallet: this.genesis,
            amount: 10,
            receiver: ''
        };
    }

    async send() {
        if (!this.model.wallet) return;
        if (!this.model.receiver.length) return;
        if (this.model.amount <= 0) return;

        this.sending = true;
        this.cd.detectChanges();

        try {
            await this.client.miner.addTransaction(this.model.wallet.privateKey, this.model.wallet.publicKey, this.model.receiver, this.model.amount);

            this.dialogComponent.close();
        } catch (error) {
            this.dialog.alert('Error sending money', error);
        } finally {
            this.sending = false;
            this.cd.detectChanges();
        }
    }
}
