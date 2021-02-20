import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ControllerClient } from './client';
import { DeepkitClient } from '@deepkit/rpc';
import { DuiAppModule, DuiButtonModule, DuiCheckboxModule, DuiDialogModule, DuiFormComponent, DuiIconModule, DuiInputModule, DuiListModule, DuiRadioboxModule, DuiSelectModule, DuiTableModule, DuiWindowModule } from '@deepkit/desktop-ui';
import { OverlayModule } from '@angular/cdk/overlay';
import { TransactionsComponent } from './views/transactions.component';
import { Wallets } from './wallets';
import { AddressComponent } from './views/address.component';
import { SendMoneyComponent } from './dialog/send-money.component';
import { FormsModule } from '@angular/forms';
import { BlockchainComponent } from './views/blockchain.component';

@NgModule({
    declarations: [
        AppComponent,
        TransactionsComponent,
        AddressComponent,
        SendMoneyComponent,
        BlockchainComponent,
    ],
    imports: [
        BrowserModule,
        AppRoutingModule,
        FormsModule,

        DuiAppModule.forRoot(),
        DuiWindowModule.forRoot(),
        OverlayModule,
        DuiDialogModule,
        DuiCheckboxModule,
        DuiButtonModule,
        DuiInputModule,
        DuiFormComponent,
        DuiRadioboxModule,
        DuiSelectModule,
        DuiIconModule,
        DuiListModule,
        DuiTableModule,
    ],
    providers: [
        ControllerClient,
        Wallets,
        { provide: DeepkitClient, useFactory: () => new DeepkitClient('ws://' + ControllerClient.getServerHost()) },
    ],
    bootstrap: [AppComponent]
})
export class AppModule {
    constructor(wallets: Wallets) {
        wallets.restore();
    }
}
