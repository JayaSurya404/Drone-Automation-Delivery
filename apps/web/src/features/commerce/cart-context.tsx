"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type {
  ProductResponse,
  CartResponse,
  WishlistResponse,
  CustomerAddressResponse,
  CreateCustomerAddressRequest
} from "@skynav/contracts";
import { useAuth } from "../auth/auth-context";

interface CartContextType {
  cart: CartResponse | null;
  wishlist: WishlistResponse | null;
  addresses: CustomerAddressResponse[];
  selectedAddress: CustomerAddressResponse | null;
  isLoadingCart: boolean;
  isLoadingWishlist: boolean;
  isLoadingAddresses: boolean;
  fetchCart: () => Promise<void>;
  fetchWishlist: () => Promise<void>;
  fetchAddresses: () => Promise<void>;
  addToCart: (product: ProductResponse, quantity?: number) => Promise<boolean>;
  updateCartQuantity: (itemId: string, quantity: number) => Promise<boolean>;
  removeCartItem: (itemId: string) => Promise<boolean>;
  clearCart: () => Promise<boolean>;
  addToWishlist: (product: ProductResponse) => Promise<boolean>;
  removeFromWishlist: (productId: string) => Promise<boolean>;
  isInWishlist: (productId: string) => boolean;
  selectAddress: (address: CustomerAddressResponse) => void;
  createAddress: (data: CreateCustomerAddressRequest) => Promise<CustomerAddressResponse | null>;
  deleteAddress: (id: string) => Promise<boolean>;
  formatINR: (paise?: number) => string;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function formatINR(paise: number = 0): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: rupees % 1 === 0 ? 0 : 2
  }).format(rupees);
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { token, isAuthenticated } = useAuth();

  const [cart, setCart] = useState<CartResponse | null>(null);
  const [wishlist, setWishlist] = useState<WishlistResponse | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddressResponse[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<CustomerAddressResponse | null>(null);
  const [isLoadingCart, setIsLoadingCart] = useState<boolean>(false);
  const [isLoadingWishlist, setIsLoadingWishlist] = useState<boolean>(false);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState<boolean>(false);

  const getHeaders = useCallback(() => {
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }, [token]);

  const fetchCart = useCallback(async () => {
    if (!token) {
      setCart(null);
      return;
    }
    try {
      setIsLoadingCart(true);
      const res = await fetch(`${API_BASE_URL}/api/v1/cart`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        setCart(json.data);
      }
    } catch (err) {
      console.error("Failed to load cart", err);
    } finally {
      setIsLoadingCart(false);
    }
  }, [token, getHeaders]);

  const fetchWishlist = useCallback(async () => {
    if (!token) {
      setWishlist(null);
      return;
    }
    try {
      setIsLoadingWishlist(true);
      const res = await fetch(`${API_BASE_URL}/api/v1/wishlist`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        setWishlist(json.data);
      }
    } catch (err) {
      console.error("Failed to load wishlist", err);
    } finally {
      setIsLoadingWishlist(false);
    }
  }, [token, getHeaders]);

  const fetchAddresses = useCallback(async () => {
    if (!token) {
      setAddresses([]);
      setSelectedAddress(null);
      return;
    }
    try {
      setIsLoadingAddresses(true);
      const res = await fetch(`${API_BASE_URL}/api/v1/addresses`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        const list: CustomerAddressResponse[] = json.data || [];
        setAddresses(list);
        if (list.length > 0) {
          const def = list.find((a) => a.isDefault) || list[0];
          setSelectedAddress(def);
        }
      }
    } catch (err) {
      console.error("Failed to load addresses", err);
    } finally {
      setIsLoadingAddresses(false);
    }
  }, [token, getHeaders]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchCart();
      fetchWishlist();
      fetchAddresses();
    } else {
      setCart(null);
      setWishlist(null);
      setAddresses([]);
      setSelectedAddress(null);
    }
  }, [isAuthenticated, token, fetchCart, fetchWishlist, fetchAddresses]);

  const addToCart = async (product: ProductResponse, quantity = 1): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/cart/items`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ productId: product.id, quantity })
      });
      if (res.ok) {
        const json = await res.json();
        setCart(json.data);
        return true;
      }
    } catch (err) {
      console.error("Add to cart failed", err);
    }
    return false;
  };

  const updateCartQuantity = async (itemId: string, quantity: number): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/cart/items/${itemId}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ quantity })
      });
      if (res.ok) {
        const json = await res.json();
        setCart(json.data);
        return true;
      }
    } catch (err) {
      console.error("Update cart failed", err);
    }
    return false;
  };

  const removeCartItem = async (itemId: string): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/cart/items/${itemId}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        setCart(json.data);
        return true;
      }
    } catch (err) {
      console.error("Remove cart item failed", err);
    }
    return false;
  };

  const clearCart = async (): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/cart`, {
        method: "DELETE",
        headers: getHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        setCart(json.data);
        return true;
      }
    } catch (err) {
      console.error("Clear cart failed", err);
    }
    return false;
  };

  const addToWishlist = async (product: ProductResponse): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/wishlist/items`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ productId: product.id })
      });
      if (res.ok) {
        const json = await res.json();
        setWishlist(json.data);
        return true;
      }
    } catch (err) {
      console.error("Add to wishlist failed", err);
    }
    return false;
  };

  const removeFromWishlist = async (productId: string): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/wishlist/items/${productId}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        setWishlist(json.data);
        return true;
      }
    } catch (err) {
      console.error("Remove from wishlist failed", err);
    }
    return false;
  };

  const isInWishlist = (productId: string): boolean => {
    if (!wishlist || !wishlist.items) return false;
    return wishlist.items.some((item) => item.productId === productId);
  };

  const selectAddress = (address: CustomerAddressResponse) => {
    setSelectedAddress(address);
  };

  const createAddress = async (data: CreateCustomerAddressRequest): Promise<CustomerAddressResponse | null> => {
    if (!token) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/addresses`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const json = await res.json();
        const created: CustomerAddressResponse = json.data;
        await fetchAddresses();
        setSelectedAddress(created);
        return created;
      }
    } catch (err) {
      console.error("Create address failed", err);
    }
    return null;
  };

  const deleteAddress = async (id: string): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/addresses/${id}`, {
        method: "DELETE",
        headers: getHeaders()
      });
      if (res.ok) {
        await fetchAddresses();
        return true;
      }
    } catch (err) {
      console.error("Delete address failed", err);
    }
    return false;
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        wishlist,
        addresses,
        selectedAddress,
        isLoadingCart,
        isLoadingWishlist,
        isLoadingAddresses,
        fetchCart,
        fetchWishlist,
        fetchAddresses,
        addToCart,
        updateCartQuantity,
        removeCartItem,
        clearCart,
        addToWishlist,
        removeFromWishlist,
        isInWishlist,
        selectAddress,
        createAddress,
        deleteAddress,
        formatINR
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
