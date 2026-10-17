# ADR-002: Copy Cut-in's platform code instead of sharing a package

**Status:** Accepted
**Date:** 2026-10-17
**Deciders:** Nico (owner), Claude (builder)

## Context

Cut-in and Tipping Point need the same plumbing: the artifact publish script, the pre-publish
check, the guarded storage, the `sample` and `downloads` wrappers, the design tokens, and later
the number guard and the fake `sample` for tests. Both freeze on 22 Nov 2026, and Cut-in has the
earlier deadline (Smart City Expo, 3 to 5 Nov).

## Decision

Copy the files into this repo and let them diverge where needed. Each copied file keeps its
origin in its header comment where it changed.

## Options considered

### A: Copy (chosen)

Pros: no coupling between the freezes; a change for one app can't break the other during the
Expo week; each repo builds on its own. Cons: a fix in one copy has to be ported by hand.

### B: Shared npm workspace or git submodule

Pros: one source of truth. Cons: both repos must move together; a submodule adds a fetch that
the session proxy may throttle; any break lands in both apps at once, at the worst time.

## Trade-off analysis

The shared code is small (a few hundred lines) and stable. Coupling two deadlines to save that
much duplication is the wrong trade for five weeks. After the freeze, extracting a package is a
one-afternoon job if both apps continue.

## Consequences

- A bug found in shared plumbing gets fixed in both repos in the same session, noted in both
  changelogs.
- Revisit after 22 Nov.
