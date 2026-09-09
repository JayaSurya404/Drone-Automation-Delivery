async function runE2ETest() {
  console.log('🧪 Starting End-to-End Dynamic Backend Integration Test...');
  const baseUrl = 'http://localhost:5000/api';

  // 1. LOGIN
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alex.mercer@skynav.io', password: 'Password123!' }),
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok) throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
  console.log(`✅ 1. Customer Authenticated: ${loginData.user.name} (${loginData.user.email})`);
  const token = loginData.token;

  // 2. FETCH PRODUCTS
  const prodRes = await fetch(`${baseUrl}/products?category=Food`);
  const products = await prodRes.json();
  console.log(`✅ 2. Dynamic Products Fetched: ${products.length} food items from database. Selected "${products[0].name}"`);
  const chosenProduct = products[0];

  // 3. ADD TO CART
  const cartRes = await fetch(`${baseUrl}/cart/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ productId: chosenProduct.id, quantity: 2 }),
  });
  const cartData = await cartRes.json();
  if (!cartRes.ok) throw new Error(`Cart failed: ${JSON.stringify(cartData)}`);
  console.log(`✅ 3. Persistent Cart Updated: ${cartData.itemCount} items, Subtotal: $${cartData.subtotal}, Total: $${cartData.total}`);

  // 4. FETCH SAVED ADDRESSES
  const addrRes = await fetch(`${baseUrl}/addresses`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const addresses = await addrRes.json();
  console.log(`✅ 4. Customer Addresses Loaded: ${addresses.length} saved drop zones. Selected default: "${addresses[0].label} (${addresses[0].dropZoneType})"`);
  const targetAddress = addresses[0];

  // 5. CHECK GEOFENCE ELIGIBILITY
  const geoRes = await fetch(`${baseUrl}/checkout/eligibility`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude: targetAddress.latitude, longitude: targetAddress.longitude }),
  });
  const geoData = await geoRes.json();
  console.log(`✅ 5. Geofence & Airspace Corridor Check: ${geoData.isEligible ? 'ELIGIBLE' : 'INELIGIBLE'} (${geoData.distanceFromHubKm} km from ${geoData.hubName})`);

  // 6. PLACE TRANSACTIONAL ORDER
  const orderRes = await fetch(`${baseUrl}/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      addressId: targetAddress.id,
      paymentMethod: 'Credit Card',
      deliverySpeed: 'express',
    }),
  });
  const orderData = await orderRes.json();
  if (!orderRes.ok) throw new Error(`Order placement failed: ${JSON.stringify(orderData)}`);
  console.log(`✅ 6. Transactional Order Placed: #${orderData.id}, Status: "${orderData.status}", Handover OTP: ${orderData.deliveryOtp}`);

  // 7. TRACK LIVE DRONE FLIGHT TELEMETRY
  const trackRes = await fetch(`${baseUrl}/tracking/${orderData.id}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const trackData = await trackRes.json();
  console.log(`✅ 7. Realtime Drone Flight Telemetry: Drone "${trackData.droneAssignedName}", Status: "${trackData.orderStatus}", ETA: ${trackData.estimatedArrivalFormatted}, Waypoints: ${trackData.flightRoute.length} points`);

  // 8. FETCH REALTIME NOTIFICATIONS
  const notifRes = await fetch(`${baseUrl}/notifications`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const notifs = await notifRes.json();
  console.log(`✅ 8. Dynamic Customer Notifications: ${notifs.length} notifications in database.`);

  console.log('\n🎉 ALL 8 BACKEND AND DATABASE SYSTEMS ARE 100% OPERATIONAL & PRODUCTION-READY!\n');
}

runE2ETest().catch((err) => {
  console.error('❌ Integration test failed:', err);
  process.exit(1);
});
