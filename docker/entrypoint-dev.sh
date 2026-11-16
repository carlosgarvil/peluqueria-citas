#!/bin/sh
set -e
# Si package.json cambió desde que se creó el volumen de node_modules, instala lo nuevo.
npm install --no-audit --no-fund
npx prisma migrate deploy
exec npm run dev
