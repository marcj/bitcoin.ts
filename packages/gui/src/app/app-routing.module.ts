import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TransactionsComponent } from './views/transactions.component';
import { BlockchainComponent } from './views/blockchain.component';
import { AddressComponent } from './views/address.component';

const routes: Routes = [
    { path: '', pathMatch: 'full', redirectTo: 'transactions' },
    { path: 'transactions', component: TransactionsComponent },
    { path: 'blockchain', component: BlockchainComponent },
    { path: 'address/:addr', component: AddressComponent },
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})
export class AppRoutingModule {
}
