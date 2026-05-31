FROM node:20-slim

# Install ffmpeg and ffprobe (required for HLS transcoding)
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first for Docker caching
COPY package.json package-lock.json* ./
RUN npm install

# Copy backend source code
COPY src/ ./src/

EXPOSE 3000

CMD ["npm", "start"]
