<!-- DO NOT EDIT — generated from agent-src/includes/ticketing-github.md; run `node agent-src/generate.mjs` -->

# Ticketing: GitHub Issues

Generated from `agent-src/includes/ticketing-github.md` for relax — do not edit by hand.
Use the `gh` CLI for every ticket operation. Issues live in `marxxxx/relax`.

## Read

```bash
gh issue view <number> --repo marxxxx/relax --comments
```

## Create

Created straight into `status:in-progress`; the command prints the issue URL, whose last segment
is the number.

```bash
cat <<'BODY_EOF' | gh issue create --repo marxxxx/relax --title "<title>" \
  --label "status:in-progress" --body-file -
<a few sentences summarizing the spec; spec path>
BODY_EOF
```

## Comment

```bash
cat <<'BODY_EOF' | gh issue comment <number> --repo marxxxx/relax --body-file -
## <Title>
...
BODY_EOF
```

## Post the spec

Post the agreed scope as a readable comment: heading, the spec path if there is one, then the full
text. If it exceeds GitHub's 65,536-character comment limit, split it at heading boundaries into
numbered comments (`## Approved Spec (1/2)`, …), each repeating the path line.

```bash
{ printf '## Approved Spec\n`<spec path>`\n\n'; cat <spec path>; } \
  | gh issue comment <number> --repo marxxxx/relax --body-file -
```

## Status

Status is a label; a transition swaps the old label for the new one.

| Label | Meaning |
|---|---|
| `status:new` | Ready to build |
| `status:in-progress` | agent-dev is working on it |
| `status:review` | Work finished; awaiting human review and acceptance |

```bash
gh issue edit <number> --repo marxxxx/relax --remove-label "status:new" --add-label "status:in-progress"
gh issue edit <number> --repo marxxxx/relax --remove-label "status:in-progress" --add-label "status:review"
```

Never close an issue — that is the human's acceptance.

## Pull Requests

Always open PRs as drafts; the human reviewer publishes them after reviewing and testing.

```bash
gh pr create --draft --repo marxxxx/relax --base main --head <branch> \
  --title "<pr-title>" --body-file <file>
```
