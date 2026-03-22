FROM node:20-slim

# Install Playwright's system dependencies + Chromium
RUN npx playwright install chromium --with-deps

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3001

CMD ["node", "server.js"]
