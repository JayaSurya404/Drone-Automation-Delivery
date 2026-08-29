export interface CustomerUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  isVerified: boolean;
  accountStatus: 'active' | 'pending_verification' | 'disabled';
  createdAt: string;
  updatedAt: string;
  notificationPreferences?: {
    emailUpdates: boolean;
    smsAlerts: boolean;
    droneProximitySound: boolean;
  };
}

export interface AuthState {
  user: CustomerUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface VerifyAccountPayload {
  code: string;
  email?: string;
}

export interface ResetPasswordPayload {
  email?: string;
  code?: string;
  password?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export type PendingActionType = 'add_to_cart' | 'wishlist' | 'buy_now' | 'navigate';

export interface PendingAction {
  type: PendingActionType;
  productId?: string;
  quantity?: number;
  returnTo?: string;
  productName?: string;
}
