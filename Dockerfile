FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY sdk/package.json sdk/
RUN cd sdk && npm install
COPY . .
