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

// Simple copy to clipboard helper
const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(console.error);
};

export default function RemittanceCard({ remittance, contract, token, onUpdate }: Props) {
    const handleFund = async () => {
        // contract.address is always present in server-managed mode, but keeping check is fine
        if (!contract.address || !remittance.blockchainId) return;

        try {
            // Server-managed: We don't need to approve USDC on client side.
            // We just call the deposit method which maps to backend API.
            // The backend handles the blockchain tx and status update.
            await contract.deposit(remittance.id, remittance.amountUsdc);

            // We don't need to manually update via API because the contract.deposit (which calls backend /fund) 
            // does the action. However, to update the UI local state immediately, we can fake it or re-fetch.
            // But since onUpdate expects a full object, we might need to fetch the updated remittance
            // or just assume success and update status.

            // Ideally backend returns the updated remittance. 
            // Let's modify useContract.deposit to return the result if possible, but for now
            // we will just optimistically update the UI or reload.

            // For now, let's just trigger an update with 'funded' status
            onUpdate({
                ...remittance,
                status: 'funded',
                // We don't have the txHash immediately unless we change return type of deposit
                // But that's fine for UI feedback.
            });

        } catch (err) {
            console.error('Failed to fund:', err);
            // Could show error toast here
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
            {/* ID Display for Receiver Flow */}
            <div className="mt-4 p-2 bg-gray-50 rounded border border-gray-100 text-xs">
                <div className="flex justify-between items-center text-gray-500 mb-1">
                    <span>Remittance ID</span>
                    <button
                        onClick={() => copyToClipboard(remittance.id)}
                        className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                    >
                        Copy
                    </button>
                </div>
                <code className="block w-full overflow-hidden text-ellipsis font-mono text-gray-700 bg-white px-2 py-1 rounded border border-gray-200">
                    {remittance.id}
                </code>
            </div>

            {remittance.status === 'created' && contract.address && (
                <button
                    onClick={handleFund}
                    disabled={contract.isConnecting}
                    className={`mt-3 w-full text-white py-1 rounded text-sm ${contract.isConnecting
                        ? 'bg-blue-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                >
                    {contract.isConnecting ? 'Processing...' : 'Fund Remittance'}
                </button>
            )}

            {remittance.txHashFund && (
                <div className="mt-2">
                    {import.meta.env.VITE_BLOCK_EXPLORER_URL ? (
                        <a
                            href={`${import.meta.env.VITE_BLOCK_EXPLORER_URL}/tx/${remittance.txHashFund}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline block"
                        >
                            View on Explorer
                        </a>
                    ) : (
                        <span className="text-xs text-gray-400 block" title="Local Network - No Explorer">
                            Tx: {remittance.txHashFund.substring(0, 10)}...
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
