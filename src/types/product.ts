export type ProductCategory = 
  | 'Food' 
  | 'Groceries' 
  | 'Medicine' 
  | 'Documents' 
  | 'Electronics' 
  | 'Other'
  | 'Medicine & Urgent Care'
  | 'Hot Food & Dining'
  | 'Fresh Groceries'
  | 'Tech & Cables'
  | 'Secure Documents'
  | 'Pet & Home Essentials'
  | 'All';

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
  slug?: string;
  brand?: string;
  sku?: string;
  category: ProductCategory;
  category_id?: string;
  subCategory?: string;
  description: string;
  shortDescription?: string;
  tagline?: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  currency?: string;
  rating: number;
  reviewCount: number;
  image: string;
  thumbnailUrl?: string;
  images?: string[];
  isDroneEligible: boolean;
  maxPayloadKg: number;
  estimatedDeliveryMins: number; // e.g. 10 mins by drone
  inStock: boolean;
  stockCount: number;
  stockStatus?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  badge?: string; // 'Fast Air ETA', 'Critical Urgent', 'Bestseller', 'Super Deal'
  features?: string[];
  specifications?: Record<string, string>;
  flightSpecs?: Record<string, string>;
  dimensions?: string;
  weight?: string;
  weightGrams: number;
  customerReviews?: ProductReview[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}
