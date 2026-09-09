import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Product } from '../types/product';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

interface WishlistContextType {
  wishlist: Product[];
  wishlistCount: number;
  addToWishlist: (product: Product) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
  toggleWishlist: (product: Product) => boolean;
  isInWishlist: (productId: string) => boolean;
  clearWishlist: () => void;
  refreshWishlist: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [wishlist, setWishlist] = useState<Product[]>([]);

  const refreshWishlist = useCallback(async () => {
    if (!isAuthenticated) {
      setWishlist([]);
      return;
    }
    try {
      const items = await api.wishlist.get();
      setWishlist(items);
    } catch (err) {
      console.error('Failed to fetch wishlist from backend:', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshWishlist();
  }, [refreshWishlist]);

  const addToWishlist = useCallback(async (product: Product) => {
    setWishlist(prev => {
      if (prev.some(p => p.id === product.id)) return prev;
      return [...prev, product];
    });
    try {
      await api.wishlist.add(product.id);
    } catch (err) {
      console.error('Failed to add to wishlist:', err);
    }
  }, []);

  const removeFromWishlist = useCallback(async (productId: string) => {
    setWishlist(prev => prev.filter(p => p.id !== productId));
    try {
      await api.wishlist.remove(productId);
    } catch (err) {
      console.error('Failed to remove from wishlist:', err);
    }
  }, []);

  const toggleWishlist = useCallback((product: Product): boolean => {
    const exists = wishlist.some(p => p.id === product.id);
    if (exists) {
      removeFromWishlist(product.id);
      return false;
    } else {
      addToWishlist(product);
      return true;
    }
  }, [wishlist, addToWishlist, removeFromWishlist]);

  const isInWishlist = useCallback((productId: string): boolean => {
    return wishlist.some(p => p.id === productId);
  }, [wishlist]);

  const clearWishlist = useCallback(() => {
    setWishlist([]);
  }, []);

  return (
    <WishlistContext.Provider
      value={{
        wishlist,
        wishlistCount: wishlist.length,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        isInWishlist,
        clearWishlist,
        refreshWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = (): WishlistContextType => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};
