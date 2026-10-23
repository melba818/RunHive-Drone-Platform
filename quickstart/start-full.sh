#!/bin/sh
# RunHive FULL one-click start: portal + RunOS + LLM center + Agent platform.
# Usage:  ./start-full.sh
# Stop:   docker compose -f docker-compose.full.yml down
set -e
cd "$(dirname "$0")"

# The LLM control plane spawns per-account workspace containers through the
# Docker socket and must know this repository's absolute host paths.
export RUNHIVE_HOST_ROOT="$(cd .. && pwd)"

mkdir -p runtime-full state-full/llm-center state-full/llm-center-gateway state-full/base-models

echo "Building images (first run takes a while)..."
docker compose -f docker-compose.full.yml --profile build build

echo "Starting the full stack..."
docker compose -f docker-compose.full.yml up -d

PORT="${DEMO_PORT:-1819}"
RUNOS_PORT="${RUNOS_PORT:-14000}"
echo ""
echo "RunHive full deployment is starting:"
echo "  Portal:  http://localhost:${PORT}/        (demo account: admin / runhive-demo)"
echo "  RunOS:   opened from the portal app center (direct: http://localhost:${RUNOS_PORT}/)"
echo "  LLM center and Agent center: opened from the portal app center."
echo "First start of a fine-tuning workspace can take a few minutes while its"
echo "container loads the training stack."
