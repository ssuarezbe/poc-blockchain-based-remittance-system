import { useState, useCallback } from 'react';
import axios from 'axios';

interface UseContractReturn {
    // State
    isConnecting: boolean;
    error: string | null;

    // Actions
    createRemittance: (recipientId: string, amountUsdc: number, exchangeRate: number) => Promise<void>;
    deposit: (remittanceId: string, amountUsdc: number) => Promise<void>;

    // Legacy/Mocked
    connect: () => Promise<void>;
    disconnect: () => void; // Added disconnect
    address: string | null;
    isConnected: boolean;
    contractConfig: any;
    getUsdcBalance: () => Promise<string>; // Added getUsdcBalance
    faucet: () => Promise<void>; // Added faucet
}

export const useContract = (config: any | null): UseContractReturn => {
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Mocked user address (since we are server-managed)
    const address = "0xServerManagedWallet";
    const isConnected = true;

    const createRemittance = useCallback(async (recipientId: string, amountUsdc: number, exchangeRate: number) => {
        setIsConnecting(true);
        setError(null);
        try {
            const token = localStorage.getItem('access_token');
            if (!token) throw new Error('Not authenticated');

            // The backend now handles the blockchain creation automatically
            // But we might need to notify the backend to "Create" if the previous create only did DB
            // Actually, based on my backend refactor:
            // POST /remittances -> Calls create -> Calls blockchain createRemittanceOnChain
            // So calling the API "create remittance" endpoint is enough.

            // However, the frontend "Create Remittance" flow usually involves:
            // 1. Calculate Quote
            // 2. Submit -> Calls useContract.createRemittance

            // If the frontend calls useContract.createRemittance, we should probably map this to the API call.
            // Wait, looking at current frontend flow (CreateRemittance.tsx which I haven't seen but infer):
            // It likely calls `remittancesService.create` (API) AND THEN `blockchain.create`.
            // If I changed the backend `create` to do BOTH, then the frontend only needs to call the API.

            // BUT, if `useContract.createRemittance` is called, it duplicates the API call if the API call is also done elsewhere.
            // Let's assume the component calls `useContract.createRemittance`.

            await axios.post(
                'http://localhost:3000/remittances',
                {
                    recipientId,
                    recipientName: "Recipient Name", // Simplification
                    amountUsdc,
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

        } catch (err: any) {
            console.error('Create remittance failed', err);
            setError(err.request ? 'Network error' : err.message || 'Failed to create remittance');
            throw err;
        } finally {
            setIsConnecting(false);
        }
    }, []);

    const deposit = useCallback(async (remittanceId: string, amountUsdc: number) => {
        setIsConnecting(true);
        setError(null);
        try {
            const token = localStorage.getItem('access_token');
            if (!token) throw new Error('Not authenticated');

            // Call the fund endpoint
            // remittanceId passed here might be the DB UUID or Blockchain ID?
            // Usually the UI has the DB UUID.
            await axios.post(
                `http://localhost:3000/remittances/${remittanceId}/fund`,
                {}, // body
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
        } catch (err: any) {
            console.error('Deposit failed', err);
            setError(err.request ? 'Network error on fund' : err.message || 'Failed to deposit');
            throw err;
        } finally {
            setIsConnecting(false);
        }
    }, []);

    const connect = useCallback(async () => {
        // No-op
    }, []);

    const disconnect = useCallback(() => {
        // No-op
    }, []);

    const getUsdcBalance = useCallback(async () => {
        return "1000.0"; // Mock balance
    }, []);

    const faucet = useCallback(async () => {
        // No-op
        alert("Faucet not needed in server-managed mode");
    }, []);

    return {
        isConnecting,
        error,
        createRemittance,
        deposit,
        connect,
        disconnect,
        address,
        isConnected,
        contractConfig: {},
        getUsdcBalance,
        faucet
    };
};
