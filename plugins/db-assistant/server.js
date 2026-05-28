import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "localhost",
  port: parseInt(process.env.MYSQL_PORT || "3306"),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || undefined,
  waitForConnections: true,
  connectionLimit: 5,
  connectTimeout: 10000,
});

const DEFAULT_LIMIT = 100;

function isReadOnly(sql) {
  const trimmed = sql.trim().replace(/^\/\*.*?\*\//s, "").trim();
  const upper = trimmed.toUpperCase();
  return (
    upper.startsWith("SELECT") ||
    upper.startsWith("SHOW") ||
    upper.startsWith("DESCRIBE") ||
    upper.startsWith("DESC") ||
    upper.startsWith("EXPLAIN")
  );
}

function ensureLimit(sql, limit) {
  const upper = sql.trim().toUpperCase();
  if (upper.startsWith("SELECT") && !upper.includes("LIMIT")) {
    return `${sql.trim()} LIMIT ${limit}`;
  }
  return sql;
}

async function execute(sql) {
  const [rows] = await pool.query(sql);
  return JSON.stringify(rows, null, 2);
}

const TOOLS = [
  {
    name: "list_databases",
    description: "List all databases on the MySQL server",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_tables",
    description: "List all tables in a database",
    inputSchema: {
      type: "object",
      properties: {
        database: { type: "string", description: "Database name. Uses the default database from env if omitted." },
      },
    },
  },
  {
    name: "describe_table",
    description: "Show table structure: column names, types, keys, defaults, and comments",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Table name" },
        database: { type: "string", description: "Database name (optional)" },
      },
      required: ["table"],
    },
  },
  {
    name: "query",
    description: "Execute a read-only SELECT query. Non-SELECT statements are rejected. Results are limited to 100 rows by default.",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SELECT SQL statement" },
        limit: { type: "number", description: "Max rows to return (default 100)" },
      },
      required: ["sql"],
    },
  },
  {
    name: "explain_query",
    description: "Run EXPLAIN on a SELECT statement to analyze query execution plan",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SELECT SQL statement to analyze" },
      },
      required: ["sql"],
    },
  },
  {
    name: "table_indexes",
    description: "Show all indexes on a table",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Table name" },
        database: { type: "string", description: "Database name (optional)" },
      },
      required: ["table"],
    },
  },
  {
    name: "table_relations",
    description: "Show foreign key relationships for a table",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Table name" },
        database: { type: "string", description: "Database name (optional)" },
      },
      required: ["table"],
    },
  },
];

const handlers = {
  async list_databases() {
    return execute("SHOW DATABASES");
  },

  async list_tables({ database }) {
    const db = database || process.env.MYSQL_DATABASE;
    if (!db) return "Error: no database specified and MYSQL_DATABASE is not set";
    return execute(`SHOW TABLES FROM \`${db}\``);
  },

  async describe_table({ table, database }) {
    const db = database || process.env.MYSQL_DATABASE;
    const fullName = db ? `\`${db}\`.\`${table}\`` : `\`${table}\``;
    const [columns] = await pool.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT, COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? ${db ? "AND TABLE_SCHEMA = ?" : ""}
       ORDER BY ORDINAL_POSITION`,
      db ? [table, db] : [table]
    );
    return JSON.stringify(columns, null, 2);
  },

  async query({ sql, limit }) {
    if (!isReadOnly(sql)) return "Error: only SELECT queries are allowed";
    const safeSql = ensureLimit(sql, limit || DEFAULT_LIMIT);
    return execute(safeSql);
  },

  async explain_query({ sql }) {
    const trimmed = sql.trim().toUpperCase();
    if (!trimmed.startsWith("SELECT")) return "Error: EXPLAIN only works with SELECT statements";
    return execute(`EXPLAIN ${sql}`);
  },

  async table_indexes({ table, database }) {
    const db = database || process.env.MYSQL_DATABASE;
    const fullName = db ? `\`${db}\`.\`${table}\`` : `\`${table}\``;
    return execute(`SHOW INDEX FROM ${fullName}`);
  },

  async table_relations({ table, database }) {
    const db = database || process.env.MYSQL_DATABASE;
    if (!db) return "Error: no database specified and MYSQL_DATABASE is not set";
    const [rows] = await pool.query(
      `SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_SCHEMA, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [db, table]
    );
    return JSON.stringify(rows, null, 2);
  },
};

const server = new Server(
  { name: "db-assistant", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const handler = handlers[name];
  if (!handler) {
    return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
  }
  try {
    const result = await handler(args || {});
    return { content: [{ type: "text", text: result }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
