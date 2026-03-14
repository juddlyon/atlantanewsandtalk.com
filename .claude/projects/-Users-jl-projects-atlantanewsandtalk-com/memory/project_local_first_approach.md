---
name: Local-first updater approach
description: Start with a local script to update news digest, migrate to Netlify function later
type: project
---

The news fetching/summarization workflow should start as a local script (run via Claude Code or CLI) rather than a Netlify function. Once stable, migrate to a Netlify scheduled function.

**Why:** Easier to iterate, debug, and test locally. No API key costs during development since Claude Code subscription covers it.

**How to apply:** Build a local update script first. The Netlify function exists but is secondary. The workflow is: run local script → updates digest JSON → commit & push → Netlify auto-rebuilds.
