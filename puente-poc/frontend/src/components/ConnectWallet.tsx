
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
    // Simplified view: Always connected (Server Managed)
    return (
        <div className="flex items-center justify-between">
            <div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <p className="font-mono text-sm font-bold text-gray-700">Server Managed Wallet</p>
                </div>
                <p className="text-sm text-gray-500">Balance: {balance} USDC (Pooled)</p>
            </div>
            {/* Hidden/Disabled actions */}
            <div className="hidden">
                <button onClick={onFaucet}>Faucet</button>
            </div>
        </div>
    );
}
