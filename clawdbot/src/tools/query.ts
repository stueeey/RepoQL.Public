/**
 * repoql_query tool implementation.
 *
 * Purpose: Registers the query tool for DuckDB SQL access.
 * Complexity: Delegates to InstanceManager and normalizes errors.
 */

import type { InstanceManager } from "../lifecycle/InstanceManager.js";
import type { ResolvedConfig } from "../config/types.js";
import { TOOL_TIMEOUTS } from "../config/types.js";
import { normalizeError } from "../mcp/errors.js";
import { QueryParams, type QueryParamsType } from "./schemas.js";
import type { McpToolResult } from "../mcp/types.js";

const QUERY_DESCRIPTION = `<CONCEPT>
DuckDB SQL for computation on the indexed repository.
Use query when you need to COMPUTE (aggregate, filter, join, extract) - not just DISCOVER.
</CONCEPT>

<DECISION>
| Need | Tool |
|------|------|
| "What exists? Where is X?" | explore |
| "Show me this file/symbol" | read |
| "How many? Which ones? What pattern?" | **query** |
</DECISION>

<VIEWS>
Start here — these cover 90% of queries:

**Files** — \`uri, lang, lines, error_count, warning_count, headline, summary, structure\`
\`\`\`sql
SELECT lang, COUNT(*), SUM(lines) FROM Files GROUP BY lang;
\`\`\`

**Functions** — \`name, qualified_name, declaring_type, signature, return_type, is_async\`
\`\`\`sql
SELECT name, signature FROM Functions WHERE declaring_type = 'UserService';
\`\`\`

**Types** — \`name, qualified_name, type_kind, namespace, extends, implements\`
\`\`\`sql
SELECT name, file_uri FROM Types WHERE extends = 'BaseService';
\`\`\`

**Annotations** — \`resolved_target_uri, severity, rule_id, message\`
\`\`\`sql
SELECT rule_id, COUNT(*) FROM Annotations GROUP BY rule_id ORDER BY 2 DESC;
\`\`\`

**annotations_for(uri, kinds, min_severity)** — diagnostics for one document
\`\`\`sql
SELECT rule_id, message FROM annotations_for('file:///src/api.cs', 'lint', 'warning');
\`\`\`
</VIEWS>

<FUNCTIONS>
**search(q, k, scope, boost_pattern, negative_pattern)** → uri, score — semantic + lexical
\`\`\`sql
SELECT uri, score FROM search('authentication', k := 10);
SELECT uri, score FROM search('parser', scope := 'file:///src/%', boost_pattern := 'markdown|yaml', negative_pattern := '(?i)test');
\`\`\`

**search_symbol(q, scope, kind_filter, k)** → symbol, uri — find functions, classes, methods by name
\`\`\`sql
SELECT symbol, uri FROM search_symbol('ValidateToken');
SELECT symbol FROM search_symbol('Service', kind_filter := 'type', scope := 'src/**/*.cs');
\`\`\`

**snippet(uri, context)** → line_number, text, is_focus — code preview
\`\`\`sql
SELECT line_number, text FROM snippet('file:///src/api.cs#line=42', 3);
\`\`\`
Fragments: \`#line=42\`, \`#line=42,100\`, \`#symbol=ClassName.MethodName\`, \`#char=100,150\`

**glob_files(pattern)** → uri — \`SELECT uri FROM glob_files('src/**/*.cs;!**/tests/**');\`
**related(uri, k)** → uri, score — find similar documents
**ask(context_json, question, max_tokens)** → text — LLM synthesis on query results
</FUNCTIONS>

<COMPOSITION>
Every operation returns a table. SQL joins and CTEs compose them.

**LATERAL** — expand each row with a correlated function:
\`\`\`sql
SELECT s.uri, sn.text
FROM search('config', k := 5) s, LATERAL snippet(s.uri, 2) sn
WHERE sn.is_focus;
\`\`\`

**parse()** — inline CSV/JSON/YAML as ad-hoc lookup tables:
\`\`\`sql
SELECT f.uri, o.team FROM Files f
JOIN parse('pattern,team\\n**/Auth/**,Security\\n**/Core/**,Platform') o
ON f.uri LIKE o.pattern;
\`\`\`

**Recursive CTEs** — graph traversal through composition tree:
\`\`\`sql
WITH RECURSIVE parts AS (
  SELECT destination_node_id as id, 1 as depth FROM edge
  WHERE source_node_id = (SELECT id FROM node WHERE uri = 'file:///src/Auth.cs')
  AND type = 'HAS_PART'
  UNION ALL
  SELECT e.destination_node_id, p.depth + 1 FROM edge e
  JOIN parts p ON e.source_node_id = p.id
  WHERE e.type = 'HAS_PART' AND p.depth < 5
)
SELECT n.kind, n.name, p.depth FROM parts p
JOIN node n ON p.id = n.id ORDER BY p.depth;
\`\`\`

**Search + enrich** — join search results with metadata:
\`\`\`sql
SELECT s.uri, f.lang, f.lines FROM search('error', k := 20) s JOIN Files f ON s.uri = f.uri;
\`\`\`
</COMPOSITION>

<MORE>
Look up syntax at \`help:///repoql/tools/query/\` when needed:

- **Git**: git_status(), git_diff(), git_blame(), git_hotspots, changes_related_to()
- **MCP**: mcp_tools(), mcp_tool_params() — call external MCP servers from SQL, results as rows
- **Data**: parse(text) for CSV/JSON/YAML; xlsx(), xlsx_sheets(), xlsx_union() for Excel
- **Format views**: markdown_headings, csharp_types, etc. — \`help:///repoql/tools/query/formats/*\`
- **Regex**: regexp_extract_all() for pattern extraction across codebase
- **DuckDB patterns**: QUALIFY, PIVOT/UNPIVOT, list comprehensions, window functions
- **Base tables** (prefer views): artifact, node, edge, span, annotation
</MORE>

<BUDGET>
Large results auto-summarize when they exceed your token budget.
Repeat the exact query to bypass summarization and get full results.
</BUDGET>`;

/**
 * Registers the repoql_query tool.
 */
export function registerQueryTool(
  api: any,
  manager: InstanceManager,
  config: ResolvedConfig,
  getWorkdir: () => string
): void {
  api.registerTool({
    name: "repoql_query",
    description: QUERY_DESCRIPTION,
    parameters: QueryParams,
    async execute(_id: string, params: QueryParamsType): Promise<McpToolResult> {
      try {
        const workdir = getWorkdir();
        const client = await manager.getInstance(workdir);
        const timeout = TOOL_TIMEOUTS.query ?? config.defaultTimeoutMs;

        const args: Record<string, unknown> = {
          sql: params.sql,
        };

        if (params.tokenBudget !== undefined) {
          args.tokenBudget = params.tokenBudget;
        }

        return await client.callTool("query", args, timeout);
      } catch (err) {
        return normalizeError(err);
      }
    },
  });
}
