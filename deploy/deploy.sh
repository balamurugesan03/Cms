#!/usr/bin/env bash
# Run on the server from the project root to pull & redeploy:  bash deploy/deploy.sh
set -euo pipefail
git pull origin main
npm --prefix server ci --omit=dev
npm --prefix client ci
npm --prefix client run build          # uses client/.env.production -> base /cms/
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
echo "✔ Deployed: https://unizova.com/cms/"
