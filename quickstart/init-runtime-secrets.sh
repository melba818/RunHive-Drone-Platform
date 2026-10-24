#!/bin/sh
# Generate fresh inter-service secrets for the local demo stack on first start.
# Only creates files that are missing or empty; never overwrites existing ones,
# so restarting the stack keeps the same secrets (and existing sessions valid).
set -eu
mkdir -p /runtime
for name in runos-internal-secret.txt runos-session-secret.txt llm-center-internal-secret.txt llm-center-runtime-secret.txt; do
  if [ ! -s "/runtime/$name" ]; then
    head -c 48 /dev/urandom | od -An -tx1 | tr -d " \n" > "/runtime/$name.tmp"
    echo >> "/runtime/$name.tmp"
    mv "/runtime/$name.tmp" "/runtime/$name"
  fi
done
