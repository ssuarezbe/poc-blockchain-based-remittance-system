import { Remittance, remittancesApi } from '../services/api';

interface Props {
    remittance: Remittance;
    contract: ReturnType<typeof import('../hooks/useContract').useContract>;
    token: string;
    onUpdate: (updated: Remittance) => void;
}

const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-800',
    created: 'bg-yellow-100 text-yellow-800',
    funded: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    refunded: 'bg-red-100 text-red-800',
};

export default function RemittanceCard({ remittance, contract, token, onUpdate }: Props) {
    const handleFund = async () => {
        if (!contract.address || !remittance.blockchainId) return;

        try {
            await contract.approveUsdc(remittance.amountUsdc);
            const txHash = await contract.deposit(remittance.blockchainId);

            const updated = await remittancesApi.update(
                remittance.id,
                { txHashFund: txHash, status: 'funded' },
                token
            );
            onUpdate(updated);
        } catch (err) {
            console.error('Failed to fund:', err);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <p className="font-semibold">{remittance.recipientName}</p>
                    <p className="text-sm text-gray-500">{remittance.recipientId}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${statusColors[remittance.status] || 'bg-gray-100'}`}>
                    {remittance.status}
                </span>
            </div>

            <div className="text-sm space-y-1">
                <p>
                    <span className="text-gray-500">Amount:</span> {remittance.amountUsdc} USDC →{' '}
                    {remittance.amountCop.toLocaleString()} COP
                </p>
                <p>
                    <span className="text-gray-500">Rate:</span> {remittance.exchangeRate} COP/USD
                </p>
                <p>
                    <span className="text-gray-500">Created:</span>{' '}
                    {new Date(remittance.createdAt).toLocaleDateString()}
                </p>
            </div>

            {remittance.status === 'created' && contract.address && (
                <button
                    onClick={handleFund}
                    className="mt-3 w-full bg-blue-600 text-white py-1 rounded text-sm hover:bg-blue-700"
                >
                    Fund Remittance
                </button>
            )}

            {remittance.txHashFund && (
                <a
                    href={`https://amoy.polygonscan.com/tx/${remittance.txHashFund}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline mt-2 block"
                >
                    View on Explorer
                </a>
            )}
        </div>
    );
}
