import { ActorId, CommunicationProtocolEnum, DaprClient } from '@dapr/dapr';
import ActorClient from '@dapr/dapr/actors/client/ActorClient/ActorClient';
import Class from '@dapr/dapr/types/Class';
import { DaprClientOptions } from '@dapr/dapr/types/DaprClientOptions';

export class ActorProxyBuilder<T> {
  actorClient: ActorClient;
  actorTypeClass: Class<T>;

  constructor(actorTypeClass: Class<T>, daprClient: DaprClient);
  constructor(
    actorTypeClass: Class<T>,
    host: string,
    port: string,
    communicationProtocol: CommunicationProtocolEnum,
    clientOptions: DaprClientOptions,
  );
  constructor(actorTypeClass: Class<T>, ...args: any[]) {
    this.actorTypeClass = actorTypeClass;

    if (args.length == 1) {
      const [daprClient] = args;
      this.actorClient = new ActorClient(
        daprClient.options.daprHost,
        daprClient.options.daprPort,
        daprClient.options.communicationProtocol,
        daprClient.options,
      );
    } else {
      const [host, port, communicationProtocol, clientOptions] = args;
      this.actorClient = new ActorClient(
        host,
        port,
        communicationProtocol,
        clientOptions,
      );
    }
  }

  build(actorId: ActorId, actorTypeName?: string): T {
    const actorTypeClassName = actorTypeName ?? this.actorTypeClass.name;
    const actorClient = this.actorClient;

    const handler = {
      get(_target: any, propKey: any, _receiver: any) {
        return async function (...args: any) {
          const body = args.length > 0 ? args : null;
          const res = await actorClient.actor.invoke(
            actorTypeClassName,
            actorId,
            propKey,
            body,
          );
          return res;
        };
      },
    };

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy
    // we implement a handler that will take a method and forward it to the actor client
    const proxy = new Proxy(this.actorTypeClass, handler);

    // Return a NOT strongly typed API
    // @todo: this should return a strongly typed API as well, but requires reflection. How to do this in typescript?
    return proxy as unknown as T;
  }
}
