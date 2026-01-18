export default () => ({
    port: parseInt(process.env.PORT, 10) || 3000,
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_DATABASE || 'puente',
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    blockchain: {
        rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'https://rpc-amoy.polygon.technology',
        chainId: parseInt(process.env.CHAIN_ID, 10) || 80002,
        escrowAddress: process.env.ESCROW_ADDRESS || process.env.ESCROW_CONTRACT_ADDRESS,
        usdcAddress: process.env.USDC_ADDRESS,
        operatorPrivateKey: process.env.OPERATOR_PRIVATE_KEY,
    },
});
