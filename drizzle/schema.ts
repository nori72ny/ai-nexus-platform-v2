import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, decimal, boolean, index } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "viewer"]).default("user").notNull(),
  status: mysqlEnum("status", ["active", "suspended", "deleted"]).default("active").notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  twoFactorEnabled: boolean("twoFactorEnabled").default(false),
  twoFactorSecret: varchar("twoFactorSecret", { length: 255 }),
  lastPasswordChange: timestamp("lastPasswordChange"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// JWT Tokens table - Token tracking and revocation
export const jwtTokens = mysqlTable("jwt_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tokenHash: varchar("tokenHash", { length: 255 }).notNull().unique(),
  tokenType: mysqlEnum("tokenType", ["access", "refresh"]).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_jwt_user_id").on(table.userId),
  expiresAtIdx: index("idx_jwt_expires_at").on(table.expiresAt),
}));

export type JWTToken = typeof jwtTokens.$inferSelect;
export type InsertJWTToken = typeof jwtTokens.$inferInsert;

// User Sessions table - Session tracking
export const userSessions = mysqlTable("user_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tokenId: int("tokenId").notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  lastActivity: timestamp("lastActivity").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_session_user_id").on(table.userId),
  lastActivityIdx: index("idx_session_last_activity").on(table.lastActivity),
}));

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = typeof userSessions.$inferInsert;

// API Keys table - For programmatic access
export const apiKeys = mysqlTable("api_keys", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  keyHash: varchar("keyHash", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  lastUsed: timestamp("lastUsed"),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_apikey_user_id").on(table.userId),
}));

export type APIKey = typeof apiKeys.$inferSelect;
export type InsertAPIKey = typeof apiKeys.$inferInsert;

// Tasks table - ユーザーが入力したタスク
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Reports table - 生成されたレポート
export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  userId: int("userId").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  status: mysqlEnum("status", ["draft", "completed", "archived"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Report sections - レポートの8セクション
export const sections = mysqlTable("sections", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId").notNull(),
  sectionType: mysqlEnum("sectionType", [
    "conclusion",
    "reason",
    "benefits",
    "drawbacks",
    "risks",
    "recommendations",
    "sources",
    "graphs"
  ]).notNull(),
  content: text("content"),
  order: int("order").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Citations table - 出典情報
export const citations = mysqlTable("citations", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId").notNull(),
  source: text("source").notNull(),
  url: varchar("url", { length: 2048 }),
  aiService: varchar("aiService", { length: 64 }).notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Graphs table - グラフデータ
export const graphs = mysqlTable("graphs", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId").notNull(),
  graphType: varchar("graphType", { length: 64 }).notNull(),
  title: text("title"),
  data: json("data"),
  order: int("order").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// AI Results table - 各AIサービスの結果
export const aiResults = mysqlTable("aiResults", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId").notNull(),
  aiService: varchar("aiService", { length: 64 }).notNull(),
  result: text("result"),
  processingTime: int("processingTime"),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  status: mysqlEnum("status", ["pending", "completed", "failed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Audit logs table - 監査ログ
export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  action: varchar("action", { length: 128 }).notNull(),
  resourceType: varchar("resourceType", { length: 64 }),
  resourceId: int("resourceId"),
  details: json("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Type exports
export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

export type Section = typeof sections.$inferSelect;
export type InsertSection = typeof sections.$inferInsert;

export type Citation = typeof citations.$inferSelect;
export type InsertCitation = typeof citations.$inferInsert;

export type Graph = typeof graphs.$inferSelect;
export type InsertGraph = typeof graphs.$inferInsert;

export type AIResult = typeof aiResults.$inferSelect;
export type InsertAIResult = typeof aiResults.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// Relations
export const tasksRelations = relations(tasks, ({ one, many }) => ({
  user: one(users, { fields: [tasks.userId], references: [users.id] }),
  reports: many(reports),
}));

export const reportsRelations = relations(reports, ({ one, many }) => ({
  task: one(tasks, { fields: [reports.taskId], references: [tasks.id] }),
  user: one(users, { fields: [reports.userId], references: [users.id] }),
  sections: many(sections),
  citations: many(citations),
  graphs: many(graphs),
  aiResults: many(aiResults),
}));

export const sectionsRelations = relations(sections, ({ one }) => ({
  report: one(reports, { fields: [sections.reportId], references: [reports.id] }),
}));

export const citationsRelations = relations(citations, ({ one }) => ({
  report: one(reports, { fields: [citations.reportId], references: [reports.id] }),
}));

export const graphsRelations = relations(graphs, ({ one }) => ({
  report: one(reports, { fields: [graphs.reportId], references: [reports.id] }),
}));

export const aiResultsRelations = relations(aiResults, ({ one }) => ({
  report: one(reports, { fields: [aiResults.reportId], references: [reports.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

export const jwtTokensRelations = relations(jwtTokens, ({ one }) => ({
  user: one(users, { fields: [jwtTokens.userId], references: [users.id] }),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, { fields: [userSessions.userId], references: [users.id] }),
  jwtToken: one(jwtTokens, { fields: [userSessions.tokenId], references: [jwtTokens.id] }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  tasks: many(tasks),
  reports: many(reports),
  auditLogs: many(auditLogs),
  jwtTokens: many(jwtTokens),
  sessions: many(userSessions),
  apiKeys: many(apiKeys),
}))