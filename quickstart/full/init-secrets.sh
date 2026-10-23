#!/bin/sh
# First-start initializer for the RunHive full deployment.
# Generates FRESH inter-service secrets and the LLM provider config.
# Nothing secret is ever committed to the repository: this directory is
# created locally on first start and listed in .gitignore.
set -eu

RT=/runtime-full
ST=/state-full
mkdir -p "$RT/runos-data" "$ST/llm-center/models" "$ST/llm-center/tenants" "$ST/llm-center-gateway" "$ST/base-models"

gen() {
  # gen <filename> — create a random 64-hex-char secret file if missing
  if [ ! -s "$RT/$1" ]; then
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$RT/$1"
    echo "" >> "$RT/$1"
  fi
}
gen runos-internal-secret.txt
gen runos-session-secret.txt
gen llm-center-internal-secret.txt
gen llm-center-runtime-secret.txt

if [ ! -s "$RT/providers.json" ]; then
  esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
  cat > "$RT/providers.json" <<EOF
{
  "qwen": {
    "name": "my-provider",
    "base_url": "$(esc "${RUNHIVE_LLM_BASE_URL:-}")",
    "model": "$(esc "${RUNHIVE_LLM_MODEL:-}")",
    "api_key": "$(esc "${RUNHIVE_LLM_API_KEY:-}")",
    "classes": [],
    "coord_space": "1000",
    "max_side": 1280,
    "timeout": 120,
    "extra_instruction": "",
    "unmatched": "skip",
    "extra_headers": {},
    "transport": "openai",
    "node_id": "",
    "port": 0,
    "api_path": "/v1/chat/completions"
  },
  "vlx": {
    "vlx_seek_enabled": false,
    "vlx_seek_transport": "",
    "vlx_seek_node_id": "",
    "vlx_seek_port": 0,
    "vlx_seek_base_url": "",
    "vlx_seek_token": "",
    "vlx_seek_task": "",
    "vlx_seek_lang": "zh"
  }
}
EOF
fi

# The gateway container runs as uid 1011 and the workspace containers write
# tenant state; keep the generated trees writable for the demo deployment.
chmod -R 777 "$RT" "$ST" 2>/dev/null || true
echo "runhive full init: secrets and state ready"
