const STORAGE_KEYS = {
  AUTH_USER: 'drone_customer_user',
  AUTH_TOKEN: 'drone_customer_token',
  THEME: 'drone_customer_theme',
  CART: 'drone_customer_cart',
  ORDERS: 'drone_customer_orders',
  ADDRESSES: 'drone_customer_addresses',
  NOTIFICATIONS: 'drone_customer_notifications',
  SUPPORT_TICKETS: 'drone_customer_tickets',
};

export const storage = {
  get: <T>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(key);
      if (!item) return defaultValue;
      return JSON.parse(item) as T;
    } catch (e) {
      console.warn(`Error reading localStorage key "${key}":`, e);
      return defaultValue;
    }
  },

  set: <T>(key: string, value: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn(`Error writing localStorage key "${key}":`, e);
    }
  },

  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`Error removing localStorage key "${key}":`, e);
    }
  },

  keys: STORAGE_KEYS,
};
