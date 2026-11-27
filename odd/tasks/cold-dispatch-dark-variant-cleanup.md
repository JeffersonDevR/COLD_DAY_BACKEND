# Cold Dispatch — dead `dark:` variant removal

Objective: delete the ~900 inert `dark:` class tokens left over from the light-theme era.

Problem: the app once had a theme toggle. It was removed, and no element carries `.dark` any more, so every `dark:` token is dead code. `DESIGN.md` states the rule: "Don't ship a `dark:` variant. This system has exactly one appearance." The cost is not visual — it is that the tokens keep pointing at the *old* palette, so anyone who re-enables `.dark` would get a broken screen (after the ramp inversion, `dark:bg-slate-900` resolves to a near-white panel).

Why now: the palette migration is done, and this is the last piece of the old world still in the source.

## Scope

Authorized: `frontend/src/app/**/*.html` and `*.ts`.

Out of scope: `landing/`, `frontend/projects/mobile`, backend, and any token that is not a class.

## Method

Token-list transform, not regex delete. Each class list is split into whitespace-delimited tokens; tokens containing `dark:` are dropped along with the whitespace run before them; every other character is copied through. Three container forms had to be handled:

1. `class="…"`, `styleClass="…"`, `routerLinkActive="…"`, `[ngClass]="…"`.
2. `[class.dark:ring-950]="cond"` — the whole binding is deleted, since it exists only to style the dark variant.
3. Single-quoted class-list literals returned from TypeScript (`'bg-x dark:bg-y'`).

## Invariant

For every transformed list, the token sequence after must equal the token sequence before **minus exactly the tokens containing `dark:`**. Any deviation aborts that file. This makes render-neutrality a property of the transform rather than a hope.

## Tasks

- [x] **D1** — Dry run with the invariant; 0 failures.
- [x] **D2** — Apply: 917 tokens across 41 files.
- [x] **D3** — Confirm only legitimate `dark:` remain (JS object keys and a comment).
- [x] **D4** — Build and pixel-verify.

## Result

- 917 tokens removed from 41 files: 902 in templates, 15 in TypeScript.
- 4 `dark:` occurrences remain, all non-class: `dark: {` in the PrimeNG preset, two `{ dark: true }` in specs, one comment.
- 0 empty `class` attributes created.
- `npm run build`: complete, exit 0 (AOT template compilation passes, which also validates every edited binding).
- Diff: 47 files, 1 466 insertions / 1 740 deletions.

## Render-neutrality evidence

| capture | hash | size |
|---|---|---|
| before cleanup | `701D641E…` | 115 011 b |
| after, run 1 | `7D2B9AD9…` | 114 931 b |
| after, run 2 | `701D641E…` | 115 011 b |

Two captures of the *same* post-cleanup build hashed differently, so the run-1 delta was noise. Measured properly, it was 181 of 1 584 000 pixels (0.011%), max channel delta 128, clustered entirely on glyph edges in text. The second capture is byte-identical to the baseline.

Control experiment conclusion: the cleanup changed no rendered pixel.

## Next step

`clarify` — the copy pass (tuteo consistency, `estadoLabel` for filters, error copy). Then `adapt`, `audit`, `harden`, `polish`.
