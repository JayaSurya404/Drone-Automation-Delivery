import React, { createContext, useContext, useEffect, useState } from 'react';
import { CartItem, Product } from '../types/product';
import { DeliverySpeedOption } from '../types/order';
import { storage } from '../services/storage';

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  itemCount: number;
  totalWeightGrams: number;
  subtotal: number;
  deliveryFee: number;
  tax: number;
  discount: number;
  total: number;
  appliedPromo: string | null;
  applyPromoCode: (code: string) => { success: boolean; message: string };
  removePromoCode: () => void;
  deliverySpeed: DeliverySpeedOption;
  setDeliverySpeed: (speed: DeliverySpeedOption) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    return storage.get<CartItem[]>(storage.keys.CART, []);
  });
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [promoDiscountPct, setPromoDiscountPct] = useState<number>(0);
  const [deliverySpeed, setDeliverySpeed] = useState<DeliverySpeedOption>('standard');

  useEffect(() => {
    storage.set(storage.keys.CART, items);
  }, [items]);

  const addToCart = (product: Product, quantity: number = 1) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setItems([]);
    setAppliedPromo(null);
    setPromoDiscountPct(0);
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const totalWeightGrams = items.reduce(
    (sum, item) => sum + (item.product.weightGrams || 200) * item.quantity,
    0
  );

  const subtotal = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  // Dynamic drone delivery fee calculation
  let baseDeliveryFee = items.length > 0 ? 3.99 : 0;
  if (deliverySpeed === 'express') baseDeliveryFee += 3.5;
  if (totalWeightGrams > 1500) baseDeliveryFee += 2.0; // Payload surcharge

  const deliveryFee = parseFloat(baseDeliveryFee.toFixed(2));
  const discount = parseFloat(((subtotal * promoDiscountPct) / 100).toFixed(2));
  const taxableAmount = Math.max(0, subtotal - discount);
  const tax = items.length > 0 ? parseFloat((taxableAmount * 0.085).toFixed(2)) : 0;
  const total = items.length > 0 ? parseFloat((taxableAmount + deliveryFee + tax).toFixed(2)) : 0;

  const applyPromoCode = (code: string): { success: boolean; message: string } => {
    const clean = code.trim().toUpperCase();
    if (clean === 'DRONE10' || clean === 'SKYFIRST') {
      setAppliedPromo(clean);
      setPromoDiscountPct(10);
      return { success: true, message: '10% discount applied to your order!' };
    }
    if (clean === 'AERO20' && subtotal >= 50) {
      setAppliedPromo(clean);
      setPromoDiscountPct(20);
      return { success: true, message: '20% VIP drone discount applied!' };
    }
    if (clean === 'AERO20' && subtotal < 50) {
      return { success: false, message: 'AERO20 requires a minimum subtotal of $50.' };
    }
    return { success: false, message: 'Invalid promo code. Try "DRONE10" or "SKYFIRST".' };
  };

  const removePromoCode = () => {
    setAppliedPromo(null);
    setPromoDiscountPct(0);
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
