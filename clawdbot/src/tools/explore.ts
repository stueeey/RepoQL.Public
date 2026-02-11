/**
 * repoql_explore tool implementation.
 *
 * Purpose: Registers the explore tool for intent-based repository discovery.
 * Complexity: Delegates to InstanceManager and normalizes errors.
 */

import type { InstanceManager } from "../lifecycle/InstanceManager.js";
import type { ResolvedConfig } from "../config/types.js";
import { TOOL_TIMEOUTS } from "../config/types.js";
import { normalizeError } from "../mcp/errors.js";
import { ExploreParams, type ExploreParamsType } from "./schemas.js";
import type { McpToolResult } from "../mcp/types.js";

const EXPLORE_DESCRIPTION = `<WHY>
Don't read blind. Traditional search finds most results—you answer confidently but with gaps. Users run subagents to verify, wasting tokens. Explore searches wide first, so you see what exists before answering. No blind spots, no verification tax.
</WHY>

<INTENT>
Intent matches your knowledge state—and controls how tokens are spent.

**Inventory**: What exists here?
Survey mode—see into files through headlines and tags without reading them. Breadth over depth. Keywords optional; when provided, they rank results but you still see the full landscape.
→ tokenBudget=1000
→ tokenBudget=1000, keywords="failure" (ranked survey)

**Locate**: You know the concept, not the location.
Balanced—detail on matches, awareness of the rest. Enough context to decide what to read next.
→ tokenBudget=1500, keywords="login authentication"

**Inspect**: You know the target.
Depth with context—concentrates tokens on relevant content and its surroundings. Shows code snippets, line numbers.
→ tokenBudget=2500, keywords="token refresh JWT"

Workflow: Inventory → Locate → Inspect (accumulate knowledge, don't skip steps)
For synthesized understanding, use the explain tool instead.
</INTENT>

<PARAMETERS>
**tokenBudget** (required): How many tokens you're willing to spend. This is a bet—you don't know exactly what you'll get.
- Start low (500-1000) and increase if you need more
- Different scopes, intents, and content will consume budget differently
- The tool maximizes value within your budget, but outcomes vary
Consider the stakes: if an incomplete answer has serious consequences, bet more. When the cost of being wrong is low, bet small and iterate.

**keywords**: Search terms — code words and synonyms.
- "login authentication" — synonyms widen the net
- "cache invalidation TTL" — related terms that co-occur
- Avoid generic words: "layer", "flow", "strategy", "handling" match everywhere
- Optional for Inventory (survey mode)

**uriGlob**: Optional. Omit to search everywhere (the default and usually the best choice).
Only narrow when you already know where to look or need to exclude noise.
- file:///src/**/*.cs — C# files only
- file:///src/**;!**/tests/** — source without tests
- help://** — documentation only
- Combine with ; exclude with !

**boost**: Regex to elevate matches (demotes others relatively).
- (?i)interface|abstract — find contracts
- (?i)service|handler — find entry points
- Auth.*|Token.* — specific patterns

**penalize**: Regex to demote matches (doesn't exclude, just ranks lower).
- (?i)test|mock|spec|fake — demote test code
- (?i)generated|\\\\.g\\\\. — demote generated
- Case-insensitive: (?i), alternation: |
</PARAMETERS>

<LAYERED_APPROACH>
Combine parameters for precision:
1. uriGlob filters WHERE (path matching)
2. keywords finds WHAT (semantic search)
3. boost ranks UP (elevate matches)
4. penalize ranks DOWN (demote matches)

Example: Find auth implementations, not tests:
→ intent=Locate, keywords="authenticate authorize", penalize="(?i)test|mock"

Example: Find service contracts:
→ intent=Locate, keywords="service", boost="(?i)interface|abstract"
</LAYERED_APPROACH>

<QUICK_PATTERNS>
Ranked survey:
→ intent=Inventory, keywords="Controller", tokenBudget=3000

Find where something is:
→ intent=Locate, keywords="cache", tokenBudget=1500

Examine specific code:
→ intent=Inspect, keywords="cache invalidation", tokenBudget=2500

Find production code only:
→ intent=Locate, keywords="database connection", penalize="(?i)test|mock", tokenBudget=1500

Find contracts/interfaces:
→ intent=Locate, keywords="service", boost="(?i)interface|abstract", tokenBudget=1500

Narrow to a specific area (when needed):
→ intent=Inventory, uriGlob="help://**", tokenBudget=1000
</QUICK_PATTERNS>

<TIPS>
Results too noisy? Add penalize="(?i)test|mock" or narrow with uriGlob.
Too sparse? Increase tokenBudget or broaden keywords with synonyms.
</TIPS>`;

/**
 * Registers the repoql_explore tool.
 */
export function registerExploreTool(
  api: any,
  manager: InstanceManager,
  config: ResolvedConfig,
  getWorkdir: () => string
): void {
  api.registerTool({
    name: "repoql_explore",
    description: EXPLORE_DESCRIPTION,
    parameters: ExploreParams,
    async execute(_id: string, params: ExploreParamsType): Promise<McpToolResult> {
      try {
        const workdir = getWorkdir();
        const client = await manager.getInstance(workdir);
        const timeout = TOOL_TIMEOUTS.explore ?? config.defaultTimeoutMs;

        const args: Record<string, unknown> = {
          intent: params.intent,
          tokenBudget: params.tokenBudget,
        };

        if (params.uriGlob !== undefined) {
          args.uriGlob = params.uriGlob;
        }
        if (params.limit !== undefined) {
          args.limit = params.limit;
        }
        if (params.keywords !== undefined) {
          args.keywords = params.keywords;
        }
        if (params.boost !== undefined) {
          args.boost = params.boost;
        }
        if (params.penalize !== undefined) {
          args.penalize = params.penalize;
        }

        return await client.callTool("explore", args, timeout);
      } catch (err) {
        return normalizeError(err);
      }
    },
  });
}
