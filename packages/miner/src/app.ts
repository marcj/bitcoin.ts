import 'reflect-metadata';
import { AppModule } from '@deepkit/app';
import { Application, KernelModule, onServerMainBootstrap } from '@deepkit/framework';
import { eventDispatcher } from '@deepkit/event';
import { MinerController } from './rpc/controller';
import { appConfig } from './app.config';
import { MainBlockchain, MinerWallet, TransactionPool } from './state';
import { Mine } from './mine';
import { injectable } from '@deepkit/injector';

@injectable()
class BootstrapListener {
    constructor(protected mine: Mine) {
    }

    @eventDispatcher.listen(onServerMainBootstrap)
    bootstrap() {
        this.mine.start();
    }
}

const app = new AppModule({
    config: appConfig,
    controllers: [MinerController],
    providers: [
        Mine,
        MinerWallet,
        TransactionPool,
        MainBlockchain,
    ],
    listeners: [
        BootstrapListener
    ],
    imports: [
        KernelModule.configure({
            debug: true, httpLog: true, workers: 1,
        })
    ],
}).setup(((module, config) => {
}));

new Application(app).loadConfigFromEnvVariables('APP_').run();
