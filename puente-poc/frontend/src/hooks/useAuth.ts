import { useState, useEffect, useCallback } from 'react';
import { authApi, User } from '../services/api';

const TOKEN_KEY = 'puente_token';
const USER_KEY = 'puente_user';

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load from localStorage on mount
    useEffect(() => {
        const savedToken = localStorage.getItem(TOKEN_KEY);
        const savedUser = localStorage.getItem(USER_KEY);

        if (savedToken && savedUser) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
        }
        setIsLoading(false);
    }, []);

    const register = useCallback(
        async (email: string, password: string, walletAddress?: string) => {
            const result = await authApi.register({ email, password, walletAddress });

            localStorage.setItem(TOKEN_KEY, result.accessToken);
            localStorage.setItem(USER_KEY, JSON.stringify(result.user));

            setToken(result.accessToken);
            setUser(result.user);

            return result;
        },
        []
    );

    const login = useCallback(async (email: string, password: string) => {
        const result = await authApi.login({ email, password });

        localStorage.setItem(TOKEN_KEY, result.accessToken);
        localStorage.setItem(USER_KEY, JSON.stringify(result.user));

        setToken(result.accessToken);
        setUser(result.user);

        return result;
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
    }, []);

    return {
        user,
        token,
        isLoading,
        isAuthenticated: !!token,
        register,
        login,
        logout,
    };
}
