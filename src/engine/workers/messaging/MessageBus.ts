// MessageBus - Event bus for agent coordination
// Handles pub/sub messaging between agents, workers, and main thread

import {
  AgentMessage,
  MessageType,
  MessageCallback,
  UnsubscribeFn,
  AgentId,
} from './types';

// Generate unique message IDs
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Message filter options
export interface MessageFilter {
  type?: MessageType | MessageType[];
  source?: AgentId | string;
  target?: AgentId | string | 'broadcast';
  correlationId?: string;
}

// Subscription record
interface Subscription {
  id: string;
  filter: MessageFilter;
  callback: MessageCallback;
}

// MessageBus options
export interface MessageBusOptions {
  maxHistorySize?: number;
  enableLogging?: boolean;
  logPrefix?: string;
}

// Default options
const DEFAULT_OPTIONS: Required<MessageBusOptions> = {
  maxHistorySize: 100,
  enableLogging: false,
  logPrefix: '[MessageBus]',
};

export class MessageBus {
  private subscriptions: Map<string, Subscription> = new Map();
  private messageHistory: AgentMessage[] = [];
  private options: Required<MessageBusOptions>;
  private pendingResponses: Map<string, {
    resolve: (value: AgentMessage) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = new Map();

  constructor(options?: MessageBusOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Subscribe to messages matching a filter
   */
  subscribe<T = unknown>(
    filter: MessageFilter,
    callback: MessageCallback<T>
  ): UnsubscribeFn {
    const subscriptionId = generateMessageId();

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      filter,
      callback: callback as MessageCallback,
    });

    this.log(`Subscribed: ${subscriptionId}`, filter);

    // Return unsubscribe function
    return () => {
      this.unsubscribe(subscriptionId);
    };
  }

  /**
   * Subscribe to a specific message type
   */
  on<T = unknown>(
    type: MessageType | MessageType[],
    callback: MessageCallback<T>
  ): UnsubscribeFn {
    return this.subscribe({ type }, callback);
  }

  /**
   * Subscribe to messages for a specific target
   */
  onTarget<T = unknown>(
    target: AgentId | string,
    callback: MessageCallback<T>
  ): UnsubscribeFn {
    return this.subscribe({ target }, callback);
  }

  /**
   * Subscribe once - unsubscribes after first matching message
   */
  once<T = unknown>(
    filter: MessageFilter,
    callback: MessageCallback<T>
  ): UnsubscribeFn {
    const unsubscribe = this.subscribe<T>(filter, (message) => {
      unsubscribe();
      callback(message);
    });
    return unsubscribe;
  }

  /**
   * Unsubscribe by subscription ID
   */
  unsubscribe(subscriptionId: string): boolean {
    const removed = this.subscriptions.delete(subscriptionId);
    if (removed) {
      this.log(`Unsubscribed: ${subscriptionId}`);
    }
    return removed;
  }

  /**
   * Publish a message to the bus
   */
  publish<T>(message: Omit<AgentMessage<T>, 'id' | 'timestamp'>): AgentMessage<T> {
    const fullMessage: AgentMessage<T> = {
      id: generateMessageId(),
      timestamp: Date.now(),
      ...message,
    };

    this.log(`Publishing:`, fullMessage.type, fullMessage);

    // Add to history
    this.addToHistory(fullMessage as AgentMessage);

    // Notify matching subscribers
    this.notifySubscribers(fullMessage as AgentMessage);

    // Check for pending response waiters
    if (fullMessage.correlationId) {
      const pending = this.pendingResponses.get(fullMessage.correlationId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingResponses.delete(fullMessage.correlationId);
        pending.resolve(fullMessage as AgentMessage);
      }
    }

    return fullMessage;
  }

  /**
   * Send a message and wait for a response
   */
  async request<TReq, TRes>(
    message: Omit<AgentMessage<TReq>, 'id' | 'timestamp'>,
    timeoutMs: number = 30000
  ): Promise<AgentMessage<TRes>> {
    const sentMessage = this.publish(message);
    const correlationId = sentMessage.id;

    return new Promise<AgentMessage<TRes>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingResponses.delete(correlationId);
        reject(new Error(`Request timeout after ${timeoutMs}ms for message type: ${message.type}`));
      }, timeoutMs);

      this.pendingResponses.set(correlationId, {
        resolve: resolve as (value: AgentMessage) => void,
        reject,
        timeout,
      });

      // Also subscribe for response with correlationId
      this.once<TRes>(
        { correlationId },
        (response) => {
          const pending = this.pendingResponses.get(correlationId);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingResponses.delete(correlationId);
            pending.resolve(response as AgentMessage);
          }
        }
      );
    });
  }

  /**
   * Reply to a message (sets correlationId to original message ID)
   */
  reply<T>(
    originalMessage: AgentMessage,
    response: Omit<AgentMessage<T>, 'id' | 'timestamp' | 'correlationId' | 'target'>
  ): AgentMessage<T> {
    return this.publish({
      ...response,
      target: originalMessage.source,
      correlationId: originalMessage.id,
    });
  }

  /**
   * Broadcast a message to all subscribers
   */
  broadcast<T>(
    type: MessageType,
    payload: T,
    source: AgentId | string
  ): AgentMessage<T> {
    return this.publish({
      type,
      payload,
      source,
      target: 'broadcast',
    });
  }

  /**
   * Get message history
   */
  getHistory(filter?: MessageFilter): AgentMessage[] {
    if (!filter) {
      return [...this.messageHistory];
    }
    return this.messageHistory.filter((msg) => this.matchesFilter(msg, filter));
  }

  /**
   * Clear message history
   */
  clearHistory(): void {
    this.messageHistory = [];
  }

  /**
   * Get all active subscriptions count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Clear all subscriptions
   */
  clearSubscriptions(): void {
    this.subscriptions.clear();
    this.log('All subscriptions cleared');
  }

  /**
   * Cancel all pending requests
   */
  cancelPendingRequests(): void {
    for (const [id, pending] of this.pendingResponses) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Request cancelled'));
    }
    this.pendingResponses.clear();
  }

  /**
   * Destroy the message bus
   */
  destroy(): void {
    this.cancelPendingRequests();
    this.clearSubscriptions();
    this.clearHistory();
  }

  // Notify all matching subscribers
  private notifySubscribers(message: AgentMessage): void {
    for (const subscription of this.subscriptions.values()) {
      if (this.matchesFilter(message, subscription.filter)) {
        try {
          subscription.callback(message);
        } catch (error) {
          console.error(
            `${this.options.logPrefix} Error in subscription callback:`,
            error
          );
        }
      }
    }
  }

  // Check if message matches filter
  private matchesFilter(message: AgentMessage, filter: MessageFilter): boolean {
    // Type filter
    if (filter.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type];
      if (!types.includes(message.type)) {
        return false;
      }
    }

    // Source filter
    if (filter.source && message.source !== filter.source) {
      return false;
    }

    // Target filter (also matches broadcast)
    if (filter.target) {
      if (message.target !== filter.target && message.target !== 'broadcast') {
        return false;
      }
    }

    // CorrelationId filter
    if (filter.correlationId && message.correlationId !== filter.correlationId) {
      return false;
    }

    return true;
  }

  // Add message to history with size limit
  private addToHistory(message: AgentMessage): void {
    this.messageHistory.push(message);

    // Trim history if needed
    if (this.messageHistory.length > this.options.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-this.options.maxHistorySize);
    }
  }

  // Logging helper
  private log(message: string, ...args: unknown[]): void {
    if (this.options.enableLogging) {
      console.log(`${this.options.logPrefix} ${message}`, ...args);
    }
  }
}

// Singleton instance for main thread
let mainBus: MessageBus | null = null;

export function getMessageBus(options?: MessageBusOptions): MessageBus {
  if (!mainBus) {
    mainBus = new MessageBus(options);
  }
  return mainBus;
}

export function resetMessageBus(): void {
  if (mainBus) {
    mainBus.destroy();
    mainBus = null;
  }
}

export default MessageBus;
