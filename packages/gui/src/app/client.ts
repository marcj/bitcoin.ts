import { Injectable } from '@angular/core';
import { DeepkitClient } from '@deepkit/rpc';
import { MinerControllerInterface } from '@mycoin/miner-api';

@Injectable()
export class ControllerClient {
  constructor(protected client: DeepkitClient) {
  }

  public readonly miner = this.client.controller(MinerControllerInterface);

  static getServerHost(): string {
    return (location.port === '4200' ? location.hostname + ':8080' : location.host);
  }
}
