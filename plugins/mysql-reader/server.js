import { Server } from "@modelcontextprotocol/sdk/server/index.js";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import mysql from "mysql2/promise";

const server = new Server(
    {
        name: "mysql-reader",
        version: "1.0.0"
    },
    {
        capabilities: {
            tools: {}
        }
    }
);

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
});

server.setRequestHandler("tools/list", async () => ({
    tools: [
        {
            name: "query_mysql",
            description: "Query MySQL database",
            inputSchema: {
                type: "object",
                properties: {
                    sql: {
                        type: "string"
                    }
                },
                required: ["sql"]
            }
        }
    ]
}));

server.setRequestHandler("tools/call", async (req) => {

    if (req.params.name === "query_mysql") {

        const [rows] = await pool.query(req.params.arguments.sql);

        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(rows, null, 2)
                }
            ]
        };

    }

});

const transport = new StdioServerTransport();

await server.connect(transport);