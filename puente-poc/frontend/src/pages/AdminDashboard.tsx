import { useEffect, useState } from 'react';
import axios from 'axios';
import { format, parseISO } from 'date-fns';
import { ChevronDown, ChevronUp, Activity, CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface Log {
    eventId: string;
    prevEventId: string | null;
    action: string;
    timestamp: string;
    error?: string;
    details?: any;
    stack?: string;
    trace?: string;
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
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

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
                if (err.response?.status === 401) {
                    // Cold start or session expired
                    localStorage.removeItem('puente_token');
                    window.location.href = '/login';
                    return;
                }
                setError(err.message || 'Failed to fetch');
            } finally {
                setLoading(false);
            }
        };

        fetchRemittances();
    }, []);

    const toggleRow = (id: string) => {
        setExpandedRow(expandedRow === id ? null : id);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).catch(console.error);
    };

    if (loading) return <div className="p-8">Loading...</div>;
    if (error) return <div className="p-8 text-red-500">Error: {error}</div>;

    return (
        <div className="container mx-auto p-6">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Admin Dashboard: Remittance Audit Log</h1>

            <div className="overflow-hidden bg-white shadow-md rounded-lg">
                <table className="min-w-full leading-normal">
                    <thead>
                        <tr className="bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            <th className="px-4 py-3"></th>
                            <th className="px-5 py-3">Remittance ID</th>
                            <th className="px-5 py-3">Created (UTC)</th>
                            <th className="px-5 py-3">User</th>
                            <th className="px-5 py-3">Recipient</th>
                            <th className="px-5 py-3">Amount</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3">Blockchain ID</th>
                        </tr>
                    </thead>
                    <tbody>
                        {remittances.map((rem) => (
                            <>
                                <tr
                                    key={rem.id}
                                    className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                                    onClick={() => toggleRow(rem.id)}
                                >
                                    <td className="px-4 py-5 text-gray-500">
                                        {expandedRow === rem.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </td>
                                    <td className="px-5 py-5 text-sm">
                                        <div className="flex items-center gap-2">
                                            <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700">
                                                {rem.id.substring(0, 8)}...
                                            </code>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); copyToClipboard(rem.id); }}
                                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-5 py-5 text-sm font-mono text-gray-600">
                                        {format(parseISO(rem.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                                    </td>
                                    <td className="px-5 py-5 text-sm">{rem.sender?.email}</td>
                                    <td className="px-5 py-5 text-sm">
                                        <div className="font-bold">{rem.recipientName}</div>
                                        <div className="text-xs text-gray-400">{rem.recipientId}</div>
                                    </td>
                                    <td className="px-5 py-5 text-sm font-mono font-bold text-gray-700">
                                        ${rem.amountUsdc}
                                    </td>
                                    <td className="px-5 py-5 text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                            ${rem.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                rem.status === 'failed' ? 'bg-red-100 text-red-800' :
                                                    rem.status === 'funded' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-yellow-100 text-yellow-800'}`}>
                                            {rem.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-5 py-5 text-sm font-mono text-gray-400 max-w-xs truncate" title={rem.blockchainId}>
                                        {rem.blockchainId ? rem.blockchainId.substring(0, 8) + '...' : '-'}
                                    </td>
                                </tr>
                                {expandedRow === rem.id && (
                                    <tr className="bg-gray-50">
                                        <td colSpan={8} className="px-8 py-6 border-b border-gray-200">
                                            <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center">
                                                <Activity size={16} className="mr-2" /> Event History Chain
                                            </h4>
                                            <div className="relative border-l-2 border-blue-200 ml-3 pl-6 space-y-6">
                                                {rem.logs && rem.logs.map((log, i) => (
                                                    <div key={i} className="relative">
                                                        <div className={`absolute -left-[31px] bg-white border-2 rounded-full p-1
                                                            ${log.error ? 'border-red-400 text-red-500' : 'border-blue-400 text-blue-500'}`}>
                                                            {log.error ? <AlertCircle size={12} /> : <CheckCircle size={12} />}
                                                        </div>
                                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white p-3 rounded shadow-sm border border-gray-100">
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">{log.action}</span>
                                                                    <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 rounded">
                                                                        ID: {log.eventId?.substring(0, 8)}...
                                                                    </span>
                                                                    {log.prevEventId && (
                                                                        <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 rounded">
                                                                            Prev: {log.prevEventId.substring(0, 8)}...
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-gray-500 font-mono flex items-center mb-2">
                                                                    <Clock size={12} className="mr-1" />
                                                                    {format(parseISO(log.timestamp), 'yyyy-MM-dd HH:mm:ss.SSS')} UTC
                                                                </div>
                                                                {log.details && (
                                                                    <pre className="text-xs bg-gray-50 p-2 rounded text-gray-600 overflow-x-auto mt-2">
                                                                        {JSON.stringify(log.details, null, 2)}
                                                                    </pre>
                                                                )}
                                                                {log.trace && (
                                                                    <details className="mt-1 text-xs text-gray-400">
                                                                        <summary>Trace</summary>
                                                                        <pre className="mt-1 bg-gray-50 p-2 rounded overflow-x-auto">{log.trace}</pre>
                                                                    </details>
                                                                )}
                                                                {log.error && (
                                                                    <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                                                                        <strong>Error:</strong> {log.error}
                                                                        {log.stack && <details className="mt-1"><summary>Stack Trace</summary>{log.stack}</details>}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {(!rem.logs || rem.logs.length === 0) && (
                                                    <div className="text-sm text-gray-500 italic">No logs available for this remittance.</div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
