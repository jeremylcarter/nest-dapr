import { CommunicationProtocolEnum, DaprClient, DaprPubSubStatusEnum, DaprServer } from '@dapr/dapr';
import { DaprClientOptions } from '@dapr/dapr/types/DaprClientOptions';
import { DynamicModule, Module, ModuleMetadata, Provider, Scope, Type } from '@nestjs/common';
import { DiscoveryModule, Reflector } from '@nestjs/core';
import { ClsModule } from 'nestjs-cls';
import { ActorRuntimeService } from './actors/actor-runtime.service';
import { DaprActorClient } from './actors/dapr-actor-client.service';
import { NestActorManager } from './actors/nest-actor-manager';
import { DaprContextService } from './dapr-context-service';
import { DaprEventEmitter } from './dapr-event-emitter.service';
import { DaprEventSubscriberLoader } from './dapr-event-subscriber.loader';
import { DaprMetadataAccessor } from './dapr-metadata.accessor';
import { DaprLoader } from './dapr.loader';
import { DaprPubSubClient } from './pubsub/dapr-pubsub-client.service';

export const DAPR_MODULE_OPTIONS_TOKEN = 'DAPR_MODULE_OPTIONS_TOKEN';

export interface DaprModuleOptions {
  serverHost?: string;
  serverPort?: string;
  communicationProtocol?: CommunicationProtocolEnum;
  clientOptions?: DaprClientOptions;
  actorOptions?: DaprModuleActorOptions;
  pubsubOptions?: DaprModulePubSubOptions;
  disabled?: boolean;
  contextProvider?: DaprContextProvider;
  logging?: DaprModuleLoggingOptions;
  catchErrors?: boolean;
}

export interface DaprModuleLoggingOptions {
  enabled: boolean;
}

export interface DaprModuleActorOptions {
  prefix?: string;
  delimiter?: string;
  typeNamePrefix?: string;
  allowInternalCalls?: boolean; // Allow actors to call internally within the same process
}

export interface DaprModulePubSubOptions {
  defaultName?: string;
  onError?: (name: string, topicName: string, error: any) => DaprPubSubStatusEnum;
}

export enum DaprContextProvider {
  None = 'none',
  ALS = 'als',
  NestCLS = 'nest-cls',
}

export interface DaprModuleOptionsFactory {
  createDaprModuleOptions(): Promise<DaprModuleOptions> | DaprModuleOptions;
}

export function createOptionsProvider(options: DaprModuleOptions): any {
  // Setup default options for actor clients if not provided.
  // Reentrancy is enabled by default, with a max stack depth of 6 calls.
  // See https://docs.dapr.io/developing-applications/building-blocks/actors/actors-runtime-config/
  if (!options.clientOptions.actor) {
    options.clientOptions.actor = {
      reentrancy: {
        enabled: true,
        maxStackDepth: 6,
      },
      actorIdleTimeout: '15m',
      actorScanInterval: '1m',
    };
  }
  return { provide: DAPR_MODULE_OPTIONS_TOKEN, useValue: options || {} };
}

export interface DaprModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<DaprModuleOptionsFactory>;
  useClass?: Type<DaprModuleOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<DaprModuleOptions> | DaprModuleOptions;
  inject?: any[];
  extraProviders?: Provider[];
}

@Module({
  imports: [ClsModule, DiscoveryModule],
  providers: [DaprActorClient, NestActorManager, DaprContextService, DaprEventSubscriberLoader, ActorRuntimeService],
  exports: [DaprActorClient, DaprContextService, DaprEventSubscriberLoader, ActorRuntimeService],
})
export class DaprModule {
  static register(options?: DaprModuleOptions): DynamicModule {
    return {
      global: true,
      module: DaprModule,
      imports: [DiscoveryModule, ClsModule],
      providers: [
        createOptionsProvider(options),
        {
          provide: DaprServer,
          scope: Scope.DEFAULT,
          useValue: new DaprServer({
            serverHost: options.serverHost,
            serverPort: options.serverPort,
            clientOptions: options.clientOptions,
            communicationProtocol: options.communicationProtocol,
          }),
        },
        {
          provide: DaprClient,
          scope: Scope.DEFAULT,
          useFactory: (daprServer: DaprServer) => daprServer.client,
          inject: [DaprServer],
        },
        DaprLoader,
        DaprMetadataAccessor,
        DaprEventSubscriberLoader,
        DaprContextService,
        DaprActorClient,
        DaprPubSubClient,
        DaprEventEmitter,
        Reflector,
      ],
      exports: [
        DaprClient,
        DaprPubSubClient,
        DaprContextService,
        ActorRuntimeService,
        DaprActorClient,
        DaprEventSubscriberLoader,
        DaprEventEmitter,
      ],
    };
  }

  static registerAsync(options: DaprModuleAsyncOptions): DynamicModule {
    return {
      global: true,
      module: DaprModule,
      imports: [...options.imports, DiscoveryModule],
      providers: [
        ...this.createAsyncProviders(options),
        {
          provide: DaprServer,
          scope: Scope.DEFAULT,
          useFactory: ({ serverHost, serverPort, communicationProtocol, clientOptions }: DaprModuleOptions) =>
            new DaprServer({
              serverHost,
              serverPort,
              clientOptions,
              communicationProtocol,
            }),
          inject: [DAPR_MODULE_OPTIONS_TOKEN],
        },
        {
          provide: DaprClient,
          scope: Scope.DEFAULT,
          useFactory: (daprServer: DaprServer) => daprServer.client,
          inject: [DaprServer],
        },
        DaprLoader,
        DaprMetadataAccessor,
        DaprEventSubscriberLoader,
        DaprContextService,
        DaprActorClient,
        DaprPubSubClient,
        DaprEventEmitter,
        Reflector,
        ...(options.extraProviders || []),
      ],
      exports: [
        DaprClient,
        DaprPubSubClient,
        DaprContextService,
        ActorRuntimeService,
        DaprActorClient,
        DaprEventSubscriberLoader,
        DaprEventEmitter,
      ],
    };
  }

  private static createAsyncProviders(options: DaprModuleAsyncOptions): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options)];
    }
    return [
      this.createAsyncOptionsProvider(options),
      {
        provide: options.useClass,
        useClass: options.useClass,
      },
    ];
  }

  private static createAsyncOptionsProvider(options: DaprModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: DAPR_MODULE_OPTIONS_TOKEN,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }
    return {
      provide: DAPR_MODULE_OPTIONS_TOKEN,
      useFactory: async (optionsFactory: DaprModuleOptionsFactory) => optionsFactory.createDaprModuleOptions(),
      inject: [options.useExisting || options.useClass],
    };
  }
}
