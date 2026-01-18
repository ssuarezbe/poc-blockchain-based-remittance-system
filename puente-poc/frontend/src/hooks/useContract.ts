import { useState, useCallback } from 'react';
import { ethers, BrowserProvider, Contract } from 'ethers';
import RemittanceEscrowABI from '../abis/RemittanceEscrow.json';
import MockUsdcABI from '../abis/MockUSDC.json';

interface ContractConfig {
    escrowAddress: string;
    usdcAddress: string;
    chainId: string;
}

export function useContract(config: ContractConfig | null) {
    const [address, setAddress] = useState<string | null>(null);
    const [escrowContract, setEscrowContract] = useState<Contract | null>(null);
    const [usdcContract, setUsdcContract] = useState<Contract | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Connect wallet
    const connect = useCallback(async () => {
        if (!window.ethereum) {
            setError('MetaMask not installed');
            return;
        }

        if (!config) {
            setError('Contract config not loaded');
            return;
        }

        setIsConnecting(true);
        setError(null);

        try {
            const browserProvider = new BrowserProvider(window.ethereum);
            await browserProvider.send('eth_requestAccounts', []);

            // Check network
            const network = await browserProvider.getNetwork();
            if (network.chainId !== BigInt(config.chainId)) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: `0x${parseInt(config.chainId).toString(16)}` }],
                    });
                } catch (switchError: any) {
                    // This error code indicates that the chain has not been added to MetaMask.
                    if (switchError.code === 4902) {
                        setError('Please add the network to MetaMask manually');
                    } else {
                        throw switchError;
                    }
                }
            }

            const walletSigner = await browserProvider.getSigner();
            const walletAddress = await walletSigner.getAddress();

            const escrow = new Contract(
                config.escrowAddress,
                RemittanceEscrowABI.abi,
                walletSigner
            );

            const usdc = new Contract(
                config.usdcAddress,
                MockUsdcABI.abi,
                walletSigner
            );

            setAddress(walletAddress);
            setEscrowContract(escrow);
            setUsdcContract(usdc);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Failed to connect');
        } finally {
            setIsConnecting(false);
        }
    }, [config]);

    // Disconnect
    const disconnect = useCallback(() => {
        setAddress(null);
        setEscrowContract(null);
        setUsdcContract(null);
    }, []);

    // Create remittance on chain
    const createRemittance = useCallback(
        async (recipientId: string, amountUsdc: number, exchangeRate: number) => {
            if (!escrowContract) throw new Error('Contract not connected');

            const amountWei = ethers.parseUnits(amountUsdc.toString(), 6);
            const rateScaled = Math.round(exchangeRate * 10000); // 4 decimals

            const tx = await escrowContract.createRemittance(recipientId, amountWei, rateScaled);
            const receipt = await tx.wait();

            // Find RemittanceCreated event
            const event = receipt.logs.find(
                (log: any) => escrowContract.interface.parseLog(log)?.name === 'RemittanceCreated'
            );

            const parsed = escrowContract.interface.parseLog(event);
            return {
                remittanceId: parsed?.args.remittanceId as string,
                txHash: receipt.hash as string,
            };
        },
        [escrowContract]
    );

    // Approve USDC spending
    const approveUsdc = useCallback(
        async (amount: number) => {
            if (!usdcContract || !config) throw new Error('Contract not connected');

            const amountWei = ethers.parseUnits(amount.toString(), 6);
            const tx = await usdcContract.approve(config.escrowAddress, amountWei);
            await tx.wait();
            return tx.hash;
        },
        [usdcContract, config]
    );

    // Deposit USDC to escrow
    const deposit = useCallback(
        async (remittanceId: string) => {
            if (!escrowContract) throw new Error('Contract not connected');

            const tx = await escrowContract.deposit(remittanceId);
            const receipt = await tx.wait();
            return receipt.hash;
        },
        [escrowContract]
    );

    // Get USDC balance
    const getUsdcBalance = useCallback(async () => {
        if (!usdcContract || !address) return '0';

        const balance = await usdcContract.balanceOf(address);
        return ethers.formatUnits(balance, 6);
    }, [usdcContract, address]);

    // Faucet (testnet only)
    const faucet = useCallback(async () => {
        if (!usdcContract) throw new Error('Contract not connected');

        const tx = await usdcContract.faucet();
        await tx.wait();
    }, [usdcContract]);

    return {
        address,
        isConnecting,
        error,
        connect,
        disconnect,
        createRemittance,
        approveUsdc,
        deposit,
        getUsdcBalance,
        faucet,
    };
}
