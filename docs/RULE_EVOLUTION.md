# ReviewDNA Rule Evolution

ReviewDNA treats engineering conventions as historical knowledge, not timeless strings. Rules can become more specific, split into scoped sub-rules, conflict for a period, or eventually be replaced by newer guidance.

The evolution model is deterministic and evidence-backed. It does not ask an LLM to invent a lineage.

## Relationship fields

Each rule can include an optional `relationships` object:

```json
{
  "parentFingerprint": "rdna-api-design-...",
  "childFingerprints": ["rdna-api-design-..."],
  "supersedesFingerprints": ["rdna-api-design-..."],
  "supersededByFingerprint": "rdna-api-design-..."
}
```

Relationships use rule fingerprints instead of `RULE-0001` style ids because numbered ids can change when result ordering changes.

## Parent and child rules

A parent/child relationship is intentionally conservative. The current `relationships-v1` model requires:

1. the same ReviewDNA category;
2. the same positive/negative polarity;
3. meaningful concept overlap; and
4. a clearly broader scope for the parent.

For example, a repository-wide API validation convention can become the parent of a narrower `src/**` convention when their concepts overlap.

The model does not call two same-scope paraphrases parent and child merely because one sentence is longer.

## Supersession

Supersession is stronger than a conflict and therefore requires stronger evidence.

A newer rule can supersede an older rule only when:

- both rules belong to the same category;
- they express opposite guidance over sufficiently similar concepts;
- the newer rule's evidence window begins after the older rule's evidence window ends;
- the newer rule has at least two evidence items;
- the newer rule has sufficient confidence and is not materially weaker than the older rule.

If the evidence windows overlap, ReviewDNA does **not** infer supersession. Both rules remain active and may be surfaced as a dispute/conflict instead.

When supersession is detected, the older rule receives status `superseded`, the replacement links back through `supersedesFingerprints`, and the historical pair is excluded from active conflict penalties.

## Timeline

Every discovered rule can include an ordered `timeline` built directly from its evidence:

- `introduced` — first evidence for the convention;
- `reinforced` — another evidence item without a stronger disposition;
- `adopted` — accepted/adopted evidence;
- `rejected-signal` — a conservative rejected-candidate evidence item;
- `superseded` — a later convention replaced this rule.

Timeline entries preserve evidence ids and Pull Request numbers when available. A superseded event carries the replacement fingerprint.

The timeline is a view over existing provenance. It does not create new evidence.

## Watch mode

Snapshot comparison now reports relationship changes as normal lifecycle metadata:

- `parent-rule`
- `child-rules`
- `superseded-by`
- `supersedes`
- `timeline`

This lets scheduled Watch runs surface convention evolution without treating a historical replacement as a completely unrelated new rule.

## Dashboard

The static dashboard exposes:

- Parent rules count
- Child rules count
- Superseded rules count
- relationship badges on each rule
- an expandable evidence-derived timeline

## Compatibility

The analysis schema remains `1.0`. Relationship, timeline, evolution-summary, and `evolutionModel` fields are optional additions so older consumers can continue reading the existing required fields.

## Current limits

`relationships-v1` favors precision over recall. It will miss some real replacements, especially same-polarity technology migrations such as one tool replacing another without explicit opposite wording.

Future versions can use richer historical and semantic signals, but any stronger inference must remain traceable to evidence and regression-tested against labeled repositories.
