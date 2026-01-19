import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useContract } from '../hooks/useContract';
import { remittancesApi, ratesApi, ContractConfig } from '../services/api';

export default function NewRemittance() {
    const { token } = useAuth();
    const navigate = useNavigate();

    const [config, setConfig] = useState<ContractConfig | null>(null);
    const contract = useContract(config);

    const [recipientId, setRecipientId] = useState('');
    const [recipientName, setRecipientName] = useState('');
    const [amountUsdc, setAmountUsdc] = useState('');
    const [rate, setRate] = useState<number>(0);
    const [amountCop, setAmountCop] = useState<number>(0);
    const [step, setStep] = useState<'form' | 'confirm' | 'processing'>('form');
    const [error, setError] = useState<string | null>(null);
    const [txStatus, setTxStatus] = useState<string>('');

    // Load config and rate
    useEffect(() => {
        async function load() {
            if (!token) return;

            const [configData, rateData] = await Promise.all([
                remittancesApi.getConfig(token),
                ratesApi.getUsdCop(token),
            ]);

            setConfig(configData);
            setRate(rateData.rate);
        }

        load();
    }, [token]);

    // Calculate COP amount
    useEffect(() => {
        const usd = parseFloat(amountUsdc) || 0;
        setAmountCop(usd * rate);
    }, [amountUsdc, rate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStep('confirm');
    };

    const handleConfirm = async () => {
        // We server-manage wallets now, so we don't strictly need "connect wallet" unless we want to link user address?
        // But for now, we assume user is logged in via email.

        setStep('processing');
        setError(null);

        try {
            // 1. Create in database (which now also creates on blockchain)
            setTxStatus('Creating remittance and processing on blockchain...');
            const remittance = await remittancesApi.create(
                {
                    recipientId,
                    recipientName,
                    amountUsdc: parseFloat(amountUsdc),
                },
                token!
            );

            setTxStatus('Complete! The remittance has been created on-chain. Please fund it from the dashboard.');
            setTimeout(() => navigate('/'), 3000);

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Transaction failed');
            setStep('form');
        }
    };

    return (
        <div className="max-w-md mx-auto">
            <h1 className="text-2xl font-bold mb-6">New Remittance</h1>

            {step === 'form' && (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Recipient ID</label>
                        <input
                            type="text"
                            value={recipientId}
                            onChange={(e) => setRecipientId(e.target.value)}
                            placeholder="CC-123456789"
                            className="w-full border rounded-lg px-3 py-2"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Recipient Name</label>
                        <input
                            type="text"
                            value={recipientName}
                            onChange={(e) => setRecipientName(e.target.value)}
                            placeholder="María García"
                            className="w-full border rounded-lg px-3 py-2"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Amount (USDC)</label>
                        <input
                            type="number"
                            value={amountUsdc}
                            onChange={(e) => setAmountUsdc(e.target.value)}
                            placeholder="100"
                            min="1"
                            step="0.01"
                            className="w-full border rounded-lg px-3 py-2"
                            required
                        />
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between text-sm">
                            <span>Exchange Rate:</span>
                            <span>{rate.toLocaleString()} COP/USD</span>
                        </div>
                        <div className="flex justify-between font-semibold mt-2">
                            <span>Recipient gets:</span>
                            <span>{amountCop.toLocaleString()} COP</span>
                        </div>
                    </div>

                    {error && <p className="text-red-600 text-sm">{error}</p>}

                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                    >
                        Continue
                    </button>
                </form>
            )}

            {step === 'confirm' && (
                <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <p><strong>To:</strong> {recipientName} ({recipientId})</p>
                        <p><strong>Amount:</strong> {amountUsdc} USDC</p>
                        <p><strong>They receive:</strong> {amountCop.toLocaleString()} COP</p>
                        <p><strong>Rate:</strong> {rate.toLocaleString()} COP/USD</p>
                    </div>

                    {!contract.address && (
                        <button
                            onClick={contract.connect}
                            className="w-full bg-orange-500 text-white py-2 rounded-lg"
                        >
                            Connect Wallet to Continue
                        </button>
                    )}

                    {contract.address && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setStep('form')}
                                className="flex-1 border py-2 rounded-lg"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="flex-1 bg-green-600 text-white py-2 rounded-lg"
                            >
                                Confirm & Create
                            </button>
                        </div>
                    )}
                </div>
            )}

            {step === 'processing' && (
                <div className="text-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p>{txStatus}</p>
                </div>
            )}
        </div>
    );
}
