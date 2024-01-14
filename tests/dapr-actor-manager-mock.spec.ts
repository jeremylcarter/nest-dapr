import { Test, TestingModule } from '@nestjs/testing';
import { TestModule } from './e2e/test.module';
import { DaprClient, DaprServer } from '@dapr/dapr';
import { INestApplication } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { DaprActorClient } from '../lib/actors/dapr-actor-client.service';
import { DaprContextService } from '../lib';
import { itWithContext, sleep } from './test.utils';
import { StatelessCounterActorInterface } from './src/stateless-counter.actor';

// To run inside Dapr use:
// dapr run --app-id nest-dapr-test --dapr-http-port 3500 --app-port 3001 --log-level debug -- npm run test
describe('DaprActorContext', () => {
  let testingModule: TestingModule;
  let app: INestApplication;
  let contextService: ClsService;
  let daprServer: DaprServer;
  let daprClient: DaprClient;
  let daprActorClient: DaprActorClient;
  let daprContextService: DaprContextService;

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();
    app = testingModule.createNestApplication();
    await app.init();
    await app.listen(3000);
    daprServer = app.get<DaprServer>(DaprServer);
    contextService = app.get<ClsService>(ClsService);
    daprClient = testingModule.get(DaprClient);
    daprActorClient = testingModule.get(DaprActorClient);
    daprContextService = testingModule.get(DaprContextService);

    expect(contextService).toBeDefined();
    expect(daprClient).toBeDefined();
    expect(daprActorClient).toBeDefined();
    expect(daprContextService).toBeDefined();
  });

  describe('callContextAwareActor', () => {
    itWithContext('should call a context aware actor', contextService, async () => {
      daprContextService.setCorrelationIdIfNotDefined();
      let context = {
        correlationID: daprContextService.getCorrelationId(),
        userID: 'user-1',
        tenantID: 'tenant-1',
      };
      daprContextService.set(context);
      expect(daprContextService.get()).toBe(context);

      const actor = daprActorClient.getActor(StatelessCounterActorInterface, 'stateless-2');

      const initialValue = await actor.getCounter();
      expect(initialValue).toBeDefined();

      await actor.increment();
      const value = await actor.getCounter();
      expect(value).toBe(initialValue + 1);
    });
  });

  afterAll(async () => {
    await daprClient?.stop();
    await app.close();
    await app.getHttpServer().close();
    await daprServer.stop();
    await testingModule.close();
  });
});
