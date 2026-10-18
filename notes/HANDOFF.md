# Terawatt prop generation handoff

Spec: /Users/hunter/Dev/Terawatt/notes/PROPS.md (ids, sizes, budgets, articulated parts, materials).
Loop: RealityHD skill .claude/skills/realityhd-prop/SKILL.md (brief, new prop, build(seed:), lint, gate, signoff, thumbs).
Quality bar: ultra realistic, gate threshold 0.85. Breadth first: max 3 gate iterations, then mark [~] with score and move on. Polish pass later.

Lanes (separate clones, disjoint folders, never git stash / git worktree):
- ~/dev/RealityHD-lib-l1  branch terawatt-dc    Props/DataCenter, Structures/DataCenter, materials Library/TerawattDC*.swift
- ~/dev/RealityHD-lib-l2  branch terawatt-fab   Props/Fab, materials Library/TerawattFab*.swift
- ~/dev/RealityHD-lib-l3  branch terawatt-chip  Props/ChipLab, then Props/DataCenterSite (off-world + site), materials Library/TerawattChip.swift, Library/TerawattSite.swift

Lane branches exist; work on them directly. No git pull or fetch (hangs). Commit only your own files.
New material keys from PROPS.md: add only in the lane's own file; key names as listed in PROPS.md.
Shared-file edits (MaterialSpec.swift, ShaderSource.swift): one-line appends only.
Per prop: commit, push, append to /Users/hunter/Dev/Terawatt/notes/PROGRESS.md:
`<lane> | <id> | gate score | tris | thumb path`.
Queue: notes/PROP_QUEUE.md. On finish mark [x] (signed off) or [~] (built, unsigned + score).
Builds filtered: 2>&1 | grep -E "error:|warning:|BUILD" | head -40.

Pitfalls:
- verdict.json criteria scores are integers 0-10 (decimals fail to decode); validate with python3 -m json.tool before gating.
- PreviewHint.distance is a camera scale multiplier (default 1.0), not meters.
- Bevel edges 2-5 mm and add wear (scuffs at handles, fingerprints on glass); edges/wear floors fail most often.
- Keep tris within budget; use low-poly bolt helpers for large assemblies.
- l3 Site also owns DC outdoor yard: dry-cooler, chiller-unit, cooling-tower-cell, transformer-pad, generator-container, smr-module, fuel-cell-bank, perimeter-fence, dc-roof-mech (Props/DataCenterSite). l1 skips them.
