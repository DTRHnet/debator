import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { debateSessions, InsertUser, userSettings, users } from "../drizzle/schema";
import { ENV } from './_core/env';
import type { DebateVerdict } from "./debateJudge";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserSettings(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return result[0];
}

export async function upsertUserSettings(input: {
  userId: number;
  timerSeconds: number;
  roundCount: number;
  preferredModel: string;
  encryptedOpenRouterKey: string | null;
  keyLastFour: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");
  await db.insert(userSettings).values(input).onDuplicateKeyUpdate({
    set: {
      timerSeconds: input.timerSeconds,
      roundCount: input.roundCount,
      preferredModel: input.preferredModel,
      encryptedOpenRouterKey: input.encryptedOpenRouterKey,
      keyLastFour: input.keyLastFour,
    },
  });
}

type SessionInput = {
  id: string;
  userId: number;
  topic: string;
  topicSource: "random" | "custom";
  timerSeconds: number;
  roundCount: number;
  proTranscript: string;
  conTranscript: string;
  verdict: DebateVerdict | null;
  status: "pending" | "unavailable" | "failed" | "complete";
};

export async function upsertDebateSession(input: SessionInput) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");
  const values = {
    id: input.id,
    userId: input.userId,
    topic: input.topic,
    topicSource: input.topicSource,
    timerSeconds: input.timerSeconds,
    roundCount: input.roundCount,
    proTranscript: input.proTranscript,
    conTranscript: input.conTranscript,
    proScore: input.verdict?.pro.totalScore ?? null,
    conScore: input.verdict?.con.totalScore ?? null,
    verdictJson: input.verdict ? JSON.stringify(input.verdict) : null,
    status: input.status,
  } as const;
  await db.insert(debateSessions).values(values).onDuplicateKeyUpdate({
    set: {
      topic: values.topic,
      topicSource: values.topicSource,
      timerSeconds: values.timerSeconds,
      roundCount: values.roundCount,
      proTranscript: values.proTranscript,
      conTranscript: values.conTranscript,
      proScore: values.proScore,
      conScore: values.conScore,
      verdictJson: values.verdictJson,
      status: values.status,
    },
  });
}

export async function getDebateSessions(userId: number, limit: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(debateSessions)
    .where(eq(debateSessions.userId, userId))
    .orderBy(desc(debateSessions.createdAt))
    .limit(limit);
}
