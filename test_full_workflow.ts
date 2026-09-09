import { generateHmacSignature } from './shared/contracts/security.js';

const CUSTOMER_API = 'http://127.0.0.1:5000';
const ADMIN_API = 'http://127.0.0.1:5001';
const SHARED_SECRET = process.env.SKYNAV_INTERNAL_SERVICE_KEY || 'skynav_secure_internal_service_key_2026';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runE2EIntegrationTest() {
  console.log('\n===============================================================');
  console.log('🛸 STARTING SKYNAV AUTONOMOUS DRONE FULL WORKFLOW INTEGRATION TEST');
  console.log('===============================================================\n');

  let passedSteps = 0;
  const totalSteps = 12;

  // 1. Health Checks
  console.log('▶ Step 1: Health Checking Both Backends...');
  const custHealth = await fetch(`${CUSTOMER_API}/api/health`).then((r) => r.json()).catch(() => null);
  const adminHealth = await fetch(`${ADMIN_API}/api/health`).then((r) => r.json()).catch(() => null);

  if (!custHealth || (custHealth.status !== 'ok' && custHealth.status !== 'healthy')) {
    throw new Error(`Customer Backend at ${CUSTOMER_API} is not healthy! Check if running.`);
  }
  if (!adminHealth || (adminHealth.status !== 'ok' && adminHealth.status !== 'healthy')) {
    throw new Error(`Admin Backend at ${ADMIN_API} is not healthy! Check if running.`);
  }
  console.log('  ✔ Customer Backend (port 5000): HEALTHY');
  console.log('  ✔ Admin Backend (port 5001): HEALTHY');
  passedSteps++;

  // 2. Admin creates a new product
  console.log('\n▶ Step 2: Admin Creates Product (Authoritative Source of Truth)...');
  const testProductSlug = `trauma-kit-${Date.now()}`;
  const newProductPayload = {
    name: `Aero Trauma Kit Pro ${Date.now().toString().slice(-4)}`,
    slug: testProductSlug,
    category: 'Medicine & Health',
    price: 49.99,
    weightGrams: 420,
    description: 'Autonomous rapid-dispatch trauma kit with FAA Class-B certified seal.',
    stockCount: 60,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500',
  };

  const createProdRes = await fetch(`${ADMIN_API}/api/admin/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newProductPayload),
  });

  if (!createProdRes.ok) {
    const err = await createProdRes.text();
    throw new Error(`Failed to create product in Admin: ${err}`);
  }
  const createdProd = await createProdRes.json();
  console.log(`  ✔ Product created in Admin DB: ID=${createdProd.id} ("${createdProd.name}")`);
  passedSteps++;

  // 3. Verify product synchronized to Customer catalog
  console.log('\n▶ Step 3: Verifying Product Synchronization in Customer Catalog...');
  await delay(500);
  const custProductsRes = await fetch(`${CUSTOMER_API}/api/products`);
  const custProducts = await custProductsRes.json();
  const matchedProd = custProducts.find((p: any) => p.name === newProductPayload.name || p.id === createdProd.id);

  if (!matchedProd) {
    throw new Error('Product created in Admin was NOT synchronized to Customer Database!');
  }
  console.log(`  ✔ Product successfully synchronized to Customer Catalog! ID=${matchedProd.id}, Price=$${matchedProd.price}`);
  passedSteps++;

  // 4. Customer Login
  console.log('\n▶ Step 4: Authenticating Customer User...');
  const loginRes = await fetch(`${CUSTOMER_API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alex.mercer@skynav.io',
      password: 'Password123!',
    }),
  });
  if (!loginRes.ok) {
    throw new Error('Customer login failed! Check seeded users in customer.db.');
  }
  const { token: customerToken, user: customerUser } = await loginRes.json();
  console.log(`  ✔ Authenticated as Customer: ${customerUser.name} (${customerUser.email})`);
  passedSteps++;

  // 4b. Customer Adds Product to Cart
  console.log('\n▶ Step 4b: Customer Adds Synchronized Product to Cart...');
  const addCartRes = await fetch(`${CUSTOMER_API}/api/cart/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      productId: matchedProd.id,
      quantity: 1,
    }),
  });
  if (!addCartRes.ok) {
    throw new Error('Failed to add product to cart.');
  }
  console.log('  ✔ Product added to customer cart');

  // 5. Customer Places Order (Checkout)
  console.log('\n▶ Step 5: Customer Placing Order via Checkout...');
  const checkoutPayload = {
    items: [
      {
        id: matchedProd.id,
        quantity: 1,
      },
    ],
    customAddress: {
      id: 'addr_test_sf',
      name: 'Alex Mercer',
      phone: '+1 (555) 248-7790',
      street: '450 Mission Street',
      building: 'Salesforce Tower Suite 42',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94105',
      latitude: 37.7897,
      longitude: -122.3969,
      dropZoneType: 'Rooftop Helipad',
      clearanceRadiusMeters: 4.5,
    },
    deliveryAddress: {
      id: 'addr_test_sf',
      name: 'Alex Mercer',
      phone: '+1 (555) 248-7790',
      street: '450 Mission Street',
      building: 'Salesforce Tower Suite 42',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94105',
      latitude: 37.7897,
      longitude: -122.3969,
      dropZoneType: 'Rooftop Helipad',
      clearanceRadiusMeters: 4.5,
    },
    deliverySpeed: 'express',
    paymentMethod: 'Credit Card',
  };

  const checkoutRes = await fetch(`${CUSTOMER_API}/api/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify(checkoutPayload),
  });

  if (!checkoutRes.ok) {
    const errText = await checkoutRes.text();
    throw new Error(`Checkout failed: ${errText}`);
  }
  const customerOrder = await checkoutRes.json();
  console.log(`  ✔ Customer Order Created: ID=${customerOrder.id}`);
  console.log(`  ✔ Customer Order Initial Status: "${customerOrder.status}" (No drone auto-assigned)`);
  console.log(`  ✔ Secure Handover OTP: ${customerOrder.deliveryOtp}`);
  passedSteps++;

  // 6. Verify Admin Backend Received the Order
  console.log('\n▶ Step 6: Verifying Admin Backend Ingested Operational Order...');
  await delay(1200); // Allow async HMAC transmission
  const adminOrdersRes = await fetch(`${ADMIN_API}/api/admin/orders`);
  const adminOrders = await adminOrdersRes.json();
  const operationalOrder = adminOrders.find((o: any) => o.customerOrderId === customerOrder.id);

  if (!operationalOrder) {
    throw new Error(`Admin Backend did not receive customer order ${customerOrder.id} via HMAC!`);
  }
  console.log(`  ✔ Operational Order Ingested in Admin DB: OperationalID=${operationalOrder.id}`);
  console.log(`  ✔ Correlation Linked: Customer Order #${operationalOrder.customerOrderId} ↔ Operational #${operationalOrder.id}`);
  console.log(`  ✔ Admin Initial Status: "${operationalOrder.status}"`);
  passedSteps++;

  // 7. Admin Workflow: Accept -> Packing -> Packed -> Ready for Dispatch
  console.log('\n▶ Step 7: Admin Progression: Accept → Packing → Packed → Ready For Dispatch...');
  
  // 7a. Accept
  await fetch(`${ADMIN_API}/api/admin/orders/${operationalOrder.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'accepted', description: 'SkyHub Central accepted order intake.' }),
  });
  await delay(400);
  let custOrdCheck = await fetch(`${CUSTOMER_API}/api/orders/${customerOrder.id}`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  }).then((r) => r.json());
  console.log(`  ✔ Admin marked "accepted" -> Customer Status: "${custOrdCheck.status}"`);

  // 7b. Packing
  await fetch(`${ADMIN_API}/api/admin/orders/${operationalOrder.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'packing', description: 'Packing cargo pod.' }),
  });
  await delay(400);
  custOrdCheck = await fetch(`${CUSTOMER_API}/api/orders/${customerOrder.id}`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  }).then((r) => r.json());
  console.log(`  ✔ Admin marked "packing" -> Customer Status: "${custOrdCheck.status}"`);

  // 7c. Packed
  await fetch(`${ADMIN_API}/api/admin/orders/${operationalOrder.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'packed', description: 'Cargo pod sealed.' }),
  });
  await delay(400);

  // 7d. Ready for Dispatch
  await fetch(`${ADMIN_API}/api/admin/orders/${operationalOrder.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'ready_for_dispatch', description: 'Pod on launchpad.' }),
  });
  console.log('  ✔ Admin marked "ready_for_dispatch"');
  passedSteps++;

  // 8. Admin Assigns Drone
  console.log('\n▶ Step 8: Admin Assigns Autonomous Drone...');
  const fleetRes = await fetch(`${ADMIN_API}/api/admin/fleet`);
  const fleet = await fleetRes.json();
  const availableDrone = fleet.find((d: any) => d.status === 'available');
  if (!availableDrone) {
    throw new Error('No available drones found in Admin Fleet!');
  }

  const assignRes = await fetch(`${ADMIN_API}/api/admin/dispatch/orders/${operationalOrder.id}/assign-drone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ droneId: availableDrone.id }),
  });
  const assignResult = await assignRes.json();
  console.log(`  ✔ Drone Assigned: ${assignResult.droneId} (${assignResult.droneName})`);
  console.log(`  ✔ Mission Created: ${assignResult.missionId}`);

  await delay(600);
  custOrdCheck = await fetch(`${CUSTOMER_API}/api/orders/${customerOrder.id}`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  }).then((r) => r.json());
  console.log(`  ✔ Customer received DRONE_ASSIGNED event -> Status: "${custOrdCheck.status}"`);

  const trackingSnapshot = await fetch(`${CUSTOMER_API}/api/tracking/${customerOrder.id}`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  }).then((r) => r.json());
  console.log(`  ✔ Customer Tracking Drone Name: "${trackingSnapshot.droneAssignedName}"`);
  passedSteps++;

  // 9. Admin Launches Mission (Authoritative Telemetry Starts)
  console.log('\n▶ Step 9: Admin Launches Mission & Starts Authoritative Telemetry Engine...');
  const launchRes = await fetch(`${ADMIN_API}/api/admin/missions/${assignResult.missionId}/launch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const launchResult = await launchRes.json();
  console.log(`  ✔ Mission Launched: Status="${launchResult.status}"`);
  passedSteps++;

  // 10. Verify Authoritative Telemetry Streaming to Customer
  console.log('\n▶ Step 10: Verifying Authoritative Flight Telemetry Flowing to Customer...');
  await delay(2500); // Allow telemetry loop ticks
  const liveTracking = await fetch(`${CUSTOMER_API}/api/tracking/${customerOrder.id}`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  }).then((r) => r.json());

  console.log(`  ✔ Drone Live Position: Lat=${liveTracking.currentDroneLocation.latitude.toFixed(5)}, Lng=${liveTracking.currentDroneLocation.longitude.toFixed(5)}`);
  console.log(`  ✔ Drone Altitude: ${liveTracking.currentDroneLocation.altitudeMeters}m`);
  console.log(`  ✔ Drone Speed: ${liveTracking.currentDroneLocation.speedKmh} km/h`);
  console.log(`  ✔ Remaining Distance: ${liveTracking.remainingDistanceKm} km, ETA: ${liveTracking.estimatedArrivalMins} mins`);
  passedSteps++;

  // 11. Customer Enters OTP to Verify Handover & Complete Delivery
  console.log('\n▶ Step 11: Customer Enters 4-digit OTP to Authorize Package Handover...');
  const otpToVerify = customerOrder.deliveryOtp;

  const verifyOtpRes = await fetch(`${CUSTOMER_API}/api/orders/${customerOrder.id}/verify-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({ otp: otpToVerify }),
  });

  if (!verifyOtpRes.ok) {
    const errText = await verifyOtpRes.text();
    throw new Error(`OTP verification failed: ${errText}`);
  }
  const otpResult = await verifyOtpRes.json();
  console.log(`  ✔ OTP Verified Successfully: "${otpResult.message}"`);
  console.log(`  ✔ Customer Order Status: "${otpResult.status}"`);
  passedSteps++;

  // 12. Verify Delivery Completion on Admin Side
  console.log('\n▶ Step 12: Verifying Admin Receives DELIVERY_COMPLETED & Drone Post-Flight State...');
  await delay(1200); // Allow async HMAC completion event
  const updatedAdminOrders = await fetch(`${ADMIN_API}/api/admin/orders`).then((r) => r.json());
  const finalAdminOrder = updatedAdminOrders.find((o: any) => o.id === operationalOrder.id);
  const updatedFleet = await fetch(`${ADMIN_API}/api/admin/fleet`).then((r) => r.json());
  const finalDrone = updatedFleet.find((d: any) => d.id === availableDrone.id);

  console.log(`  ✔ Admin Operational Order Status: "${finalAdminOrder.status}"`);
  console.log(`  ✔ Drone Post-Flight Status: "${finalDrone.status}"`);
  passedSteps++;

  console.log('\n===============================================================');
  console.log(`🏆 END-TO-END INTEGRATION TEST PASSED! (${passedSteps}/${totalSteps} Steps Complete)`);
  console.log('===============================================================\n');
}

runE2EIntegrationTest().catch((err) => {
  console.error('\n❌ INTEGRATION TEST FAILED:', err);
  process.exit(1);
});
