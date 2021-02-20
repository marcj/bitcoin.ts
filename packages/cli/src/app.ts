import 'reflect-metadata';
import { AppModule, CommandApplication } from '@deepkit/app';
import { ConsoleTransport, Logger } from '@deepkit/logger';
import { WalletCreateCommand } from './commands/wallet-create.command';

const app = new AppModule({
    providers: [
        { provide: Logger, useValue: new Logger([new ConsoleTransport()]) }
    ],
    controllers: [
        WalletCreateCommand
    ],
});

new CommandApplication(app).run();