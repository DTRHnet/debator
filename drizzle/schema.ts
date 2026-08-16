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

export const matchmakingQueue = mysqlTable("matchmaking_queue", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  rulesetJson: text("rulesetJson").notNull(),
  rulesetHash: varchar("rulesetHash", { length: 64 }).notNull(),
  rating: int("rating").notNull().default(1000),
  category: varchar("category", { length: 64 }),
  status: mysqlEnum("status", ["queued", "matched", "cancelled", "expired"]).notNull().default("queued"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
}, table => [index("matchmaking_queue_status_created_idx").on(table.status, table.createdAt)]);

export const multiplayerRooms = mysqlTable("multiplayer_rooms", {
  id: varchar("id", { length: 64 }).primaryKey(),
  hostUserId: int("hostUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
  rulesetJson: text("rulesetJson").notNull(),
  state: mysqlEnum("state", ["waiting", "ready", "countdown", "speaking", "turn_submitted", "round_complete", "judging", "completed", "abandoned", "expired", "cancelled"]).notNull().default("waiting"),
  stateVersion: int("stateVersion").notNull().default(0),
  currentRound: int("currentRound").notNull().default(1),
  activeSide: mysqlEnum("activeSide", ["pro", "con"]),
  deadlineAt: timestamp("deadlineAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("multiplayer_rooms_state_updated_idx").on(table.state, table.updatedAt)]);

export const roomPlayers = mysqlTable("room_players", {
  id: int("id").autoincrement().primaryKey(),
  roomId: varchar("roomId", { length: 64 }).notNull().references(() => multiplayerRooms.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  side: mysqlEnum("side", ["pro", "con"]).notNull(),
  ready: int("ready").notNull().default(0),
  connected: int("connected").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("room_players_room_idx").on(table.roomId), index("room_players_user_idx").on(table.userId)]);

export const roomTurns = mysqlTable("room_turns", {
  id: int("id").autoincrement().primaryKey(),
  roomId: varchar("roomId", { length: 64 }).notNull().references(() => multiplayerRooms.id, { onDelete: "cascade" }),
  round: int("round").notNull(),
  side: mysqlEnum("side", ["pro", "con"]).notNull(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  transcript: text("transcript").notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 64 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("room_turns_room_round_idx").on(table.roomId, table.round)]);

export const roomEvents = mysqlTable("room_events", {
  id: int("id").autoincrement().primaryKey(),
  roomId: varchar("roomId", { length: 64 }).notNull().references(() => multiplayerRooms.id, { onDelete: "cascade" }),
  eventId: int("eventId").notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  payloadJson: text("payloadJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("room_events_room_event_idx").on(table.roomId, table.eventId)]);

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
export type MatchmakingQueueEntry = typeof matchmakingQueue.$inferSelect;
export type MultiplayerRoom = typeof multiplayerRooms.$inferSelect;
export type RoomPlayer = typeof roomPlayers.$inferSelect;
export type RoomTurn = typeof roomTurns.$inferSelect;
export type RoomEvent = typeof roomEvents.$inferSelect;
export type DebateSession = typeof debateSessions.$inferSelect;
