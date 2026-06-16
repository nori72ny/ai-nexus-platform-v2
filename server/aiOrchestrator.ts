/**
 * AI Orchestration Engine
 * タスク内容から最適なAIを自動ルーティングし、複数AIを並列実行して結果を統合する
 */

import { invokeLLM } from "./_core/llm";

export type AIService = "chatgpt" | "gemini" | "perplexity" | "genspark" | "manus";

interface AIResult {
  service: AIService;
  result: string;
  processingTime: number;
  confidence: number;
  status: "success" | "failed";
  error?: string;
}

interface RoutingDecision {
  selectedAIs: AIService[];
  reason: string;
}

interface FactCheckResult {
  agreement: number;
  commonPoints: string[];
  differences: string[];
  confidenceScores: Record<AIService, number>;
}

/**
 * AIルーティング戦略
 * タスク内容を分析して、最適なAIサービスを選択
 */
export async function routeTask(taskDescription: string): Promise<RoutingDecision> {
  const routingPrompt = `You are an AI routing expert. Analyze the following task and determine which AI services would be most suitable to handle it.

Task: ${taskDescription}

Available AI services:
- ChatGPT: Best for text generation, writing, summarization, creative tasks
- Gemini: Best for data analysis, numerical processing, Google-related queries
- Perplexity: Best for latest information, market research, news analysis
- Genspark: Best for web research, comparative analysis
- Manus: Best for complex, long-running tasks, multi-step reasoning

Respond in JSON format:
{
  "selectedAIs": ["service1", "service2", ...],
  "reason": "explanation of why these services were selected"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an expert at routing tasks to the most appropriate AI services. Always respond with valid JSON.",
        },
        {
          role: "user",
          content: routingPrompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "routing_decision",
          strict: true,
          schema: {
            type: "object",
            properties: {
              selectedAIs: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["chatgpt", "gemini", "perplexity", "genspark", "manus"],
                },
              },
              reason: {
                type: "string",
              },
            },
            required: ["selectedAIs", "reason"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message.content;
    if (!content) throw new Error("No response from LLM");

    const contentStr = typeof content === "string" ? content : JSON.stringify(content);
    const parsed = JSON.parse(contentStr);
    return {
      selectedAIs: parsed.selectedAIs as AIService[],
      reason: parsed.reason,
    };
  } catch (error) {
    console.error("Routing error:", error);
    return {
      selectedAIs: ["chatgpt", "gemini", "perplexity"],
      reason: "Default routing due to routing error",
    };
  }
}

/**
 * 複数AIを並列実行
 */
export async function executeMultipleAIs(
  taskDescription: string,
  selectedAIs: AIService[],
  onProgress?: (service: AIService, status: string) => void
): Promise<AIResult[]> {
  const results: AIResult[] = [];

  const executionPromises = selectedAIs.map(async (service) => {
    const startTime = Date.now();
    onProgress?.(service, "starting");

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a ${service} AI assistant. Provide a comprehensive analysis of the following task.`,
          },
          {
            role: "user",
            content: taskDescription,
          },
        ],
      });

      const processingTime = Date.now() - startTime;
      const content = response.choices[0]?.message.content;
      const result = typeof content === "string" ? content : JSON.stringify(content);

      onProgress?.(service, "completed");

      return {
        service,
        result,
        processingTime,
        confidence: 0.85,
        status: "success" as const,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      onProgress?.(service, "failed");

      return {
        service,
        result: "",
        processingTime,
        confidence: 0,
        status: "failed" as const,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  const executedResults = await Promise.all(executionPromises);
  results.push(...executedResults);

  return results;
}

/**
 * ファクトチェック: 複数AI結果の比較・検証
 */
export async function performFactCheck(aiResults: AIResult[]): Promise<FactCheckResult> {
  const successResults = aiResults.filter((r) => r.status === "success");

  if (successResults.length === 0) {
    return {
      agreement: 0,
      commonPoints: [],
      differences: [],
      confidenceScores: {} as Record<AIService, number>,
    };
  }

  const comparisonPrompt = `Analyze the following responses from different AI services and identify:
1. Common points (areas of agreement)
2. Differences (areas of disagreement)
3. Overall agreement percentage (0-100)

Responses:
${successResults.map((r) => `${r.service}: ${r.result}`).join("\n\n")}

Respond in JSON format:
{
  "agreement": <number 0-100>,
  "commonPoints": ["point1", "point2", ...],
  "differences": ["difference1", "difference2", ...]
}`;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an expert fact-checker. Analyze AI responses for agreement and differences. Always respond with valid JSON.",
        },
        {
          role: "user",
          content: comparisonPrompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "fact_check_result",
          strict: true,
          schema: {
            type: "object",
            properties: {
              agreement: {
                type: "number",
                minimum: 0,
                maximum: 100,
              },
              commonPoints: {
                type: "array",
                items: {
                  type: "string",
                },
              },
              differences: {
                type: "array",
                items: {
                  type: "string",
                },
              },
            },
            required: ["agreement", "commonPoints", "differences"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message.content;
    if (!content) throw new Error("No response from LLM");

    const contentStr = typeof content === "string" ? content : JSON.stringify(content);
    const parsed = JSON.parse(contentStr);

    const confidenceScores: Record<AIService, number> = {} as Record<AIService, number>;
    successResults.forEach((r) => {
      confidenceScores[r.service] = r.confidence;
    });

    return {
      agreement: parsed.agreement,
      commonPoints: parsed.commonPoints,
      differences: parsed.differences,
      confidenceScores,
    };
  } catch (error) {
    console.error("Fact check error:", error);
    return {
      agreement: 50,
      commonPoints: [],
      differences: [],
      confidenceScores: {} as Record<AIService, number>,
    };
  }
}

/**
 * 複数AI結果を統合してレポート用のセクション内容を生成
 */
export async function synthesizeReport(
  taskDescription: string,
  aiResults: AIResult[],
  factCheckResult: FactCheckResult
): Promise<Record<string, string>> {
  const synthesisPrompt = `Based on the following AI analysis results and fact-check findings, create a comprehensive report with these 8 sections:

Task: ${taskDescription}

AI Results:
${aiResults.map((r) => `${r.service}: ${r.result}`).join("\n\n")}

Fact Check Results:
- Agreement: ${factCheckResult.agreement}%
- Common Points: ${factCheckResult.commonPoints.join(", ")}
- Differences: ${factCheckResult.differences.join(", ")}

Generate JSON with these exact sections:
{
  "conclusion": "...",
  "reason": "Why this action should be taken now",
  "benefits": "List of benefits",
  "drawbacks": "List of drawbacks",
  "risks": "Potential risks",
  "recommendations": "Specific recommended actions",
  "sources": "Summary of sources and references",
  "graphs": "Description of data visualization needed"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an expert report writer. Create comprehensive, well-structured reports. Always respond with valid JSON.",
        },
        {
          role: "user",
          content: synthesisPrompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "report_sections",
          strict: true,
          schema: {
            type: "object",
            properties: {
              conclusion: { type: "string" },
              reason: { type: "string" },
              benefits: { type: "string" },
              drawbacks: { type: "string" },
              risks: { type: "string" },
              recommendations: { type: "string" },
              sources: { type: "string" },
              graphs: { type: "string" },
            },
            required: ["conclusion", "reason", "benefits", "drawbacks", "risks", "recommendations", "sources", "graphs"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message.content;
    if (!content) throw new Error("No response from LLM");

    const contentStr = typeof content === "string" ? content : JSON.stringify(content);
    return JSON.parse(contentStr);
  } catch (error) {
    console.error("Synthesis error:", error);
    return {
      conclusion: "Unable to generate conclusion",
      reason: "Unable to generate reason",
      benefits: "Unable to generate benefits",
      drawbacks: "Unable to generate drawbacks",
      risks: "Unable to generate risks",
      recommendations: "Unable to generate recommendations",
      sources: "Unable to generate sources",
      graphs: "Unable to generate graphs",
    };
  }
}
