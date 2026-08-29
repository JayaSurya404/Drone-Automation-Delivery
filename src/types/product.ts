export type ProductCategory = 
  | 'Food' 
  | 'Groceries' 
  | 'Medicine' 
  | 'Documents' 
  | 'Electronics' 
  | 'Other';

export interface ProductReview {
  id: string;
  author: string;
  avatar?: string;
  rating: number;
  date: string;
  title: string;
  comment: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
}

export interface Product {
  id: string;
  name: string;
  brand?: string;
  category: ProductCategory;
  subCategory?: string;
  description: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  rating: number;
  reviewCount: number;
  image: string;
  images?: string[];
  isDroneEligible: boolean;
  maxPayloadKg: number;
  estimatedDeliveryMins: number; // e.g. 12 mins by drone
  inStock: boolean;
  stockCount: number;
  badge?: string; // 'Fast Drone Choice', 'Critical Urgent', 'Bestseller', 'Deal of the Day'
  features?: string[];
  specifications?: Record<string, string>;
  dimensions?: string;
  weightGrams: number;
  customerReviews?: ProductReview[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}
