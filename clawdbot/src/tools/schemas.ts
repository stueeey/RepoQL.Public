/**
 * TypeBox schemas for tool parameters.
 *
 * Purpose: Provides validated parameter schemas for all RepoQL tools.
 * Complexity: Standard TypeBox schema definitions.
 */

import { Type, type Static } from "@sinclair/typebox";

/**
 * Schema for repoql_explore tool parameters.
 */
export const ExploreParams = Type.Object({
  intent: Type.Union(
    [
      Type.Literal("Inventory"),
      Type.Literal("Locate"),
      Type.Literal("Inspect"),
      Type.Literal("Explain"),
    ],
    {
      description:
        "Knowledge state: Inventory (discover), Locate (find), Inspect (structure), Explain (synthesize)",
    }
  ),
  tokenBudget: Type.Number({
    description: "Tokens to invest in response (800-5000 typical)",
  }),
  uriGlob: Type.Optional(
    Type.String({
      description: "URI glob pattern to filter results (e.g., file:///src/**/*.cs). Combine with ; exclude with !",
    })
  ),
  keywords: Type.Optional(
    Type.String({
      description: "Search terms - questions work best",
    })
  ),
  boost: Type.Optional(
    Type.String({
      description: "Regex patterns to boost (e.g., (?i)auth|token)",
    })
  ),
  penalize: Type.Optional(
    Type.String({
      description: "Regex patterns to demote (e.g., (?i)test|mock)",
    })
  ),
  limit: Type.Optional(
    Type.Number({
      description: "Cap results shown. Leave blank to have explore optimize it.",
    })
  ),
});

export type ExploreParamsType = Static<typeof ExploreParams>;

/**
 * Schema for repoql_query tool parameters.
 */
export const QueryParams = Type.Object({
  sql: Type.String({
    description: "DuckDB SQL query (use Files, Functions, Types, Annotations views)",
  }),
  tokenBudget: Type.Optional(
    Type.Number({
      description: "Token budget for response (default: 15000)",
      default: 15000,
    })
  ),
});

export type QueryParamsType = Static<typeof QueryParams>;

/**
 * Schema for repoql_read tool parameters.
 */
export const ReadParams = Type.Object({
  uri: Type.String({
    description:
      "URI or glob (e.g., file:///src/Auth.cs). Append ' => question: <question>' for LLM synthesis.",
  }),
  tokenBudget: Type.Number({
    description: "Token budget - controls representation depth",
  }),
});

export type ReadParamsType = Static<typeof ReadParams>;

/**
 * Schema for repoql_import tool parameters.
 */
export const ImportParams = Type.Object({
  uri: Type.String({
    description:
      "URI to import (e.g., github://owner/repo@ref). Prefix with '-' to remove an import.",
  }),
});

export type ImportParamsType = Static<typeof ImportParams>;
