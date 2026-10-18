# Terawatt prop generation handoff

Spec: /Users/hunter/Dev/Terawatt/notes/PROPS.md (ids, sizes, budgets, articulated parts, materials).
Loop: RealityHD skill .claude/skills/realityhd-prop/SKILL.md (brief, new prop, build(seed:), lint, gate, signoff, thumbs).
Quality bar: ultra realistic, gate threshold 0.85. Breadth first: max 3 gate iterations, then mark [~] with score and move on. Polish pass later.

Lanes (separate clones, disjoint folders, never git stash / git worktree):
- ~/dev/RealityHD-lib-l1  branch terawatt-dc    Props/DataCenter, materials file Library/TerawattDC*.swift
- ~/dev/RealityHD-lib-l2  branch terawatt-fab   Props/Fab, materials file Library/TerawattFab*.swift
- ~/dev/RealityHD-lib-l3  branch terawatt-chip  Props/ChipLab, materials file Library/TerawattChip*.swift

Lane branches exist; work on them directly. No git pull or fetch (hangs). One prop per agent run.
New material keys from PROPS.md: add only in the lane's own file; key names as listed in PROPS.md.
Per batch: commit to lane branch, push, append to /Users/hunter/Dev/Terawatt/notes/PROGRESS.md:
`<lane> | <id> | gate score | tris | thumb path`.
Builds filtered: 2>&1 | grep -E "error:|warning:|BUILD" | head -40.
Shared-file edits (MaterialSpec.swift, ShaderSource.swift): one-line appends only; l1 already touched both.
Queue: notes/PROP_QUEUE.md. On finish mark the prop [x] (signed off) or [~] (built, unsigned + score).
verdict.json: scores are integers 0-10 (decimals fail to decode); format {"scores":{...},"notes":{...},"fixes":[...],"judge":"agent"} decodes (blanking-panel).
