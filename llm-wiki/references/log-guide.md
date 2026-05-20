# Log Guide — the `log/` folder

The wiki's operation log is a **folder**, not a single file. One file per day, named `log/YYYYMMDD.md`. This keeps individual files small, makes daily activity easy to scan, and plays well with git diffs.

## File naming

- Filename: `log/YYYYMMDD.md` (e.g., `log/20260409.md`)
- Regex: `^\d{8}\.md$`
- No other files are allowed at the top of `log/`. `scripts/lint_wiki.py` will flag stray files.

## File format

```markdown
# 2026-04-09

## [09:15] ingest | google-gemma-4-article
- Source: raw/articles/google-gemma-4.md
- Touched: 5 wiki pages
  - summaries/google-gemma-4 (new)
  - concepts/Gemma.md (updated)
  - entities/Google.md (updated)
  - entities/Gemma 4.md (new)
  - index.md (updated)

## [14:30] audit | resolved 20260409-143022-a1b2
- Target: tech/Claude_Code.md
- Change: corrected file count from ~1,900 to ~1,800 per commit abc123
- Moved to: audit/resolved/20260409-143022-a1b2.md

## [15:05] lint | 2 dead links found, 2 fixed
- [[Claude Code Architecture]] → [[tech/claude-code/Claude_Code_Architecture]] in 2 files
```

Rules:
- One H1 per file, matching the filename date in ISO format (`YYYY-MM-DD`).
- One H2 per operation, starting with `## [HH:MM] <op> | <one-line description>`.
- Time is local time, 24h.
- Body is a short bullet list summarising what changed. Link to the files touched with wikilinks.

## Ops allowed in the log

| Op | When it appears | Example |
|---|---|---|
| `compile`  | Structural edits, splits, merges, index rebuild | `## [10:00] compile \| split Claude Code page into 7 sub-pages` |
| `ingest`   | New source added to `raw/`, wiki updated | `## [09:15] ingest \| google-gemma-4-article` |
| `query`    | Question answered, output file written | `## [11:20] query \| rag-vs-llm-wiki-tradeoffs` |
| `promote`  | Output promoted to `wiki/concepts/` | `## [11:35] promote \| RAG vs LLM Wiki (from query)` |
| `lint`     | Lint run with issues fixed | `## [15:05] lint \| 2 dead links found, 2 fixed` |
| `audit`    | Feedback applied and moved to `audit/resolved/` | `## [14:30] audit \| resolved 20260409-143022-a1b2` |
| `split`    | A single page split into a folder | `## [10:00] split \| Claude Code → claude-code/` |
| `scaffold` | Initial wiki setup | `## [08:00] scaffold \| Initialized Topic knowledge base` |

## Design goal: grep-ability

The prefix convention — `## [HH:MM] <op> | <one-line>` — is intentional: it makes the entire operation history **grep-able** with simple Unix tools. The LLM doesn't need a database to answer "what happened last week".

## Quick grep

```bash
# All operations on a day
cat log/20260409.md

# Recent activity across all days
grep -rh "^## \[" log/ | sort | tail -20

# All audit resolutions
grep -rh "^## \[.*\] audit" log/

# Activity on a specific file
grep -rl "Claude_Code" log/
```

## Migration from single-file `log.md`

If you have an existing `log.md` (from the v1 skill), convert it:

1. Parse each `## [YYYY-MM-DD] op | description` header.
2. Group entries by date.
3. For each date `D`, create `log/D.md` with an H1 of the date and H2s for each op — convert `[YYYY-MM-DD]` to `[HH:MM]` (use `00:00` if no time recorded).
4. Delete the old `log.md`.

This is a one-time manual operation; the skill doesn't automate it.

## What not to put in the log

- **Content**: don't copy-paste chunks of the article you wrote into the log. The log is a pointer, not a diary.
- **Long rationale**: put design decisions and rationale in `CLAUDE.md` "Notes for the LLM", not in the log.
- **Secrets / credentials**: never.
- **Audit file bodies**: only the audit ID and a one-liner. The audit file itself already has the full content.

