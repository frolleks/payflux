import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const invoiceTable = sqliteTable("invoice", {
  id: text("id").primaryKey(),
  address: text("address").notNull(),
  amount: text("amount").notNull(),
  chain: text("chain").notNull(),
  callbackUrl: text("callback_url").notNull(),
  status: text("status").default("pending"),
  confirmedSats: int("confirmed_sats").default(0),
  unconfirmedSats: int("unconfirmed_sats").default(0),
  confirmedWei: text("confirmed_wei").default("0"),
  createdAt: int("created_at").default(0),
  updatedAt: int("updated_at").default(0),
});

export const kvTable = sqliteTable("kv", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
