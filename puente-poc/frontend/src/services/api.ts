const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ApiOptions {
    method?: string;
    body?: unknown;
    token?: string;
}

async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { method = 'GET', body, token } = options;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'API request failed');
    }

    return response.json();
}

// Auth
export const authApi = {
    register: (data: { email: string; password: string; walletAddress?: string }) =>
        api<{ user: User; accessToken: string }>('/auth/register', { method: 'POST', body: data }),

    login: (data: { email: string; password: string }) =>
        api<{ user: User; accessToken: string }>('/auth/login', { method: 'POST', body: data }),
};

// Rates
export const ratesApi = {
    getUsdCop: (token: string) =>
        api<{ pair: string; rate: number; timestamp: string }>('/rates/usd-cop', { token }),

    calculate: (amount: number, token: string) =>
        api<{ cop: number; rate: number }>(`/rates/calculate?amount=${amount}`, { token }),
};

// Remittances
export const remittancesApi = {
    getAll: (token: string) =>
        api<Remittance[]>('/remittances', { token }),

    getOne: (id: string, token: string) =>
        api<Remittance>(`/remittances/${id}`, { token }),

    create: (data: CreateRemittanceDto, token: string) =>
        api<Remittance>('/remittances', { method: 'POST', body: data, token }),

    update: (id: string, data: UpdateRemittanceDto, token: string) =>
        api<Remittance>(`/remittances/${id}`, { method: 'PATCH', body: data, token }),

    getConfig: (token: string) =>
        api<ContractConfig>('/remittances/config', { token }),

    get: (id: string, token: string) =>
        api<Remittance>(`/remittances/${id}`, { token }),

    fund: (id: string, token: string) =>
        api<Remittance>(`/remittances/${id}/fund`, { method: 'POST', token }),

    // Admin Release
    release: (id: string, token: string) =>
        api<Remittance>(`/remittances/${id}/release`, { method: 'POST', token }),

    // Receiver Claim
    receive: (id: string, token: string) =>
        api<Remittance>(`/remittances/${id}/receive`, { method: 'POST', token }),
};

// Types
export interface User {
    id: string;
    email: string;
    walletAddress?: string;
}

export interface Remittance {
    id: string;
    blockchainId?: string;
    recipientId: string;
    recipientName: string;
    amountUsdc: number;
    amountCop: number;
    exchangeRate: number;
    status: string;
    txHashCreate?: string;
    txHashFund?: string;
    txHashComplete?: string;
    createdAt: string;
    fundedAt?: string;
    completedAt?: string;
}

export interface CreateRemittanceDto {
    recipientId: string;
    recipientName: string;
    amountUsdc: number;
}

export interface UpdateRemittanceDto {
    blockchainId?: string;
    txHashCreate?: string;
    txHashFund?: string;
    status?: string;
}

export interface ContractConfig {
    escrowAddress: string;
    usdcAddress: string;
    chainId: string;
}
