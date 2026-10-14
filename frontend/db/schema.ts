import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});
export const courses = sqliteTable(
  "courses",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("courses_owner_name").on(t.ownerId, t.name)],
);
export const materials = sqliteTable(
  "materials",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    status: text("status").notNull(),
    storageKey: text("storage_key").notNull(),
    bytes: integer("bytes").notNull(),
    pages: integer("pages").notNull().default(0),
    seeded: integer("seeded").notNull().default(0),
    error: text("error"),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [index("materials_owner_course").on(t.ownerId, t.courseId, t.status)],
);
export const pages = sqliteTable(
  "pages",
  {
    id: text("id").primaryKey(),
    materialId: text("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    page: integer("page").notNull(),
    text: text("text").notNull(),
  },
  (t) => [uniqueIndex("pages_material_page").on(t.materialId, t.page)],
);
export const chunks = sqliteTable(
  "chunks",
  {
    id: text("id").primaryKey(),
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    text: text("text").notNull(),
  },
  (t) => [index("chunks_page").on(t.pageId)],
);
export const topics = sqliteTable(
  "topics",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    data: text("data").notNull(),
    mastery: integer("mastery").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    correct: integer("correct").notNull().default(0),
    last: text("last").notNull(),
  },
  (t) => [index("topics_owner_course").on(t.ownerId, t.courseId)],
);
export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("conversations_owner").on(t.ownerId)],
);
export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    text: text("text").notNull(),
    citations: text("citations").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("messages_conversation").on(t.conversationId)],
);
export const quizzes = sqliteTable(
  "quizzes",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    materialId: text("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    mode: text("mode").notNull(),
    verification: text("verification").notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at"),
  },
  (t) => [index("quizzes_owner").on(t.ownerId)],
);
export const questions = sqliteTable(
  "questions",
  {
    id: text("id").primaryKey(),
    quizId: text("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id),
    ordinal: integer("ordinal").notNull(),
    data: text("data").notNull(),
  },
  (t) => [index("questions_quiz").on(t.quizId)],
);
export const attempts = sqliteTable(
  "attempts",
  {
    id: text("id").primaryKey(),
    quizId: text("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    data: text("data").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("attempts_quiz_once").on(t.quizId),
    index("attempts_owner").on(t.ownerId),
  ],
);
export const masteryHistory = sqliteTable(
  "mastery_history",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    attemptId: text("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    mastery: integer("mastery").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("mastery_owner").on(t.ownerId, t.createdAt)],
);
export const flashcards = sqliteTable(
  "flashcards",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    front: text("front").notNull(),
    back: text("back").notNull(),
  },
  (t) => [uniqueIndex("flashcards_owner_topic").on(t.ownerId, t.topicId)],
);
export const revisions = sqliteTable(
  "revisions",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("revisions_owner").on(t.ownerId)],
);
export const activity = sqliteTable(
  "activity",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("activity_owner").on(t.ownerId, t.createdAt)],
);
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: integer("reset_at").notNull(),
});
