import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Product, ProductCategory } from '../types/product';
import { CustomerAddress } from '../types/address';
import { CustomerOrder, CustomerOrderStatus, PaymentMethod, PaymentStatus, DeliverySpeedOption } from '../types/order';
import { CustomerNotification, NotificationCategory } from '../types/notification';
import { FAQItem, SupportTicket, SupportTicketCategory, SupportTicketStatus } from '../types/support';

export const supabaseService = {
  // ── CATEGORIES ──
  categories: {
    getAll: async (): Promise<any[]> => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) {
        console.error('Error fetching categories from Supabase:', error);
        throw error;
      }
      return (data || []).map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description || '',
        icon: cat.icon || 'Package',
        image: cat.image_url || cat.banner_image || '',
        droneType: cat.drone_type || 'Hexacopter Heavy Lift',
        productCount: 0,
      }));
    },
  },

  // ── PRODUCTS ──
  products: {
    getAll: async (params?: {
      category?: string;
      search?: string;
      featured?: boolean;
      deals?: boolean;
      sort?: string;
      maxSpeed?: number;
      droneOnly?: boolean;
      minPrice?: number;
      maxPrice?: number;
    }): Promise<Product[]> => {
      if (!isSupabaseConfigured()) return [];
      let query = supabase.from('products').select('*');

      // Only active products
      query = query.or('is_active.eq.true,is_active.is.null');

      // Category filter (support category ID or slug or name)
      if (params?.category && params.category !== 'All') {
        const cat = params.category.toLowerCase();
        if (cat.startsWith('cat-')) {
          query = query.eq('category_id', params.category);
        } else if (cat.includes('med') || cat.includes('pharm')) {
          query = query.in('category_id', ['cat-medicine', 'cat-medical']);
        } else if (cat.includes('food') || cat.includes('dine') || cat.includes('meal')) {
          query = query.eq('category_id', 'cat-food');
        } else if (cat.includes('groc') || cat.includes('fresh')) {
          query = query.eq('category_id', 'cat-groceries');
        } else if (cat.includes('tech') || cat.includes('elec') || cat.includes('cable')) {
          query = query.eq('category_id', 'cat-tech');
        } else if (cat.includes('doc') || cat.includes('print') || cat.includes('paper')) {
          query = query.eq('category_id', 'cat-documents');
        } else if (cat.includes('pet') || cat.includes('essent') || cat.includes('home') || cat.includes('other')) {
          query = query.eq('category_id', 'cat-essentials');
        } else {
          query = query.or(`category_id.eq.${params.category},slug.ilike.%${params.category}%`);
        }
      }

      if (params?.featured) {
        query = query.eq('is_featured', true);
      }

      if (params?.droneOnly) {
        query = query.eq('is_drone_deliverable', true);
      }

      if (params?.maxSpeed && params.maxSpeed > 0) {
        query = query.lte('estimated_delivery_minutes', params.maxSpeed);
      }

      if (params?.search && params.search.trim() !== '') {
        const s = params.search.trim();
        query = query.or(`name.ilike.%${s}%,description.ilike.%${s}%,brand.ilike.%${s}%,sku.ilike.%${s}%`);
      }

      if (params?.minPrice !== undefined) {
        query = query.gte('price', params.minPrice);
      }
      if (params?.maxPrice !== undefined) {
        query = query.lte('price', params.maxPrice);
      }

      // Sort
      if (params?.sort === 'price-asc') {
        query = query.order('price', { ascending: true });
      } else if (params?.sort === 'price-desc') {
        query = query.order('price', { ascending: false });
      } else if (params?.sort === 'rating') {
        query = query.order('rating', { ascending: false });
      } else if (params?.sort === 'speed') {
        query = query.order('estimated_delivery_minutes', { ascending: true });
      } else if (params?.sort === 'newest') {
        query = query.order('created_at', { ascending: false });
      } else {
        query = query.order('is_featured', { ascending: false }).order('rating', { ascending: false });
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching products from Supabase:', error);
        throw error;
      }

      const categoryMap: Record<string, ProductCategory> = {
        'cat-medicine': 'Medicine',
        'cat-medical': 'Medicine',
        'cat-food': 'Food',
        'cat-groceries': 'Groceries',
        'cat-tech': 'Electronics',
        'cat-documents': 'Documents',
        'cat-essentials': 'Other',
      };

      return (data || []).map((p: any): Product => {
        const catName: ProductCategory = categoryMap[p.category_id] || 'Other';
        const img = p.image_url || p.image || p.thumbnail_url || '';
        const discPercent = p.discount_percentage ? Number(p.discount_percentage) : (p.original_price && Number(p.original_price) > Number(p.price) ? Math.round(((Number(p.original_price) - Number(p.price)) / Number(p.original_price)) * 100) : undefined);

        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          brand: p.brand || 'SkyLink Prime',
          sku: p.sku || p.id,
          category: catName,
          category_id: p.category_id,
          description: p.description || '',
          shortDescription: p.short_description || '',
          tagline: p.tagline || '',
          price: Number(p.price),
          originalPrice: p.original_price ? Number(p.original_price) : undefined,
          discountPercent: discPercent,
          currency: p.currency || 'INR',
          rating: Number(p.rating || 4.8),
          reviewCount: Number(p.review_count ?? p.reviews_count ?? 0),
          image: img,
          thumbnailUrl: p.thumbnail_url || img,
          images: Array.isArray(p.gallery) && p.gallery.length > 0 ? p.gallery : [img],
          isDroneEligible: p.is_drone_deliverable ?? true,
          maxPayloadKg: 4.0,
          estimatedDeliveryMins: Number(p.estimated_delivery_minutes || 10),
          inStock: p.stock_status ? p.stock_status !== 'OUT_OF_STOCK' : (p.in_stock ?? true),
          stockCount: Number(p.stock_quantity ?? p.stock_count ?? 50),
          stockStatus: p.stock_status || (p.in_stock === false ? 'OUT_OF_STOCK' : 'IN_STOCK'),
          badge: p.badge || (discPercent && discPercent >= 25 ? 'Super Deal' : (p.estimated_delivery_minutes <= 10 ? 'Fast Air ETA' : undefined)),
          features: Array.isArray(p.features) ? p.features : [],
          specifications: typeof p.specifications === 'object' && p.specifications !== null ? p.specifications : {},
          flightSpecs: typeof p.flight_specs === 'object' && p.flight_specs !== null ? p.flight_specs : {},
          weight: p.weight || '0.85 kg',
          weightGrams: Number(p.weight_grams || 850),
        };
      });
    },

    getById: async (idOrSlug: string): Promise<Product | null> => {
      if (!isSupabaseConfigured() || !idOrSlug) return null;
      const { data: p, error } = await supabase
        .from('products')
        .select('*')
        .or(`id.eq.${idOrSlug},slug.eq.${idOrSlug}`)
        .single();

      if (error || !p) {
        const { data: pExact } = await supabase
          .from('products')
          .select('*')
          .eq('id', idOrSlug)
          .single();
        if (!pExact) return null;
        return supabaseService.products.getById(pExact.id);
      }

      const categoryMap: Record<string, ProductCategory> = {
        'cat-medicine': 'Medicine',
        'cat-medical': 'Medicine',
        'cat-food': 'Food',
        'cat-groceries': 'Groceries',
        'cat-tech': 'Electronics',
        'cat-documents': 'Documents',
        'cat-essentials': 'Other',
      };
      const catName: ProductCategory = categoryMap[p.category_id] || 'Other';
      const img = p.image_url || p.image || p.thumbnail_url || '';
      const discPercent = p.discount_percentage ? Number(p.discount_percentage) : (p.original_price && Number(p.original_price) > Number(p.price) ? Math.round(((Number(p.original_price) - Number(p.price)) / Number(p.original_price)) * 100) : undefined);

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        brand: p.brand || 'SkyLink Prime',
        sku: p.sku || p.id,
        category: catName,
        category_id: p.category_id,
        description: p.description || '',
        shortDescription: p.short_description || '',
        tagline: p.tagline || '',
        price: Number(p.price),
        originalPrice: p.original_price ? Number(p.original_price) : undefined,
        discountPercent: discPercent,
        currency: p.currency || 'INR',
        rating: Number(p.rating || 4.8),
        reviewCount: Number(p.review_count ?? p.reviews_count ?? 0),
        image: img,
        thumbnailUrl: p.thumbnail_url || img,
        images: Array.isArray(p.gallery) && p.gallery.length > 0 ? p.gallery : [img],
        isDroneEligible: p.is_drone_deliverable ?? true,
        maxPayloadKg: 4.0,
        estimatedDeliveryMins: Number(p.estimated_delivery_minutes || 10),
        inStock: p.stock_status ? p.stock_status !== 'OUT_OF_STOCK' : (p.in_stock ?? true),
        stockCount: Number(p.stock_quantity ?? p.stock_count ?? 50),
        stockStatus: p.stock_status || (p.in_stock === false ? 'OUT_OF_STOCK' : 'IN_STOCK'),
        badge: p.badge || (discPercent && discPercent >= 25 ? 'Super Deal' : (p.estimated_delivery_minutes <= 10 ? 'Fast Air ETA' : undefined)),
        features: Array.isArray(p.features) ? p.features : [],
        specifications: typeof p.specifications === 'object' && p.specifications !== null ? p.specifications : {},
        flightSpecs: typeof p.flight_specs === 'object' && p.flight_specs !== null ? p.flight_specs : {},
        weight: p.weight || '0.85 kg',
        weightGrams: Number(p.weight_grams || 850),
      };
    },
  },

  // ── CART ──
  cart: {
    get: async (userId: string) => {
      if (!isSupabaseConfigured() || !userId) return { items: [], itemCount: 0, subtotal: 0, deliveryFee: 0, tax: 0, discount: 0, total: 0, totalWeightGrams: 0 };
      let { data: cart } = await supabase
        .from('carts')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!cart) {
        const { data: newCart } = await supabase
          .from('carts')
          .insert({ user_id: userId })
          .select('id')
          .single();
        cart = newCart;
      }

      if (!cart) return { items: [], itemCount: 0, subtotal: 0, deliveryFee: 0, tax: 0, discount: 0, total: 0, totalWeightGrams: 0 };

      const { data: items, error } = await supabase
        .from('cart_items')
        .select(`
          id,
          quantity,
          unit_price,
          product_id,
          products:product_id (*)
        `)
        .eq('cart_id', cart.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching cart items from Supabase:', error);
      }

      const categoryMap: Record<string, ProductCategory> = {
        'cat-medicine': 'Medicine',
        'cat-medical': 'Medicine',
        'cat-food': 'Food',
        'cat-groceries': 'Groceries',
        'cat-tech': 'Electronics',
        'cat-documents': 'Documents',
        'cat-essentials': 'Other',
      };

      const mappedItems = (items || []).filter(item => item.products).map((item: any) => {
        const p = item.products;
        const catName: ProductCategory = categoryMap[p.category_id] || 'Other';
        const img = p.image_url || p.image || p.thumbnail_url || '';
        const secureUnitPrice = Number(p.price || item.unit_price || 0);

        const product: Product = {
          id: p.id,
          name: p.name,
          slug: p.slug,
          brand: p.brand,
          category: catName,
          category_id: p.category_id,
          description: p.description,
          price: secureUnitPrice,
          originalPrice: p.original_price ? Number(p.original_price) : undefined,
          rating: Number(p.rating || 4.8),
          reviewCount: Number(p.review_count ?? p.reviews_count ?? 0),
          image: img,
          thumbnailUrl: p.thumbnail_url || img,
          isDroneEligible: p.is_drone_deliverable ?? true,
          maxPayloadKg: 4.0,
          estimatedDeliveryMins: Number(p.estimated_delivery_minutes || 10),
          inStock: p.stock_status ? p.stock_status !== 'OUT_OF_STOCK' : (p.in_stock ?? true),
          stockCount: Number(p.stock_quantity ?? p.stock_count ?? 50),
          badge: p.badge,
          weightGrams: Number(p.weight_grams || 850),
        };
        return {
          product,
          quantity: item.quantity,
        };
      });

      const subtotal = mappedItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
      // Free drone delivery above ₹500, else ₹49
      const deliveryFee = subtotal > 0 ? (subtotal >= 500 ? 0 : 49) : 0;
      // 5% standard GST/handling
      const tax = Math.round(subtotal * 0.05);
      const total = subtotal + deliveryFee + tax;
      const itemCount = mappedItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalWeightGrams = mappedItems.reduce((sum, item) => sum + (item.product.weightGrams || 850) * item.quantity, 0);

      return {
        items: mappedItems,
        itemCount,
        subtotal,
        deliveryFee,
        tax,
        discount: 0,
        total,
        totalWeightGrams,
      };
    },

    addItem: async (userId: string, productId: string, quantity = 1) => {
      if (!isSupabaseConfigured() || !userId) return;
      let { data: cart } = await supabase
        .from('carts')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!cart) {
        const { data: newCart } = await supabase
          .from('carts')
          .insert({ user_id: userId })
          .select('id')
          .single();
        cart = newCart;
      }

      if (!cart) return;

      // Securely retrieve authoritative product price from Supabase
      const { data: dbProduct } = await supabase
        .from('products')
        .select('id, price')
        .eq('id', productId)
        .single();

      const securePrice = dbProduct ? Number(dbProduct.price) : 0;

      const { data: existing } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('cart_id', cart.id)
        .eq('product_id', productId)
        .single();

      if (existing) {
        await supabase
          .from('cart_items')
          .update({
            quantity: existing.quantity + quantity,
            unit_price: securePrice,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('cart_items')
          .insert({
            cart_id: cart.id,
            product_id: productId,
            quantity,
            unit_price: securePrice
          });
      }
    },

    updateQuantity: async (userId: string, productId: string, quantity: number) => {
      if (!isSupabaseConfigured() || !userId) return;
      const { data: cart } = await supabase.from('carts').select('id').eq('user_id', userId).single();
      if (!cart) return;

      if (quantity <= 0) {
        await supabase.from('cart_items').delete().eq('cart_id', cart.id).eq('product_id', productId);
      } else {
        await supabase.from('cart_items').update({ quantity, updated_at: new Date().toISOString() }).eq('cart_id', cart.id).eq('product_id', productId);
      }
    },

    removeItem: async (userId: string, productId: string) => {
      if (!isSupabaseConfigured() || !userId) return;
      const { data: cart } = await supabase.from('carts').select('id').eq('user_id', userId).single();
      if (!cart) return;

      await supabase.from('cart_items').delete().eq('cart_id', cart.id).eq('product_id', productId);
    },

    clear: async (userId: string) => {
      if (!isSupabaseConfigured() || !userId) return;
      const { data: cart } = await supabase.from('carts').select('id').eq('user_id', userId).single();
      if (!cart) return;

      await supabase.from('cart_items').delete().eq('cart_id', cart.id);
    },
  },

  // ── WISHLIST ──
  wishlist: {
    get: async (userId: string): Promise<Product[]> => {
      if (!isSupabaseConfigured() || !userId) return [];
      let { data: wishlist } = await supabase.from('wishlists').select('id').eq('user_id', userId).single();
      if (!wishlist) {
        const { data: newW } = await supabase.from('wishlists').insert({ user_id: userId }).select('id').single();
        wishlist = newW;
      }
      if (!wishlist) return [];

      const { data: items } = await supabase
        .from('wishlist_items')
        .select(`
          product_id,
          products:product_id (*)
        `)
        .eq('wishlist_id', wishlist.id);

      const categoryMap: Record<string, ProductCategory> = {
        'cat-medicine': 'Medicine',
        'cat-medical': 'Medicine',
        'cat-food': 'Food',
        'cat-groceries': 'Groceries',
        'cat-tech': 'Electronics',
        'cat-documents': 'Documents',
        'cat-essentials': 'Other',
      };

      return (items || []).filter(item => item.products).map((item: any): Product => {
        const p = item.products;
        const catName: ProductCategory = categoryMap[p.category_id] || 'Other';
        const img = p.image_url || p.image || p.thumbnail_url || '';
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          brand: p.brand,
          category: catName,
          category_id: p.category_id,
          description: p.description,
          price: Number(p.price),
          originalPrice: p.original_price ? Number(p.original_price) : undefined,
          rating: Number(p.rating || 4.8),
          reviewCount: Number(p.review_count ?? p.reviews_count ?? 0),
          image: img,
          thumbnailUrl: p.thumbnail_url || img,
          isDroneEligible: p.is_drone_deliverable ?? true,
          maxPayloadKg: 4.0,
          estimatedDeliveryMins: Number(p.estimated_delivery_minutes || 10),
          inStock: p.stock_status ? p.stock_status !== 'OUT_OF_STOCK' : (p.in_stock ?? true),
          stockCount: Number(p.stock_quantity ?? p.stock_count ?? 50),
          badge: p.badge,
          weightGrams: Number(p.weight_grams || 850),
        };
      });
    },

    addItem: async (userId: string, productId: string) => {
      if (!isSupabaseConfigured() || !userId) return;
      let { data: wishlist } = await supabase.from('wishlists').select('id').eq('user_id', userId).single();
      if (!wishlist) {
        const { data: newW } = await supabase.from('wishlists').insert({ user_id: userId }).select('id').single();
        wishlist = newW;
      }
      if (!wishlist) return;

      await supabase.from('wishlist_items').upsert({ wishlist_id: wishlist.id, product_id: productId });
    },

    removeItem: async (userId: string, productId: string) => {
      if (!isSupabaseConfigured() || !userId) return;
      const { data: wishlist } = await supabase.from('wishlists').select('id').eq('user_id', userId).single();
      if (!wishlist) return;

      await supabase.from('wishlist_items').delete().eq('wishlist_id', wishlist.id).eq('product_id', productId);
    },
  },

  // ── ADDRESSES ──
  addresses: {
    getAll: async (userId: string): Promise<CustomerAddress[]> => {
      if (!isSupabaseConfigured() || !userId) return [];
      const { data } = await supabase.from('addresses').select('*').eq('user_id', userId).order('created_at', { ascending: false });

      return (data || []).map((a: any) => ({
        id: a.id,
        customerId: a.user_id,
        name: a.name,
        phone: a.phone,
        label: a.label,
        building: a.building,
        street: a.street,
        area: a.area || '',
        city: a.city,
        state: a.state,
        postalCode: a.postal_code,
        latitude: Number(a.latitude),
        longitude: Number(a.longitude),
        dropZoneType: a.drop_zone_type,
        instructions: a.instructions || '',
        isDefault: a.is_default,
      }));
    },

    create: async (userId: string, addr: any): Promise<CustomerAddress> => {
      if (addr.isDefault) {
        await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId);
      }
      const { data, error } = await supabase
        .from('addresses')
        .insert({
          user_id: userId,
          name: addr.name,
          phone: addr.phone,
          label: addr.label || 'Home',
          building: addr.building,
          street: addr.street,
          area: addr.area || '',
          city: addr.city,
          state: addr.state,
          postal_code: addr.postalCode,
          latitude: addr.latitude || 37.7749,
          longitude: addr.longitude || -122.4194,
          drop_zone_type: addr.dropZoneType || 'Lawn',
          instructions: addr.instructions || '',
          is_default: Boolean(addr.isDefault),
        })
        .select('*')
        .single();

      if (error) throw error;
      return {
        id: data.id,
        customerId: data.user_id,
        name: data.name,
        phone: data.phone,
        label: data.label,
        building: data.building,
        street: data.street,
        area: data.area || '',
        city: data.city,
        state: data.state,
        postalCode: data.postal_code,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        dropZoneType: data.drop_zone_type,
        instructions: data.instructions || '',
        isDefault: data.is_default,
      };
    },

    delete: async (userId: string, id: string) => {
      await supabase.from('addresses').delete().eq('id', id).eq('user_id', userId);
    },

    setDefault: async (userId: string, id: string) => {
      await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId);
      await supabase.from('addresses').update({ is_default: true }).eq('id', id).eq('user_id', userId);
    },
  },

  // ── ORDERS ──
  orders: {
    getAll: async (userId: string): Promise<CustomerOrder[]> => {
      if (!isSupabaseConfigured() || !userId) return [];
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      return (orders || []).map((o: any): CustomerOrder => ({
        id: o.id,
        customerId: o.user_id,
        items: (o.order_items || []).map((it: any) => ({
          product: {
            id: it.product_id,
            name: it.product_name,
            image: it.product_image,
            price: Number(it.unit_price),
            description: '',
            category: 'Other' as ProductCategory,
            rating: 5,
            reviewCount: 0,
            inStock: true,
            weightGrams: 850,
            isDroneEligible: true,
            maxPayloadKg: 4.0,
            estimatedDeliveryMins: 12,
            stockCount: 50,
          },
          quantity: it.quantity,
        })),
        status: o.status as CustomerOrderStatus,
        deliveryAddress: o.delivery_address,
        estimatedDeliveryTime: '12 mins',
        deliveryOtp: o.delivery_otp,
        subtotal: Number(o.subtotal),
        deliveryFee: Number(o.delivery_fee),
        tax: Number(o.tax),
        discount: Number(o.discount || 0),
        total: Number(o.total),
        paymentMethod: o.payment_method as PaymentMethod,
        paymentStatus: o.payment_status as PaymentStatus,
        deliverySpeed: o.delivery_speed as DeliverySpeedOption,
        isCancellable: o.is_cancellable,
        timeline: o.timeline || [],
        completedAt: o.completed_at,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
      }));
    },

    getById: async (userId: string, id: string): Promise<CustomerOrder | null> => {
      if (!isSupabaseConfigured() || !userId) return null;
      const { data: o, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (error || !o) return null;

      return {
        id: o.id,
        customerId: o.user_id,
        items: (o.order_items || []).map((it: any) => ({
          product: {
            id: it.product_id,
            name: it.product_name,
            image: it.product_image,
            price: Number(it.unit_price),
            description: '',
            category: 'Other' as ProductCategory,
            rating: 5,
            reviewCount: 0,
            inStock: true,
            weightGrams: 850,
            isDroneEligible: true,
            maxPayloadKg: 4.0,
            estimatedDeliveryMins: 12,
            stockCount: 50,
          },
          quantity: it.quantity,
        })),
        status: o.status as CustomerOrderStatus,
        deliveryAddress: o.delivery_address,
        estimatedDeliveryTime: '12 mins',
        deliveryOtp: o.delivery_otp,
        subtotal: Number(o.subtotal),
        deliveryFee: Number(o.delivery_fee),
        tax: Number(o.tax),
        discount: Number(o.discount || 0),
        total: Number(o.total),
        paymentMethod: o.payment_method as PaymentMethod,
        paymentStatus: o.payment_status as PaymentStatus,
        deliverySpeed: o.delivery_speed as DeliverySpeedOption,
        isCancellable: o.is_cancellable,
        timeline: o.timeline || [],
        completedAt: o.completed_at,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
      };
    },

    create: async (userId: string, orderData: any): Promise<CustomerOrder> => {
      const orderId = `ORD-SKY-${Date.now().toString().slice(-6)}`;
      const orderNumber = `SKY-${Date.now().toString().slice(-8)}`;
      const otp = Math.floor(1000 + Math.random() * 9000).toString();

      const timeline = [
        { status: 'Order Placed' as CustomerOrderStatus, timestamp: 'Just now', completed: true, description: 'Order received and payment authorized' },
        { status: 'Order Confirmed' as CustomerOrderStatus, timestamp: 'Pending', completed: false, description: 'Payload assembly scheduled' },
        { status: 'Preparing' as CustomerOrderStatus, timestamp: 'Pending', completed: false, description: 'Packing into aerodynamic air capsule' },
        { status: 'Drone Assigned' as CustomerOrderStatus, timestamp: 'Pending', completed: false, description: 'Assigned autonomous flight unit' },
        { status: 'Out for Delivery' as CustomerOrderStatus, timestamp: 'Pending', completed: false, description: 'En route via designated air corridor' },
        { status: 'Arriving' as CustomerOrderStatus, timestamp: 'Pending', completed: false, description: 'Hovering at 5m and verifying clear drop zone' },
        { status: 'Delivered' as CustomerOrderStatus, timestamp: 'Pending', completed: false, description: 'Delivery complete' },
      ];

      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          id: orderId,
          user_id: userId,
          order_number: orderNumber,
          status: 'Order Placed',
          delivery_address: orderData.deliveryAddress,
          flight_path: [],
          eta_minutes: 12,
          delivery_otp: otp,
          subtotal: orderData.subtotal,
          delivery_fee: orderData.deliveryFee,
          tax: orderData.tax,
          discount: orderData.discount || 0,
          total: orderData.total,
          payment_method: orderData.paymentMethod || 'Credit Card',
          payment_status: 'Paid',
          delivery_speed: orderData.deliverySpeed || 'standard',
          is_cancellable: true,
          timeline,
        })
        .select('*')
        .single();

      if (error) throw error;

      // Insert Order Items
      if (orderData.items && orderData.items.length > 0) {
        const itemInserts = orderData.items.map((item: any) => ({
          order_id: orderId,
          product_id: item.product.id,
          product_name: item.product.name,
          product_image: item.product.image,
          unit_price: item.product.price,
          quantity: item.quantity,
          total_price: item.product.price * item.quantity,
        }));

        await supabase.from('order_items').insert(itemInserts);
      }

      // Clear Cart after successful order
      await supabaseService.cart.clear(userId);

      // Create Order Notification
      await supabase.from('notifications').insert({
        user_id: userId,
        order_id: orderId,
        title: 'Order Confirmed 🎉',
        message: `Your order #${orderNumber} has been received and scheduled for autonomous air launch.`,
        type: 'order_update',
        action_url: `/tracking/${orderId}`,
      });

      return (await supabaseService.orders.getById(userId, orderId))!;
    },

    cancel: async (userId: string, orderId: string, reason: string) => {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'Cancelled',
          is_cancellable: false,
          cancellation_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('user_id', userId);

      if (error) throw error;
      return (await supabaseService.orders.getById(userId, orderId))!;
    },

    rate: async (userId: string, orderId: string, rating: number, feedback?: string) => {
      await supabase
        .from('orders')
        .update({
          rating,
          rating_feedback: feedback || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('user_id', userId);
    },
  },

  // ── NOTIFICATIONS ──
  notifications: {
    getAll: async (userId: string): Promise<CustomerNotification[]> => {
      if (!isSupabaseConfigured() || !userId) return [];
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      return (data || []).map((n: any): CustomerNotification => ({
        id: n.id,
        customerId: n.user_id,
        orderId: n.order_id,
        title: n.title,
        message: n.message,
        category: (n.type === 'order_update' ? 'order' : 'system') as NotificationCategory,
        read: n.is_read,
        createdAt: n.created_at,
        actionUrl: n.action_url,
      }));
    },

    markAsRead: async (userId: string, id: string) => {
      if (!isSupabaseConfigured() || !userId) return;
      await supabase.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', userId);
    },

    markAllAsRead: async (userId: string) => {
      if (!isSupabaseConfigured() || !userId) return;
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
    },

    clear: async (userId: string, id: string) => {
      if (!isSupabaseConfigured() || !userId) return;
      await supabase.from('notifications').delete().eq('id', id).eq('user_id', userId);
    },
  },

  // ── SUPPORT & FAQS ──
  support: {
    getFaqs: async (): Promise<FAQItem[]> => {
      if (!isSupabaseConfigured()) return [];
      const { data } = await supabase.from('faqs').select('*').order('created_at');
      return (data || []).map((f: any) => ({
        id: f.id,
        category: f.category,
        question: f.question,
        answer: f.answer,
      }));
    },

    getTickets: async (userId: string): Promise<SupportTicket[]> => {
      if (!isSupabaseConfigured() || !userId) return [];
      const { data } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      return (data || []).map((t: any): SupportTicket => ({
        id: t.id,
        customerId: t.user_id,
        orderId: t.order_id,
        category: t.category as SupportTicketCategory,
        subject: t.subject,
        description: t.description,
        status: (t.status === 'open' ? 'Open' : t.status === 'in_progress' ? 'In Progress' : 'Resolved') as SupportTicketStatus,
        priority: 'Medium',
        messages: [],
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }));
    },

    createTicket: async (userId: string, data: any): Promise<SupportTicket> => {
      const ticketId = `TCK-${Math.floor(1000 + Math.random() * 9000)}`;
      const { data: created, error } = await supabase
        .from('support_tickets')
        .insert({
          id: ticketId,
          user_id: userId,
          order_id: data.orderId || null,
          category: data.category,
          subject: data.subject,
          description: data.description,
          status: 'open',
          priority: 'medium',
        })
        .select('*')
        .single();

      if (error) throw error;
      return {
        id: created.id,
        customerId: created.user_id,
        orderId: created.order_id,
        category: created.category as SupportTicketCategory,
        subject: created.subject,
        description: created.description,
        status: 'Open',
        priority: 'Medium',
        messages: [],
        createdAt: created.created_at,
        updatedAt: created.updated_at,
      };
    },
  },
};
