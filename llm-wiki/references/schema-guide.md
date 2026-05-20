# CLAUDE.md Schema Guide

`CLAUDE.md` (also read as `AGENTS.md` by some tools) is the **schema document** for a wiki topic. It tells the LLM agent the scope, conventions, current state, and open questions — every session should start by reading it together with `wiki/index.md`.

## Why it matters

Without a schema, the LLM creates inconsistent page names, overlapping articles, and drifts from the wiki's intended scope. With a well-maintained schema, the LLM becomes a disciplined, consistent wiki maintainer.

**Co-evolve it with the wiki.** The schema isn't written once at setup and forgotten. It evolves as you explore — scope broadens, conventions improve, old questions get answered and new ones emerge. Update after every major compile, ingest batch, or structural change. If a file crashes against reality (e.g., a naming convention no longer fits), change the schema _and_ fix affected files. Karpathy's original Gist calls this out explicitly: "You and the LLM co-evolve [the schema] over time."

Separate from the log: the schema tracks **structure** (what should exist); the log tracks **history** (what happened when).

## Full template

```markdown
# <Topic Title> Knowledge Base

> Schema document — read at the start of every session together with wiki/index.md.

## Scope

What this wiki covers:
- <bullet list of included areas>

What this wiki deliberately excludes:
- <bullet list of out-of-scope areas>

## Operations

This wiki follows the llm-wiki skill's five operations: `compile`, `ingest`, `query`, `lint`, `audit`.
Every operation appends an entry to `log/YYYYMMDD.md`.

## Naming conventions

### Pages
- **Concept pages** (`wiki/concepts/`): Title Case noun phrases. E.g., "Market Making Strategy", not "market making" or "MarketMakingStrategy".
- **Folder-split concepts** (`wiki/concepts/<topic>/`): used when a topic would exceed ~1200 words as a single page. Contains `index.md` + one file per aspect.
- **Entity pages** (`wiki/entities/`): Proper names. E.g., "Andrej Karpathy", "Obsidian", "Avellaneda-Stoikov Model".
- **Summary pages** (`wiki/summaries/`): kebab-case source slug. E.g., "karpathy-llm-wiki-gist".

### Wikilinks
- Always use `[[Page Title]]` — exact page title, case-sensitive.
- For folder-split pages, link to the index: `[[concepts/Foo/index|Foo]]`.
- Link the first mention of every entity or concept. Do not link the same page more than twice per article.

### Frontmatter
Every wiki page has YAML frontmatter:
```yaml
---
title: <Page Title>
type: concept | entity | summary
created: YYYY-MM-DD
updated: YYYY-MM-DD
sources: [list of raw/ slugs this page draws from]
tags: [relevant tags]
---
```

### Diagrams and formulas
- All diagrams are **mermaid**. No ASCII art.
- All formulas are **KaTeX** (inline `$...$` or block `$$...$$`).

### Raw file policy
- Small text sources → copy into `raw/<subfolder>/`.
- Large binaries → create a pointer file at `raw/refs/<slug>.md` with `kind: ref` frontmatter and an `external_path` field. Do not copy the binary.

## Current articles

### Concepts
- [[<Concept Title>]] — one-line summary
- [[concepts/<Topic>/index|<Topic>]] — (folder-split) one-line summary
    - [[<Topic>/<aspect-1>]] — ...

### Entities
- [[<Entity Name>]] — one-line summary

### Summaries
- [[summaries/<slug>]] — source title (date)

## Open research questions

- <Questions that should drive future ingest/query work>
- <Things the wiki currently doesn't cover well>
- <Contradictions or gaps noticed between articles>

## Research gaps

Sources to ingest:
- [ ] <URL or paper title> — why it's relevant

## Audit backlog

Count of open audits per target (filled in after running `audit_review.py --open`):
- <file> — N open
- ...

## Notes for the LLM

<Any special instructions: tone, depth level, language (zh/en), how to handle contradictions, etc.>
```

## What makes a good schema

**Good scope definition** prevents sprawl. A wiki about "LLM memory techniques" should exclude "LLM training" even though they're related.

**Explicit naming conventions** keep wikilinks from breaking. If you decide concept pages use Title Case, enforce it — a broken wikilink is an orphan.

**Maintained article list** lets the LLM know what already exists before creating a new page. The most common error is creating duplicate articles with slightly different names.

**Open research questions** give the LLM direction. Without them, the LLM defaults to ingesting the most obvious sources and missing your actual questions.

**Audit backlog** surfaces what the human has flagged as wrong. The AI should glance at it at the start of every session to decide whether to run an `audit` op before ingesting new material.

## Update cadence

- After every new concept page: add to "Current articles".
- After every ingest batch: update "Sources to ingest" checklist.
- After every lint pass: update "Research gaps".
- After every audit pass: refresh the "Audit backlog" counts.
- Monthly: review scope, prune stale research questions.

