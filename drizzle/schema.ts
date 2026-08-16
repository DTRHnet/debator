import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const userSettings = mysqlTable("user_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  timerSeconds: int("timerSeconds").notNull().default(60),
  roundCount: int("roundCount").notNull().default(1),
  preferredModel: varchar("preferredModel", { length: 160 }).notNull().default("google/gemma-4-26b-a4b-it:free"),
  encryptedOpenRouterKey: text("encryptedOpenRouterKey"),
  keyLastFour: varchar("keyLastFour", { length: 4 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const playerProfiles = mysqlTable("player_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  handle: varchar("handle", { length: 24 }).notNull().unique(),
  isPublic: int("isPublic").notNull().default(1),
  preferredCategory: varchar("preferredCategory", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const debateSessions = mysqlTable("debate_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
  topicSource: mysqlEnum("topicSource", ["random", "custom"]).notNull(),
  timerSeconds: int("timerSeconds").notNull(),
  roundCount: int("roundCount").notNull(),
  proTranscript: text("proTranscript").notNull(),
  conTranscript: text("conTranscript").notNull(),
  proScore: int("proScore"),
  conScore: int("conScore"),
  verdictJson: text("verdictJson"),
  status: mysqlEnum("status", ["pending", "unavailable", "failed", "complete"]).notNull().default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("debate_sessions_user_created_idx").on(table.userId, table.createdAt)]);

export type UserSettings = typeof userSettings.$inferSelect;
export type PlayerProfile = typeof playerProfiles.$inferSelect;
export type InsertPlayerProfile = typeof playerProfiles.$inferInsert;
export type DebateSession = typeof debateSessions.$inferSelect;
