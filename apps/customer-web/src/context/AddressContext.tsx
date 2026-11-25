import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { CustomerAddress } from '../types/address';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

interface AddressContextType {
  addresses: CustomerAddress[];
  defaultAddress: CustomerAddress | null;
  selectedAddress: CustomerAddress | null;
  setSelectedAddress: (address: CustomerAddress | null) => void;
  isLoading: boolean;
  fetchAddresses: () => Promise<void>;
  saveAddress: (addressData: Omit<CustomerAddress, 'id' | 'customerId'> & { id?: string }) => Promise<CustomerAddress>;
  deleteAddress: (id: string) => Promise<void>;
  setDefaultAddress: (id: string) => Promise<void>;
}

const AddressContext = createContext<AddressContextType | undefined>(undefined);

export const AddressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<CustomerAddress | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchAddresses = useCallback(async () => {
    if (!isAuthenticated) {
      setAddresses([]);
      setSelectedAddress(null);
      return;
    }
    setIsLoading(true);
    try {
      const data = await api.customer.getAddresses();
      setAddresses(data);
      if (data.length > 0) {
        setSelectedAddress((prev) => {
          if (prev && data.some((a) => a.id === prev.id)) return prev;
          return data.find((a) => a.isDefault) || data[0];
        });
      }
    } catch (err) {
      console.error('Failed to fetch addresses from backend:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const saveAddress = async (
    addressData: Omit<CustomerAddress, 'id' | 'customerId'> & { id?: string }
  ): Promise<CustomerAddress> => {
    setIsLoading(true);
    try {
      const saved = await api.customer.saveAddress(addressData);
      await fetchAddresses();
      if (saved.isDefault || addresses.length === 0) {
        setSelectedAddress(saved);
      }
      return saved;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAddress = async (id: string): Promise<void> => {
    setIsLoading(true);
    try {
      await api.customer.deleteAddress(id);
      await fetchAddresses();
      if (selectedAddress?.id === id) {
        const remaining = addresses.filter((a) => a.id !== id);
        setSelectedAddress(remaining[0] || null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const setDefaultAddress = async (id: string): Promise<void> => {
    await api.customer.setDefaultAddress(id);
    await fetchAddresses();
  };

  const defaultAddress = addresses.find((a) => a.isDefault) || addresses[0] || null;

  return (
    <AddressContext.Provider
      value={{
        addresses,
        defaultAddress,
        selectedAddress,
        setSelectedAddress,
        isLoading,
        fetchAddresses,
        saveAddress,
        deleteAddress,
        setDefaultAddress,
      }}
    >
      {children}
    </AddressContext.Provider>
  );
};

export const useAddresses = (): AddressContextType => {
  const context = useContext(AddressContext);
  if (!context) {
    throw new Error('useAddresses must be used within an AddressProvider');
  }
  return context;
};

export const useAddress = useAddresses;
