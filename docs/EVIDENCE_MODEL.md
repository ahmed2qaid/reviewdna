# ReviewDNA Evidence Model

ReviewDNA treats review history as evidence, not policy. The evidence model is intentionally conservative and explainable.

## Dispositions

Each retained rule evidence item can be classified as:

- `accepted` — explicit approval or an explicit positive response from the Pull Request author.
- `adopted` — deep evidence confirmed that the reviewed file changed after the referenced review commit.
- `acknowledged` — the review thread was resolved, but no stronger adoption signal is available.
- `unresolved` — no positive or negative disposition signal is available.
- `rejected-candidate` — a reviewable negative signal exists. This is deliberately not labeled definitive rejection.

## Rejected-candidate signals

A rejected candidate can currently come from either:

1. an explicit Pull Request author reply containing a conservative rejection phrase such as `won't fix`, `intentional`, `by design`, or `out of scope`; or
2. opt-in deep evidence showing that an inline comment was actually checked against the merged head, the referenced file did not change, and no stronger positive signal exists.

Explicit rejection is weighted more strongly than checked-but-unchanged inference.

ReviewDNA never treats a failed compare request as rejection. Failed or unavailable deep evidence remains unchecked.

## Positive evidence weights

The confidence model distinguishes positive signals instead of treating all resolved threads equally:

- accepted evidence: strongest;
- adopted code change: strong;
- resolved/acknowledged thread: weaker;
- unresolved: neutral.

Negative evidence is represented separately as `rejectedEvidencePenalty`, so users can see why confidence moved down.

## CODEOWNERS

When a CODEOWNERS file is available, ReviewDNA applies last-match precedence to find owners for an evidence path.

Only a direct owner such as `@alice` matching reviewer `alice` counts as direct CODEOWNER evidence. Team entries such as `@org/backend-team` are preserved during parsing but ReviewDNA does not guess team membership.

Direct CODEOWNER evidence can add up to 10 explainable confidence points based on the fraction of a rule's evidence reviewed by direct owners.

CODEOWNERS is ownership metadata, not prose documentation. It is therefore excluded from documentation-drift text matching.

## People analytics boundary

ReviewDNA does not compute best/worst developer scores, reviewer rankings, employee performance metrics, or team-member inference. Reviewer identity is used only to establish evidence diversity and direct CODEOWNERS relevance for a path.

## Calibration status

The current weights are heuristic and pre-v1. They are regression-tested but must still be calibrated against a real-world labeled review dataset before v1.0.
