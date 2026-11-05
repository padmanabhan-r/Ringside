import postgres from "postgres";

let client: postgres.Sql | undefined;

/** The shared Postgres client. On Render, DATABASE_URL is the database's private-network URL. */
export function db(): postgres.Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  client ??= postgres(url, { max: 5, idle_timeout: 20, connect_timeout: 10 });
  return client;
}
