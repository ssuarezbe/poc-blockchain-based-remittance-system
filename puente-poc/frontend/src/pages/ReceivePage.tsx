import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { remittancesApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { CheckCircle, AlertCircle, Loader2, ArrowDownCircle, Search, Clock, DollarSign, User as UserIcon } from 'lucide-react';

interface RemittanceDetails {
    id: string;
    senderId: string;
    recipientName: string;
    amountUsdc: number;
    amountCop: number;
    status: string;
    createdAt: string;
}

export default function ReceivePage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { token } = useAuth();

    const [remittanceId, setRemittanceId] = useState(searchParams.get('id') || '');
    const [details, setDetails] = useState<RemittanceDetails | null>(null);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Auto-fetch if ID is present in URL
    useEffect(() => {
        const idFromUrl = searchParams.get('id');
        if (idFromUrl && token) {
            setRemittanceId(idFromUrl);
            fetchDetails(idFromUrl);
        }
    }, [searchParams, token]);

    const fetchDetails = async (id: string) => {
        if (!token) return;
        setFetching(true);
        setError(null);
        try {
            // We use the same API to get details. 
            // Note: This requires the user to be able to "view" the remittance. 
            // The backend findOne was updated to allow this.
            const data = await remittancesApi.get(id, token);
            setDetails(data as any);
        } catch (err: any) {
            console.error(err);
            setError("Could not find remittance. Please check the ID.");
            setDetails(null);
        } finally {
            setFetching(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (remittanceId) fetchDetails(remittanceId);
    };

    const handleReceive = async () => {
        if (!remittanceId || !token) return;

        setLoading(true);
        setError(null);

        try {
            await remittancesApi.receive(remittanceId, token);
            setSuccess(true);
            // Refresh details to show updated status
            fetchDetails(remittanceId);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to receive remittance.');
        } finally {
            setLoading(false);
        }
    };

    if (!token) return <div className="p-8 text-center text-gray-500">Please log in to receive funds.</div>;

    if (success) {
        return (
            <div className="max-w-md mx-auto mt-10 p-8 bg-white rounded-xl shadow-lg border border-green-100 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Funds Received!</h2>
                <p className="text-gray-600 mb-6">
                    The transaction has been confirmed on the blockchain.
                </p>
                <div className="bg-gray-50 p-4 rounded-lg text-left mb-6">
                    <div className="flex justify-between mb-2">
                        <span className="text-gray-500">Amount Received:</span>
                        <span className="font-bold text-gray-900">{details?.amountCop.toLocaleString()} COP</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Status:</span>
                        <span className="font-bold text-green-600">COMPLETED</span>
                    </div>
                </div>
                <button
                    onClick={() => { setSuccess(false); navigate('/'); }}
                    className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                    Return to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto mt-10 p-6">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-gray-900">Receive Money</h1>
                <p className="text-gray-500 mt-2">Enter the Remittance ID to claim your funds.</p>
            </div>

            {/* Search Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
                <form onSubmit={handleSearch} className="flex gap-4">
                    <div className="flex-1 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            value={remittanceId}
                            onChange={(e) => setRemittanceId(e.target.value)}
                            placeholder="Paste Remittance ID (UUID)..."
                            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={fetching || !remittanceId}
                        className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        {fetching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Find'}
                    </button>
                </form>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-8 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            {/* Remittance Details Card */}
            {details && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-900">Remittance Details</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${details.status === 'funded' ? 'bg-green-100 text-green-800' :
                            details.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                            }`}>
                            {details.status}
                        </span>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-500 uppercase font-semibold">Recipient Name</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <UserIcon className="w-4 h-4 text-gray-400" />
                                    <span className="text-gray-900 font-medium">{details.recipientName}</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 uppercase font-semibold">Date Created</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <Clock className="w-4 h-4 text-gray-400" />
                                    <span className="text-gray-900">{new Date(details.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-500 uppercase font-semibold">Amount to Receive</label>
                                <div className="flex items-center gap-2 mt-1 text-2xl font-bold text-green-600">
                                    <DollarSign className="w-6 h-6" />
                                    {Number(details.amountCop).toLocaleString()} COP
                                </div>
                                <p className="text-xs text-gray-400 mt-1">({details.amountUsdc} USDC)</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-gray-50 border-t border-gray-100">
                        {details.status === 'funded' ? (
                            <button
                                onClick={handleReceive}
                                disabled={loading}
                                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all text-lg flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        Processing Blockchain Transaction...
                                    </>
                                ) : (
                                    <>
                                        <ArrowDownCircle className="w-6 h-6" />
                                        Receive Funds Now
                                    </>
                                )}
                            </button>
                        ) : details.status === 'completed' ? (
                            <div className="text-center py-2 text-blue-600 font-medium bg-blue-50 rounded-lg">
                                This remittance has already been received.
                            </div>
                        ) : (
                            <div className="text-center py-2 text-amber-600 font-medium bg-amber-50 rounded-lg">
                                This remittance is not yet ready to be received. Status: {details.status}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
