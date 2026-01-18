import { useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';

interface Log {
    action: string;
    timestamp: string;
    error?: string;
    details?: any;
}

interface Remittance {
    id: string;
    status: string;
    amountUsdc: number;
    amountCop: number;
    exchangeRate: number;
    recipientId: string;
    recipientName: string;
    blockchainId: string;
    txHashCreate: string;
    txHashFund: string;
    createdAt: string;
    logs: Log[];
    sender: { email: string };
}

export const AdminDashboard = () => {
    const [remittances, setRemittances] = useState<Remittance[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchRemittances = async () => {
            try {
                const token = localStorage.getItem('puente_token');
                if (!token) throw new Error('Not authenticated');

                const response = await axios.get('http://localhost:3000/remittances/admin/all', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setRemittances(response.data);
            } catch (err: any) {
                setError(err.message || 'Failed to fetch');
            } finally {
                setLoading(false);
            }
        };

        fetchRemittances();
    }, []);

    if (loading) return <div className="p-8">Loading...</div>;
    if (error) return <div className="p-8 text-red-500">Error: {error}</div>;

    return (
        <div className="container mx-auto p-6">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Admin Dashboard: Remittances</h1>

            <div className="overflow-x-auto bg-white shadow-md rounded-lg">
                <table className="min-w-full leading-normal">
                    <thead>
                        <tr className="bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            <th className="px-5 py-3">Timestamp</th>
                            <th className="px-5 py-3">User</th>
                            <th className="px-5 py-3">Recipient</th>
                            <th className="px-5 py-3">Amount (USDC)</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3">Blockchain ID</th>
                            <th className="px-5 py-3">Latest Logs</th>
                        </tr>
                    </thead>
                    <tbody>
                        {remittances.map((rem) => (
                            <tr key={rem.id} className="border-b border-gray-200 hover:bg-gray-50">
                                <td className="px-5 py-5 text-sm">
                                    {format(new Date(rem.createdAt), 'MMM dd, HH:mm')}
                                </td>
                                <td className="px-5 py-5 text-sm">{rem.sender?.email}</td>
                                <td className="px-5 py-5 text-sm">
                                    <p className="font-bold">{rem.recipientName}</p>
                                    <p className="text-gray-500">{rem.recipientId}</p>
                                </td>
                                <td className="px-5 py-5 text-sm font-mono">${rem.amountUsdc}</td>
                                <td className="px-5 py-5 text-sm">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                        ${rem.status === 'completed' ? 'bg-green-100 text-green-800' :
                                            rem.status === 'failed' ? 'bg-red-100 text-red-800' :
                                                rem.status === 'funded' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-yellow-100 text-yellow-800'}`}>
                                        {rem.status.toUpperCase()}
                                    </span>
                                </td>
                                <td className="px-5 py-5 text-sm font-mono text-gray-500 max-w-xs truncate" title={rem.blockchainId}>
                                    {rem.blockchainId ? rem.blockchainId.substring(0, 10) + '...' : '-'}
                                </td>
                                <td className="px-5 py-5 text-sm max-w-sm">
                                    {rem.logs && rem.logs.length > 0 ? (
                                        <div className="text-xs text-gray-600">
                                            {rem.logs.slice(-2).map((log, i) => (
                                                <div key={i} className="mb-1 border-l-2 pl-2 border-gray-300">
                                                    <span className="font-bold text-gray-700">{log.action}</span>
                                                    {log.error && <span className="text-red-500 block">{log.error}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 italic">No logs</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
