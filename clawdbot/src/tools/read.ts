/**
 * repoql_read tool implementation.
 *
 * Purpose: Registers the read tool for token-budget-aware content retrieval.
 * Complexity: Delegates to InstanceManager and normalizes errors.
 */

import type { InstanceManager } from "../lifecycle/InstanceManager.js";
import type { ResolvedConfig } from "../config/types.js";
import { TOOL_TIMEOUTS } from "../config/types.js";
import { normalizeError } from "../mcp/errors.js";
import { ReadParams, type ReadParamsType } from "./schemas.js";
import type { McpToolResult } from "../mcp/types.js";

const READ_DESCRIPTION = `<WHY>
Explore finds URIs. Read fetches content. This is the second half of the workflow.

The power: you don't read whole files. Explore gives you symbol URIs like \`file:///src/Auth.cs#symbol=ValidateToken\`. Read fetches just that function body. Three symbols across three files? One read call, just the bodies, no waste.
</WHY>

<CORE>
\`read(uri, budget)\` returns content at the richest level that fits your budget.

Progressive disclosure kicks in automatically:
- Budget allows full content? You get full content with line numbers.
- Too large? You get structure (signatures without bodies).
- Still too large? You get headlines (one-line summaries).

Globs distribute budget across matches. 100 files at 10k budget = ~100 tokens each = headlines. 1 file at 10k = full content. Narrow your target to get depth.
</CORE>

<MODIFIERS>
Append \` => modifier\` to get a specific view instead of content.

**tree**: Directory structure with progressive detail.
→ \`=> tree: folders\` — just directories with file counts (cheapest)
→ \`=> tree: files\` — directories + filenames (default)
→ \`=> tree: headlines\` — directories + files + one-line summaries

**headline**: One-line summary per file, flat list (no tree structure).

**structure**: Signatures without bodies—see the shape without reading code.

**content**: Full file with line numbers (explicit default).

**history**: Git commits affecting the file.
→ \`=> history\` — all commits, newest first
→ \`=> history: keyword\` — ranks commits by relevance to keyword (doesn't filter)

**blame**: Line-by-line git attribution showing who changed each line and when.

**changes**: Working copy changes grouped by changelist (staged, unstaged, untracked).
→ Shows diffs for modified files, binary markers, and line counts

**lint**: Diagnostics from the file.
→ \`=> lint\` — all diagnostics
→ \`=> lint: errors\` — errors only
→ \`=> lint: warnings\` — warnings only

**find**: Semantic search within matched files.
→ \`=> find: keywords\` — ranks content by relevance, shows snippets
→ Has quality threshold—won't show junk matches

**grep**: Case-insensitive literal text search within matched files.
→ \`=> grep: validateToken\` — every line containing the string, with context

**regex**: Regular expression search within matched files.
→ \`=> regex: validate\\\\w+\\\\(\` — pattern match with full regex syntax

**question**: LLM synthesis with citations.
→ \`=> question: How does X work?\` — reads content, synthesizes answer
→ Returns Answer, Evidence (with file:///path#line=N,M citations), Nuance
→ Always verify citations before trusting
</MODIFIERS>

<PATTERNS>
URIs can target precisely or match broadly.

**Fragments** pinpoint within files:
→ \`#symbol=ValidateToken\` — exact symbol (fully qualified name matched)
→ \`#symbol=AuthService.*\` — all direct members of a class
→ \`#symbol=AuthService.**\` — all descendants (nested types too)
→ \`#line=42\` — single line
→ \`#line=42,100\` — line range (inclusive, 1-based)

**Globs** select many files:
→ \`file:///src/**/*.cs\` — recursive, all .cs files
→ \`file:///src/*.cs\` — non-recursive, one level only

**Combining and excluding**:
→ \`a;b;c\` — match any of a, b, c
→ \`!pattern\` — exclude from all includes
→ \`file:///src/**;!**/tests/**\` — source without tests

**Symbol wildcards across files** (powerful):
→ \`file:///src/**/*Handler.cs#symbol=*Handler.CanHandle\` — all CanHandle methods
→ \`file:///src/**/*Service.cs#symbol=*Service.*\` — all members of all services

**Multiple specific symbols** (from explore results):
→ \`file:///a.cs#symbol=Foo;file:///b.cs#symbol=Bar;file:///c.cs#symbol=Baz\`
→ One call, just those three function bodies
</PATTERNS>

<BUDGET>
Budget is how many tokens you're willing to spend. This is a bet—you don't know exactly what you'll get.

- Start low and increase if you need more
- Different targets and modifiers consume budget differently
- Globs distribute across matches: 100 files at 5k = shallow; 1 file at 5k = deep

Consider the stakes: if missing context has serious consequences, bet more. When the cost of being wrong is low, bet small and iterate.
</BUDGET>

<QUICK_PATTERNS>
Orient in new codebase:
→ read("file:///** => tree: folders", 5000)

See what's in a directory:
→ read("file:///src/Services/** => tree: headlines", 2000)

Read a specific file:
→ read("file:///src/Auth.cs", 5000)

Read just one function:
→ read("file:///src/Auth.cs#symbol=ValidateToken", 2000)

Read all members of a class:
→ read("file:///src/Auth.cs#symbol=AuthService.*", 3000)

Read same method across multiple files:
→ read("file:///src/**/*Handler.cs#symbol=*Handler.ExecuteAsync", 3000)

Combine specific symbols from explore:
→ read("file:///a.cs#symbol=Foo;file:///b.cs#symbol=Bar", 2000)

Who changed this file:
→ read("file:///src/Auth.cs => blame", 2000)

What changed recently:
→ read("file:///src/Auth.cs => history", 1500)

What's pending in working copy:
→ read("file:///src/Auth/** => changes", 2000)

Find exact text in files:
→ read("file:///src/**/*.cs => grep: connectionString", 2000)

Find patterns in files:
→ read("file:///src/**/*.cs => regex: class\\\\s+\\\\w+Handler", 2000)

Ask a question about code:
→ read("file:///src/Auth/**/*.cs => question: How is token refresh implemented?", 2500)
</QUICK_PATTERNS>

<VS_EXPLORE>
Use **explore** when you need to FIND something (what exists, where is X, how does Y work).
Use **read** when you KNOW the URI and want the content.

Workflow: explore Inventory → explore Locate → read specific URIs
</VS_EXPLORE>`;

/**
 * Registers the repoql_read tool.
 */
export function registerReadTool(
  api: any,
  manager: InstanceManager,
  config: ResolvedConfig,
  getWorkdir: () => string
): void {
  api.registerTool({
    name: "repoql_read",
    description: READ_DESCRIPTION,
    parameters: ReadParams,
    async execute(_id: string, params: ReadParamsType): Promise<McpToolResult> {
      try {
        const workdir = getWorkdir();
        const client = await manager.getInstance(workdir);
        const timeout = TOOL_TIMEOUTS.read ?? config.defaultTimeoutMs;

        const args: Record<string, unknown> = {
          uri: params.uri,
          tokenBudget: params.tokenBudget,
        };

        return await client.callTool("read", args, timeout);
      } catch (err) {
        return normalizeError(err);
      }
    },
  });
}
