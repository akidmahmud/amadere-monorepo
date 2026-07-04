import mysql from 'mysql2/promise';

// Points at the temporary mysql_source docker-compose service (B12 only —
// see docker-compose.yml comment) that the old dump was loaded into, not a
// live connection to the production site.
export async function connectSource(): Promise<mysql.Connection> {
  return mysql.createConnection({
    host: process.env.MYSQL_SOURCE_HOST ?? 'localhost',
    port: Number(process.env.MYSQL_SOURCE_PORT ?? 3307),
    user: process.env.MYSQL_SOURCE_USER ?? 'root',
    password: process.env.MYSQL_SOURCE_PASSWORD ?? 'amader',
    database: process.env.MYSQL_SOURCE_DATABASE ?? 'amader_legacy',
  });
}
