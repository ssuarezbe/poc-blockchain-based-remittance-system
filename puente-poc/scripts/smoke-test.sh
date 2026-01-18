#!/bin/bash
set -e

echo "🔍 Running Smoke Tests..."

# Check Backend
echo "Checking Backend (http://localhost:3000)..."
if curl -s http://localhost:3000/ | grep -q "Puente PoC Backend is Running!"; then
  echo "✅ Backend is UP"
else
  echo "❌ Backend is DOWN"
  exit 1
fi

# Check Blockchain
echo "Checking Blockchain (http://localhost:8545)..."
RPC_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"web3_clientVersion","params":[],"id":1}' http://localhost:8545)
if [[ $RPC_RESPONSE == *"result"* ]]; then
  echo "✅ Blockchain is UP"
else
  echo "❌ Blockchain is DOWN"
  return 1
fi

# Check Frontend
echo "Checking Frontend (http://localhost:5173)..."
if curl -s -f -o /dev/null http://localhost:5173; then
  echo "✅ Frontend is UP"
else
  echo "❌ Frontend is DOWN"
  exit 1
fi

echo "🚀 All Systems Operational!"
