import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { CustomerAddress } from '../types/address';
import { api } from '../services/api';
import { storage } from '../services/storage';
import { INITIAL_ADDRESSES } from '../services/mockData';

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
  const [addresses, setAddresses] = useState<CustomerAddress[]>(() => {
    return storage.get<CustomerAddress[]>(storage.keys.ADDRESSES, INITIAL_ADDRESSES);
  });
  const [selectedAddress, setSelectedAddress] = useState<CustomerAddress | null>(() => {
    const list = storage.get<CustomerAddress[]>(storage.keys.ADDRESSES, INITIAL_ADDRESSES);
    return list.find((a) => a.isDefault) || list[0] || null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchAddresses = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.customer.getAddresses();
      setAddresses(data);
      if (!selectedAddress && data.length > 0) {
        const def = data.find((a) => a.isDefault) || data[0];
        setSelectedAddress(def);
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedAddress]);

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
    const target = addresses.find((a) => a.id === id);
    if (!target) return;
    await saveAddress({ ...target, isDefault: true });
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
