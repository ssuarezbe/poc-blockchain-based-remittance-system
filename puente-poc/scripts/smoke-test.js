const http = require('http');

const config = {
    backend: { host: 'backend', port: 3000, path: '/' },
    blockchain: { host: 'blockchain', port: 8545, method: 'POST' },
    frontend: { host: 'frontend', port: 5173, path: '/' }
};

async function checkService(name, options) {
    return new Promise((resolve, reject) => {
        const reqOptions = {
            hostname: options.host,
            port: options.port,
            path: options.path || '/',
            method: options.method || 'GET',
            headers: options.method === 'POST' ? { 'Content-Type': 'application/json' } : {}
        };

        const req = http.request(reqOptions, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 500) {
                console.log(`✅ ${name} is UP (${res.statusCode})`);
                resolve(true);
            } else {
                console.log(`❌ ${name} returned status ${res.statusCode}`);
                reject(new Error(`Status ${res.statusCode}`));
            }
        });

        req.on('error', (e) => {
            console.log(`❌ ${name} check failed: ${e.message}`);
            reject(e);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
        });

        if (name === 'blockchain') {
            req.write(JSON.stringify({ jsonrpc: "2.0", method: "web3_clientVersion", params: [], id: 1 }));
        }

        req.end();
    });
}

async function run() {
    console.log("🔍 Running Containerized Smoke Tests...");

    // Retry logic helper
    const checkWithRetry = async (name, conf, retries = 10) => {
        for (let i = 0; i < retries; i++) {
            try {
                await checkService(name, conf);
                return;
            } catch (e) {
                if (i === retries - 1) throw e;
                console.log(`⚠️ ${name} not ready, retrying (${i + 1}/${retries})...`);
                await new Promise(r => setTimeout(r, 5000));
            }
        }
    };

    try {
        await checkWithRetry('Backend', config.backend);
        await checkWithRetry('Blockchain', config.blockchain);
        await checkWithRetry('Frontend', config.frontend);
        console.log("🚀 All Systems Operational inside container network!");
    } catch (error) {
        console.error("🔥 Smoke Tests Failed");
        process.exit(1);
    }
}

run();
