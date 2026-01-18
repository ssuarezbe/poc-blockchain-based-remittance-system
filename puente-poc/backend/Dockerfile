FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build not strictly necessary for dev but good practice
RUN npm run build

EXPOSE 3000

# Start in dev mode
CMD ["npm", "run", "start:dev"]
