---
name: db-assistant
description: MySQL database read-only assistant. Use when the user needs to explore database schema, query data, or analyze table structure.
---

# db-assistant

MySQL 只读数据库助手，提供数据库元数据浏览和安全查询能力。

## 何时使用

当用户需要以下操作时自动触发：
- 查看数据库列表、表列表、表结构
- 查询数据（只读 SELECT）
- 分析查询性能（EXPLAIN）
- 查看索引和外键关系
- 了解数据库 schema 以辅助开发

## 可用工具

### list_databases
列出 MySQL 服务器上所有数据库。无需参数。

### list_tables
列出指定数据库中的所有表。
- `database`（可选）：数据库名，不传则使用环境变量 MYSQL_DATABASE

### describe_table
查看表结构，包含字段名、类型、是否可空、键类型、默认值、注释。
- `table`（必填）：表名
- `database`（可选）：数据库名

### query
执行只读 SELECT 查询。非 SELECT 语句会被拒绝，默认限制 100 行。
- `sql`（必填）：SELECT 语句
- `limit`（可选）：最大返回行数，默认 100

### explain_query
对 SELECT 语句执行 EXPLAIN，分析查询执行计划。
- `sql`（必填）：要分析的 SELECT 语句

### table_indexes
查看表的所有索引信息。
- `table`（必填）：表名
- `database`（可选）：数据库名

### table_relations
查看表的外键关系。
- `table`（必填）：表名
- `database`（可选）：数据库名

## 使用示例

```
用户: 帮我看看 users 表的结构
助手: [调用 describe_table, table="users"]

用户: 查一下最近注册的10个用户
助手: [调用 query, sql="SELECT * FROM users ORDER BY created_at DESC", limit=10]

用户: 这个查询为什么慢？SELECT * FROM orders WHERE user_id = 123
助手: [调用 explain_query, sql="SELECT * FROM orders WHERE user_id = 123"]
      [调用 table_indexes, table="orders"]
```
