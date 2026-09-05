import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { LoginCredentials, User, UserStatus } from '../types';
import { api } from '../services/api';
import { socketClient } from '../services/socket';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  updateUserStatus: (status: UserStatus) => Promise<void>;
  updateUser: (user: User) => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(api.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const initAuth = useCallback(async () => {
    const savedToken = api.getToken();
    if (!savedToken) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await api.getMe();
      setUser(data.user);
      setToken(savedToken);
      socketClient.connect(savedToken);
    } catch (err) {
      console.warn('Session verification failed, logging out:', err);
      api.setToken(null);
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const login = async (credentials: LoginCredentials): Promise<void> => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await api.login(credentials);
      setUser(response.user);
      setToken(response.token);
      socketClient.connect(response.token);
    } catch (err: any) {
      setError(err.message || 'Falha ao autenticar. Verifique e-mail e senha.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await api.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      socketClient.disconnect();
      setUser(null);
      setToken(null);
    }
  };

  const updateUserStatus = async (newStatus: UserStatus): Promise<void> => {
    if (!user) return;
    try {
      await api.updateUserStatus(user.id, newStatus);
      setUser((prev) => (prev ? { ...prev, status: newStatus } : null));
    } catch (err: any) {
      console.error('Failed to update status:', err);
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        logout,
        updateUserStatus,
        updateUser,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
