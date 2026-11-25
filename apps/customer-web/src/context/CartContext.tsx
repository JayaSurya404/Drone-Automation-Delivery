import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { CartItem, Product } from '../types/product';
import { DeliverySpeedOption } from '../types/order';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  itemCount: number;
  totalWeightGrams: number;
  subtotal: number;
  deliveryFee: number;
  tax: number;
  discount: number;
  total: number;
  appliedPromo: string | null;
  applyPromoCode: (code: string) => Promise<{ success: boolean; message: string }>;
  removePromoCode: () => void;
  deliverySpeed: DeliverySpeedOption;
  setDeliverySpeed: (speed: DeliverySpeedOption) => void;
  isLoading: boolean;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [itemCount, setItemCount] = useState<number>(0);
  const [totalWeightGrams, setTotalWeightGrams] = useState<number>(0);
  const [subtotal, setSubtotal] = useState<number>(0);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [tax, setTax] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [deliverySpeed, setDeliverySpeed] = useState<DeliverySpeedOption>('standard');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const applyCartResponse = (data: any) => {
    if (!data) return;
    setItems(data.items || []);
    setItemCount(data.itemCount || 0);
    setTotalWeightGrams(data.totalWeightGrams || 0);
    setSubtotal(data.subtotal || 0);
    setDeliveryFee(data.deliveryFee || 0);
    setTax(data.tax || 0);
    setDiscount(data.discount || 0);
    setTotal(data.total || 0);
    setAppliedPromo(data.appliedPromo || null);
  };

  const refreshCart = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      setItemCount(0);
      setTotal(0);
      return;
    }
    try {
      setIsLoading(true);
      const data = await api.cart.get(appliedPromo, deliverySpeed);
      applyCartResponse(data);
    } catch (err) {
      console.error('Failed to load cart from backend:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, appliedPromo, deliverySpeed]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addToCart = async (product: Product, quantity: number = 1) => {
    try {
      const data = await api.cart.addItem(product.id, quantity);
      applyCartResponse(data);
    } catch (err: any) {
      console.error('Failed to add item to cart:', err);
      throw err;
    }
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    try {
      const data = await api.cart.updateQuantity(productId, quantity);
      applyCartResponse(data);
    } catch (err) {
      console.error('Failed to update quantity:', err);
    }
  };

  const removeFromCart = async (productId: string) => {
    try {
      const data = await api.cart.removeItem(productId);
      applyCartResponse(data);
    } catch (err) {
      console.error('Failed to remove item from cart:', err);
    }
  };

  const clearCart = async () => {
    try {
      const data = await api.cart.clear();
      applyCartResponse(data);
    } catch (err) {
      console.error('Failed to clear cart:', err);
    }
  };

  const applyPromoCode = async (code: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await api.cart.applyPromo(code);
      if (res.success) {
        applyCartResponse(res.cart);
        return { success: true, message: res.message };
      }
      return { success: false, message: 'Invalid promo code.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Invalid promo code.' };
    }
  };

  const removePromoCode = () => {
    setAppliedPromo(null);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        itemCount,
        totalWeightGrams,
        subtotal,
        deliveryFee,
        tax,
        discount,
        total,
        appliedPromo,
        applyPromoCode,
        removePromoCode,
        deliverySpeed,
        setDeliverySpeed,
        isLoading,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
