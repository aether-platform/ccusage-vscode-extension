#!/bin/bash
set -e

echo "Installing dependencies with npm..."
npm install --save-dev @types/vscode@^1.74.0
npm install --save-dev @types/node@16.x
npm install --save-dev @typescript-eslint/eslint-plugin@^5.45.0
npm install --save-dev @typescript-eslint/parser@^5.45.0
npm install --save-dev eslint@^8.28.0
npm install --save-dev typescript@^4.9.4
npm install --save-dev webpack@^5.75.0
npm install --save-dev webpack-cli@^5.0.1
npm install --save-dev ts-loader@^9.4.1

npm install chokidar@^3.5.3

echo "Dependencies installed successfully!"
npm run compile