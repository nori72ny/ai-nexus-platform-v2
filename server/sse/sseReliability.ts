import { Request, Response } from 'express';

/**
 * SSE event interface
 */
export interface SSEEvent {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  retryAfter?: number;
}

/**
 * SSE client interface
 */
interface SSEClient {
  id: string;
  response: Response;
  lastEventId: string;
  connectedAt: number;
}

/**
 * SSE reliability service
 */
export class SSEReliabilityService {
  private clients = new Map<string, SSEClient>();
  private eventHistory = new Map<string, SSEEvent[]>();
  private eventCounter = 0;
  private deduplicationCache = new Map<string, number>();

  constructor() {
    this.startCleanup();
  }

  /**
   * Register SSE client
   */
  registerClient(clientId: string, res: Response, lastEventId?: string): void {
    const client: SSEClient = {
      id: clientId,
      response: res,
      lastEventId: lastEventId || '0',
      connectedAt: Date.now(),
    };

    this.clients.set(clientId, client);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Send initial connection message
    this.sendEvent(clientId, {
      id: this.generateEventId(),
      type: 'connection',
      data: { message: 'Connected to SSE server' },
      timestamp: Date.now(),
    });

    // Send heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      if (!this.clients.has(clientId)) {
        clearInterval(heartbeatInterval);
        return;
      }

      this.sendEvent(clientId, {
        id: this.generateEventId(),
        type: 'heartbeat',
        data: { timestamp: Date.now() },
        timestamp: Date.now(),
      });
    }, 30 * 1000);

    // Handle client disconnect
    res.on('close', () => {
      clearInterval(heartbeatInterval);
      this.clients.delete(clientId);
      console.log(`[SSE] Client ${clientId} disconnected`);
    });

    console.log(`[SSE] Client ${clientId} registered (lastEventId: ${lastEventId})`);
  }

  /**
   * Send event to specific client
   */
  sendEvent(clientId: string, event: SSEEvent): void {
    const client = this.clients.get(clientId);

    if (!client) {
      console.warn(`[SSE] Client ${clientId} not found`);
      return;
    }

    try {
      // Check for deduplication
      if (this.isDuplicate(event)) {
        console.log(`[SSE] Duplicate event detected: ${event.id}`);
        return;
      }

      // Store event in history
      this.storeEvent(event);

      // Format SSE message
      const message = this.formatSSEMessage(event);

      // Send to client
      client.response.write(message);
      client.lastEventId = event.id;

      console.log(`[SSE] Event sent to ${clientId}: ${event.type}`);
    } catch (error) {
      console.error(`[SSE] Failed to send event to ${clientId}:`, error);
      this.clients.delete(clientId);
    }
  }

  /**
   * Broadcast event to all clients
   */
  broadcastEvent(event: SSEEvent): void {
    this.clients.forEach((client, clientId) => {
      this.sendEvent(clientId, event);
    });
  }

  /**
   * Replay events to client after reconnection
   */
  replayEvents(clientId: string, fromEventId: string): void {
    const client = this.clients.get(clientId);

    if (!client) {
      console.warn(`[SSE] Client ${clientId} not found`);
      return;
    }

    console.log(`[SSE] Replaying events for ${clientId} from ${fromEventId}`);

    // Find all events after lastEventId
    const fromEventIdNum = parseInt(fromEventId, 10) || 0;
    let eventsSent = 0;

    this.eventHistory.forEach((events) => {
      events.forEach(event => {
        const eventIdNum = parseInt(event.id, 10);

        if (eventIdNum > fromEventIdNum) {
          this.sendEvent(clientId, event);
          eventsSent++;
        }
      });
    });

    console.log(`[SSE] Replayed ${eventsSent} events to ${clientId}`);
  }

  /**
   * Check if event is duplicate
   */
  private isDuplicate(event: SSEEvent): boolean {
    const key = `${event.type}:${JSON.stringify(event.data)}`;
    const lastTime = this.deduplicationCache.get(key);

    if (lastTime && Date.now() - lastTime < 1000) {
      return true;
    }

    this.deduplicationCache.set(key, Date.now());
    return false;
  }

  /**
   * Store event in history
   */
  private storeEvent(event: SSEEvent): void {
    const key = event.type;

    if (!this.eventHistory.has(key)) {
      this.eventHistory.set(key, []);
    }

    const events = this.eventHistory.get(key)!;
    events.push(event);

    // Keep only last 1000 events per type
    if (events.length > 1000) {
      events.shift();
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return (++this.eventCounter).toString();
  }

  /**
   * Format message as SSE
   */
  private formatSSEMessage(event: SSEEvent): string {
    let message = '';

    if (event.id) {
      message += `id: ${event.id}\n`;
    }

    if (event.type) {
      message += `event: ${event.type}\n`;
    }

    if (event.data) {
      const dataStr = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
      message += `data: ${dataStr}\n`;
    }

    if (event.retryAfter) {
      message += `retry: ${event.retryAfter}\n`;
    }

    message += '\n';

    return message;
  }

  /**
   * Get client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get event history for type
   */
  getEventHistory(type: string): SSEEvent[] {
    return this.eventHistory.get(type) || [];
  }

  /**
   * Clear event history
   */
  clearEventHistory(type?: string): void {
    if (type) {
      this.eventHistory.delete(type);
    } else {
      this.eventHistory.clear();
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      // Clean up deduplication cache
      const keysToDelete: string[] = [];
      this.deduplicationCache.forEach((time, key) => {
        if (now - time > 60 * 1000) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach(key => {
        this.deduplicationCache.delete(key);
      });

      console.log(`[SSE] Cleanup: removed ${keysToDelete.length} dedup entries`);
    }, 60 * 1000); // Cleanup every minute
  }

  /**
   * Get SSE status
   */
  getStatus(): {
    clientCount: number;
    eventHistorySize: number;
    deduplicationCacheSize: number;
  } {
    return {
      clientCount: this.clients.size,
      eventHistorySize: Array.from(this.eventHistory.values()).reduce((sum, events) => sum + events.length, 0),
      deduplicationCacheSize: this.deduplicationCache.size,
    };
  }
}

/**
 * Global SSE reliability service
 */
export const sseReliabilityService = new SSEReliabilityService();

/**
 * SSE middleware for handling connections
 */
export function sseMiddleware(req: Request, res: Response): void {
  const clientId = req.query.clientId as string || `client-${Date.now()}`;
  const lastEventId = req.headers['last-event-id'] as string;

  console.log(`[SSE] New connection: ${clientId}, lastEventId: ${lastEventId}`);

  // Register client
  sseReliabilityService.registerClient(clientId, res, lastEventId);

  // Replay events if client has lastEventId
  if (lastEventId) {
    sseReliabilityService.replayEvents(clientId, lastEventId);
  }
}
