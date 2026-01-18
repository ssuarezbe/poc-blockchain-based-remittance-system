import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useContract } from '../hooks/useContract';
import { remittancesApi, Remittance, ContractConfig } from '../services/api';
import RemittanceCard from '../components/RemittanceCard';
import ConnectWallet from '../components/ConnectWallet';

export default function Dashboard() {
    const { token } = useAuth();
    const [remittances, setRemittances] = useState<Remittance[]>([]);
    const [config, setConfig] = useState<ContractConfig | null>(null);
    const [balance, setBalance] = useState<string>('0');
    const [loading, setLoading] = useState(true);

    const contract = useContract(config);

    // Load config and remittances
    useEffect(() => {
        async function load() {
            if (!token) return;

            try {
                const [remittancesData, configData] = await Promise.all([
                    remittancesApi.getAll(token),
                    remittancesApi.getConfig(token),
                ]);

                setRemittances(remittancesData);
                setConfig(configData);
            } catch (err) {
                console.error('Failed to load data:', err);
            } finally {
                setLoading(false);
            }
        }

        load();
    }, [token]);

    // Load balance when connected
    useEffect(() => {
        if (contract.address) {
            contract.getUsdcBalance().then(setBalance);
        }
    }, [contract.address]);

    if (loading) {
        return <div className="text-center py-8">Loading...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <Link
                    to="/new"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                    New Remittance
                </Link>
            </div>

            {/* Wallet Connection */}
            <div className="bg-white rounded-lg shadow p-4">
                <ConnectWallet
                    address={contract.address}
                    balance={balance}
                    onConnect={contract.connect}
                    onDisconnect={contract.disconnect}
                    onFaucet={contract.faucet}
                    isConnecting={contract.isConnecting}
                    error={contract.error}
                />
            </div>

            {/* Remittances List */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Your Remittances</h2>

                {remittances.length === 0 ? (
                    <p className="text-gray-500">No remittances yet. Create your first one!</p>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {remittances.map((remittance) => (
                            <RemittanceCard
                                key={remittance.id}
                                remittance={remittance}
                                contract={contract}
                                token={token!}
                                onUpdate={(updated) =>
                                    setRemittances((prev) =>
                                        prev.map((r) => (r.id === updated.id ? updated : r))
                                    )
                                }
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
