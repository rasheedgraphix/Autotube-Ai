FROM node:22-bookworm-slim

# Install ffmpeg and fonts for video generation
RUN apt-get update && apt-get install -y ffmpeg fontconfig fonts-liberation && fc-cache -f -v && rm -rf /var/lib/apt/lists/*

ENV FONTCONFIG_PATH=/etc/fonts

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000 8080
CMD ["npm", "start"]
