import { SetMetadata } from '@nestjs/common';
import { DAPR_PUBSUB_METADATA } from './constants';

/**
 * `@DaprBinding` decorator metadata
 */
export interface DaprPubSubMetadata {
  /**
   * Name of pubsub component.
   */
  name: string;

  /**
   * Topic name to subscribe.
   */
  topicName: string;

  /**
   * Route to use.
   */
  route?: string;

  /**
   * Status to return on unhandled exception.
   */
  onError?: DaprPubSubMetadata;
}

/**
 * Dapr pubsub decorator.
 * Subscribes to Dapr pubsub topics.
 *
 * @param name name of pubsub component
 * @param topicName topic name to subscribe
 */
export const DaprPubSub = (
  name: string,
  topicName: string,
  route?: string,
  onError?: DaprPubSubMetadata,
): MethodDecorator =>
  SetMetadata(DAPR_PUBSUB_METADATA, {
    name,
    topicName,
    route,
    onError,
  } as DaprPubSubMetadata);
