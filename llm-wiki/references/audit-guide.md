# Audit Guide — human feedback on wiki content

The `audit/` directory is the human feedback surface. One file per feedback, YAML frontmatter + markdown body. Feedback is produced by the Obsidian plugin, the web viewer, or **directly by the human telling the AI** (the AI writes the audit file).

## Two modes

The audit system supports two modes:

- **Simple mode** — Just a markdown file with a comment. No frontmatter required beyond an optional `target:` field. Works for small wikis where the LLM and human have enough context to locate the issue without line-level anchoring.
- **Full mode** — Full YAML frontmatter with anchor window (`anchor_before`, `anchor_text`, `anchor_after`). Required for large wikis where text drift makes line numbers unreliable.

Pick the mode that fits your wiki size and feedback volume. You can mix both.

## Why it exists

AI-written content is wrong sometimes. Raw sources contradict each other. Feedback in chat is lost the moment the conversation ends. The audit directory gives corrections a permanent, location-anchored home that every tool (Obsidian plugin, web viewer, AI, lint script) understands.

## Directory layout

```
<wiki-root>/audit/
├── 20260409-143022-claude-code-size.md    ← open feedback
├── 20260409-150110-rag-definition.md      ← open feedback
└── resolved/
    ├── 20260408-110505-typo-gemma.md      ← processed, with resolution
    └── 20260407-180012-rejected-scope.md  ← rejected, with rationale
```

- `audit/*.md` — open feedback, not yet processed.
- `audit/resolved/*.md` — processed feedback. Nothing ever gets deleted; rejections stay with their rationale.

## File format

Filename: `YYYYMMDD-HHMMSS-<short-slug>.md`. The prefix is the creation timestamp (local time); the slug is a human-readable hint derived from the selected text or the comment.

```markdown
---
id: 20260409-143022-a1b2
target: tech/Claude_Code.md
target_lines: [45, 52]
anchor_before: "## 技术概览\n\n| 维度 | 详情 |\n|------|------|\n"
anchor_text: "| **规模** | ~1,900 个文件，512,000+ 行代码 |"
anchor_after: "\n| **语言** | TypeScript（strict 模式） |"
severity: warn
author: lewis
source: obsidian-plugin
created: 2026-04-09T14:30:22+08:00
status: open
---

# Comment

实际应该是 ~1,800 个文件，参考 2026-03-31 commit abc123 的 tree。
`find . -type f | wc -l` 当时是 1817。这个数字直接影响下面几个估算。

# Resolution

<!-- Filled in when the audit is processed and moved to resolved/ -->
```

### Frontmatter fields

**Full mode fields** (all required for full mode):

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Unique id: `YYYYMMDD-HHMMSS-<4hex>`. Must match filename prefix. |
| `target` | string | yes | Path relative to wiki root. Must be a file that exists (lint check). |
| `target_lines` | `[int, int]` | full | Best-effort 1-indexed inclusive line range at the time of writing. May drift. |
| `anchor_before` | string | full | Up to ~80 chars of text immediately before the selection. Verbatim, preserves newlines. |
| `anchor_text` | string | full | The exact selected text. Verbatim. |
| `anchor_after` | string | full | Up to ~80 chars of text immediately after the selection. Verbatim. |
| `severity` | enum | yes | One of `info`, `suggest`, `warn`, `error`. |
| `author` | string | yes | Free text. The Obsidian plugin defaults to the OS username; the web viewer has a config. |
| `source` | enum | yes | One of `obsidian-plugin`, `web-viewer`, `manual`. |
| `created` | ISO 8601 | yes | Timestamp with timezone. |
| `status` | enum | yes | `open` for files in `audit/`, `resolved` for files in `audit/resolved/`. |

**Simple mode** — only `target` and `severity` are needed (though any subset works). The AI reads the comment body and uses conversational context + its own search to locate the issue. Example:

```markdown
---
target: concepts/Market_Making.md
severity: warn
---

The inventory risk formula seems wrong. The paper says it should be sqrt(variance * dt), not variance * dt.
```

### Severity semantics

- **info** — "worth noting but not wrong". Example: additional context, alternate phrasing.
- **suggest** — "consider this". Example: reword, reorganize.
- **warn** — "something looks off". Example: stale number, ambiguous sentence.
- **error** — "this is wrong". Example: factual mistake, broken link, wrong attribution.

The AI should process `error` and `warn` first, then `suggest`, then `info`.

## Anchor strategy

Line numbers alone are fragile — any edit earlier in the file invalidates them. So every audit file carries a **text-based anchor window** alongside the line numbers.

On write (Obsidian plugin / web viewer):
1. Capture `target_lines` from the selection range.
2. Extract `anchor_text` = the exact selected characters.
3. Extract `anchor_before` = up to 80 characters immediately before the selection start (clamped to start of file).
4. Extract `anchor_after` = up to 80 characters immediately after the selection end (clamped to end of file).

On read (AI during `audit`, audit_review.py, both tools):
1. Try `target_lines` — check whether the text in that line range contains `anchor_text`.
2. If not, search the whole file for `anchor_text`. If exactly one match, use it.
3. If multiple matches, use `anchor_before + anchor_text + anchor_after` as a combined search key.
4. If still no match, the anchor is **stale** — flag to the user during the `audit` op. Do not silently drop; ask whether to re-anchor, reject, or archive.

This algorithm lives in `audit-shared/src/anchor.ts` and is the single source of truth for all tools.

## Processing workflow (the `audit` op)

See `SKILL.md` → "The five operations" → `audit` for the canonical version. In short:

1. `python3 scripts/audit_review.py <wiki-root> --open` → get a grouped list.
2. For each open audit:
   - Read the file, use the anchor to locate the range in the target.
   - Decide: accept / partial / reject / defer.
   - Apply edits in the target file (in the smallest edit that fixes the issue).
   - Append a `# Resolution` section to the audit file.
   - Flip `status: open` → `status: resolved` in the frontmatter.
   - Move the file to `audit/resolved/`.
   - Append a `## [HH:MM] audit | resolved <id> — <one-liner>` entry to `log/YYYYMMDD.md`.
3. If an audit is deferred (e.g., unresolvable contradiction), leave the file in `audit/` and add the question to `CLAUDE.md` "Open research questions" with a reference to the audit id.

## Resolution section format

```markdown
# Resolution

2026-04-10 · accepted.
Fixed the file count (was "~1,900", corrected to "~1,800" per commit abc123).
Updated: tech/Claude_Code.md lines 47–48.
Log: [[log/20260410#1430 audit]]
```

Fields:
- Date · decision (`accepted`, `partial`, `rejected`, `deferred`).
- 1–3 sentences on what you did and why.
- Which files were touched (for non-trivial edits).
- Pointer to the log entry.

For `rejected` audits: explain **why** — most often "out of scope per CLAUDE.md" or "contradicts more authoritative source X". Rejected audits still move to `resolved/` so they're not processed again, but they remain visible in case the scope changes.

## Tooling

- **`scripts/lint_wiki.py`** validates audit file shape and that every `target` file exists.
- **`scripts/audit_review.py`** lists and groups audits.
- **`plugins/obsidian-audit/`** writes audit files from inside Obsidian on selection.
- **`web/`** writes audit files from the local web viewer on selection.
- **`audit-shared/`** — TypeScript library implementing the schema, anchor algorithm, id generator, and YAML (de)serialization used by the plugin and the web server.

