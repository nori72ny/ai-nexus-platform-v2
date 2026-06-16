/**
 * SSE Endpoint Handler
 * Express ミドルウェアとしてSSEエンドポイントを提供
 */

import type { Request, Response } from "express";
import { sseManager } from "./sseHandler";

/**
 * SSEエンドポイント: GET /api/sse/:clientId
 * クライアントがSSE接続を確立するエンドポイント
 */
export function setupSSEEndpoint(app: any) {
  app.get("/api/sse/:clientId", (req: Request, res: Response) => {
    const { clientId } = req.params;

    if (!clientId) {
      res.status(400).json({ error: "clientId is required" });
      return;
    }

    // SSEクライアントを登録
    sseManager.registerClient(clientId, res);

    // クライアント接続時のログ
    console.log(`[SSE] Client connected: ${clientId}`);

    // クライアント切断時のログ
    req.on("close", () => {
      console.log(`[SSE] Client disconnected: ${clientId}`);
      sseManager.disconnectClient(clientId);
    });
  });
}
