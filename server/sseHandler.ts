/**
 * SSE (Server-Sent Events) Handler
 * リアルタイム進捗ストリーミング表示用
 */

import type { Response } from "express";

export interface SSEEvent {
  type: "progress" | "ai_result" | "fact_check" | "report" | "error" | "complete";
  service?: string;
  message: string;
  data?: any;
  timestamp: number;
}

export class SSEManager {
  private clients: Map<string, Response> = new Map();

  /**
   * SSEクライアントを登録
   */
  registerClient(clientId: string, res: Response): void {
    // SSEヘッダーを設定
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    this.clients.set(clientId, res);

    // クライアント接続時のハートビート
    res.write(": connected\n\n");

    // クライアント切断時の処理
    res.on("close", () => {
      this.clients.delete(clientId);
    });

    res.on("error", () => {
      this.clients.delete(clientId);
    });
  }

  /**
   * イベントを送信
   */
  sendEvent(clientId: string, event: SSEEvent): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const eventData = `data: ${JSON.stringify(event)}\n\n`;
    client.write(eventData);
  }

  /**
   * 全クライアントにイベントをブロードキャスト
   */
  broadcastEvent(event: SSEEvent): void {
    this.clients.forEach((client) => {
      const eventData = `data: ${JSON.stringify(event)}\n\n`;
      client.write(eventData);
    });
  }

  /**
   * クライアントを切断
   */
  disconnectClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.end();
      this.clients.delete(clientId);
    }
  }

  /**
   * 全クライアントを切断
   */
  disconnectAll(): void {
    this.clients.forEach((client) => {
      client.end();
    });
    this.clients.clear();
  }

  /**
   * アクティブなクライアント数を取得
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

// グローバルSSEマネージャーインスタンス
export const sseManager = new SSEManager();

/**
 * 進捗イベント生成ヘルパー
 */
export function createProgressEvent(service: string, status: string): SSEEvent {
  return {
    type: "progress",
    service,
    message: `${service} is ${status}`,
    timestamp: Date.now(),
  };
}

/**
 * AI結果イベント生成ヘルパー
 */
export function createAIResultEvent(service: string, result: string, processingTime: number): SSEEvent {
  return {
    type: "ai_result",
    service,
    message: `${service} completed in ${processingTime}ms`,
    data: { result, processingTime },
    timestamp: Date.now(),
  };
}

/**
 * ファクトチェックイベント生成ヘルパー
 */
export function createFactCheckEvent(agreement: number, commonPoints: string[], differences: string[]): SSEEvent {
  return {
    type: "fact_check",
    message: `Fact check completed with ${agreement}% agreement`,
    data: { agreement, commonPoints, differences },
    timestamp: Date.now(),
  };
}

/**
 * レポート生成イベント生成ヘルパー
 */
export function createReportEvent(reportId: number, sections: Record<string, string>): SSEEvent {
  return {
    type: "report",
    message: `Report ${reportId} generated successfully`,
    data: { reportId, sections },
    timestamp: Date.now(),
  };
}

/**
 * エラーイベント生成ヘルパー
 */
export function createErrorEvent(message: string, error?: any): SSEEvent {
  return {
    type: "error",
    message,
    data: { error: error instanceof Error ? error.message : String(error) },
    timestamp: Date.now(),
  };
}

/**
 * 完了イベント生成ヘルパー
 */
export function createCompleteEvent(reportId: number): SSEEvent {
  return {
    type: "complete",
    message: `Report generation completed`,
    data: { reportId },
    timestamp: Date.now(),
  };
}
