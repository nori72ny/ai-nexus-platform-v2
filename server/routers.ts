import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import {
  createTask,
  getTasksByUser,
  getTaskById,
  getReportsByUser,
  getReportById,
  getSectionsByReport,
  getCitationsByReport,
  getGraphsByReport,
  getAuditLogs,
  createReport,
  createSection,
  createCitation,
  createGraph,
  createAIResult,
  updateTaskStatus,
  updateReportStatus,
} from "./db";
import { routeTask, executeMultipleAIs, performFactCheck, synthesizeReport } from "./aiOrchestrator";
import { sseManager, createProgressEvent, createAIResultEvent, createFactCheckEvent, createReportEvent, createCompleteEvent } from "./sseHandler";
import { generateReportPDF } from "./pdfExporter";
import { logTaskCreated, logTaskStarted, logTaskCompleted, logTaskFailed, logReportGenerated } from "./auditLog";
import { authRouter, userManagementRouter } from "./auth/procedures";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  users: userManagementRouter,

  task: router({
    create: protectedProcedure
      .input((input: any) => ({
        title: String(input.title),
        description: input.description ? String(input.description) : undefined,
      }))
      .mutation(async ({ ctx, input }) => {
        const task = await createTask(ctx.user.id, input.title, input.description);
        if (!task) throw new Error('Task creation returned null');
        const taskId = (task as any)?.id;
        if (!taskId || taskId === 0) {
          throw new Error(`Invalid taskId returned: ${taskId}`);
        }
        await logTaskCreated(ctx.req, ctx.user.id, taskId, input.title);
        return { success: true, taskId };
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return await getTasksByUser(ctx.user.id);
    }),

    getDetail: protectedProcedure
      .input((input: any) => {
        // Accept either a number directly or an object with taskId property
        const taskId = typeof input === 'number' ? input : Number(input?.taskId);
        if (isNaN(taskId)) throw new Error('Invalid taskId');
        return taskId;
      })
      .query(async ({ ctx, input }) => {
        return await getTaskById(input, ctx.user.id);
      }),
  }),

  report: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await getReportsByUser(ctx.user.id);
    }),

    getDetail: protectedProcedure
      .input((input: any) => Number(input.reportId))
      .query(async ({ input }) => {
        const report = await getReportById(input);
        if (!report) return null;

        const sections = await getSectionsByReport(input);
        const citations = await getCitationsByReport(input);
        const graphs = await getGraphsByReport(input);

        return {
          ...report,
          sections,
          citations,
          graphs,
        };
      }),

    stream: protectedProcedure
      .input((input: any) => ({
        taskId: Number(input.taskId),
        taskDescription: String(input.taskDescription),
        clientId: String(input.clientId),
      }))
      .mutation(async ({ ctx, input }) => {
        const clientId = input.clientId;
        const taskId = input.taskId;

        try {
          await logTaskStarted(ctx.req, ctx.user.id, taskId);
          await updateTaskStatus(taskId, "processing");

          // ステップ1: AIルーティング
          sseManager.sendEvent(clientId, createProgressEvent("system", "routing"));
          const routingDecision = await routeTask(input.taskDescription);

          // ステップ2: 複数AI並列実行
          sseManager.sendEvent(clientId, createProgressEvent("system", "executing"));
          const aiResults = await executeMultipleAIs(input.taskDescription, routingDecision.selectedAIs, (service, status) => {
            sseManager.sendEvent(clientId, createProgressEvent(service, status));
          });

          // ステップ3: ファクトチェック
          sseManager.sendEvent(clientId, createProgressEvent("system", "fact-checking"));
          const factCheckResult = await performFactCheck(aiResults);
          sseManager.sendEvent(clientId, createFactCheckEvent(factCheckResult.agreement, factCheckResult.commonPoints, factCheckResult.differences));

          // ステップ4: レポート生成
          sseManager.sendEvent(clientId, createProgressEvent("system", "synthesizing"));
          const reportSections = await synthesizeReport(input.taskDescription, aiResults, factCheckResult);

          // ステップ5: データベースに保存
          const reportResult = await createReport(taskId, ctx.user.id, `Report for Task ${taskId}`);
          const reportId = (reportResult as any).insertId || 0;

          // セクションを保存
          const sectionOrder = ["conclusion", "reason", "benefits", "drawbacks", "risks", "recommendations", "sources", "graphs"];
          for (let i = 0; i < sectionOrder.length; i++) {
            const sectionType = sectionOrder[i];
            const content = reportSections[sectionType] || "";
            await createSection(reportId, sectionType, content, i);
          }

          // AI結果を保存
          for (const aiResult of aiResults) {
            if (aiResult.status === "success") {
              await createAIResult(reportId, aiResult.service, aiResult.result, aiResult.processingTime, aiResult.confidence);
            }
          }

          // 出典を保存
          for (const citation of factCheckResult.commonPoints) {
            await createCitation(reportId, citation, "system", undefined, 0.9);
          }

          // ステータス更新
          await updateTaskStatus(taskId, "completed");
          await updateReportStatus(reportId, "completed");
          await logTaskCompleted(ctx.req, ctx.user.id, taskId, reportId);
          await logReportGenerated(ctx.req, ctx.user.id, reportId, taskId);

          sseManager.sendEvent(clientId, createReportEvent(reportId, reportSections));
          sseManager.sendEvent(clientId, createCompleteEvent(reportId));

          return { success: true, reportId };
        } catch (error) {
          await updateTaskStatus(taskId, "failed");
          await logTaskFailed(ctx.req, ctx.user.id, taskId, error instanceof Error ? error.message : String(error));

          sseManager.sendEvent(clientId, {
            type: "error",
            message: error instanceof Error ? error.message : "Unknown error",
            timestamp: Date.now(),
          });

          throw error;
        }
      }),

    exportPDF: protectedProcedure
      .input((input: any) => Number(input.reportId))
      .mutation(async ({ ctx, input: reportId }) => {
        const report = await getReportById(reportId);
        if (!report || report.userId !== ctx.user.id) {
          throw new Error("Report not found or unauthorized");
        }

        const sections = await getSectionsByReport(reportId);
        const aiResults = await getAuditLogs(100, 0);

        const reportContent = {
          title: report.title,
          conclusion: sections.find((s) => s.sectionType === "conclusion")?.content || "",
          reason: sections.find((s) => s.sectionType === "reason")?.content || "",
          benefits: sections.find((s) => s.sectionType === "benefits")?.content || "",
          drawbacks: sections.find((s) => s.sectionType === "drawbacks")?.content || "",
          risks: sections.find((s) => s.sectionType === "risks")?.content || "",
          recommendations: sections.find((s) => s.sectionType === "recommendations")?.content || "",
          sources: sections.find((s) => s.sectionType === "sources")?.content || "",
          graphs: sections.find((s) => s.sectionType === "graphs")?.content || "",
          generatedAt: new Date(),
        };

        const pdfBuffer = await generateReportPDF(reportContent);
        return {
          success: true,
          pdf: pdfBuffer.toString("base64"),
          filename: `report-${reportId}-${Date.now()}.pdf`,
        };
      }),
  }),

  audit: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new Error("Unauthorized");
      }
      return await getAuditLogs(100, 0);
    }),
  }),
});

export type AppRouter = typeof appRouter;
