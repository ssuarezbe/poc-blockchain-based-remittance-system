FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Expose Hardhat node port
EXPOSE 8545

CMD ["npx", "hardhat", "node"]
