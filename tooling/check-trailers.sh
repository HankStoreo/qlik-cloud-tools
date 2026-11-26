#!/bin/sh
# Rejects AI attribution: AI co-author trailers, Claude-Session lines, Claude session links, "Generated with ... Claude".
# A file argument checks that message (the commit-msg hook); "-" checks stdin (PR title and body in CI);
# --history checks every commit reachable from HEAD.
pattern='^(Co-authored-by:.*(Claude|anthropic\.com|Copilot|openai)|Claude-Session:)|claude\.ai/code/session|Generated with .*Claude'
if [ "$1" = "--history" ]; then
  text=$(git log --format='%H%n%B' HEAD) || exit 1
elif [ "$1" = "-" ]; then
  text=$(cat)
elif [ -n "$1" ]; then
  text=$(cat "$1") || exit 1
else
  echo "usage: check-trailers.sh <message-file> | - | --history" >&2
  exit 2
fi
bad=$(printf '%s\n' "$text" | grep -Ei "$pattern")
if [ -n "$bad" ]; then
  echo "AI attribution found; remove it:" >&2
  echo "$bad" >&2
  exit 1
fi
