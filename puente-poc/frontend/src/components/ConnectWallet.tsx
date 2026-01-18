interface Props {
    address: string | null;
    balance: string;
    onConnect: () => void;
    onDisconnect: () => void;
    onFaucet: () => void;
    isConnecting: boolean;
    error: string | null;
}

export default function ConnectWallet({
    address,
    balance,
    onConnect,
    onDisconnect,
    onFaucet,
    isConnecting,
    error,
}: Props) {
    if (!address) {
        return (
            <div className="flex items-center justify-between">
                <span className="text-gray-600">Wallet not connected</span>
                <button
                    onClick={onConnect}
                    disabled={isConnecting}
                    className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50"
                >
                    {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
                {error && <span className="text-red-600 text-sm ml-2">{error}</span>}
            </div>
        );
    }

    return (
        <div className="flex items-center justify-between">
            <div>
                <p className="font-mono text-sm">
                    {address.slice(0, 6)}...{address.slice(-4)}
                </p>
                <p className="text-sm text-gray-600">Balance: {balance} USDC</p>
            </div>
            <div className="flex gap-2">
                <button
                    onClick={onFaucet}
                    className="text-blue-600 text-sm hover:underline"
                >
                    Get Test USDC
                </button>
                <button
                    onClick={onDisconnect}
                    className="text-red-600 text-sm hover:underline"
                >
                    Disconnect
                </button>
            </div>
        </div>
    );
}
