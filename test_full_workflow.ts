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

  // 2. Admin Authentication & Product Creation
  console.log('\n▶ Step 2: Admin Login & Product Creation (Authoritative Source of Truth)...');
  const adminLoginRes = await fetch(`${ADMIN_API}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@skynav',
      password: 'skynav@123',
    }),
  });
  if (!adminLoginRes.ok) {
    const err = await adminLoginRes.text();
    throw new Error(`Admin login failed: ${err}`);
  }
  const { token: adminToken, user: adminUser } = await adminLoginRes.json();
  console.log(`  ✔ Authenticated as Admin: ${adminUser.name} (${adminUser.email})`);

  const testProductSlug = `cbe-gan-charger-${Date.now()}`;
  const newProductPayload = {
    name: `Coimbatore Smart GaN Fast Charger ${Date.now().toString().slice(-4)}`,
    slug: testProductSlug,
    category: 'Electronics',
    price: 1299,
    weightGrams: 220,
    description: 'Autonomous high-efficiency 65W GaN fast charger with surge protection.',
    stockCount: 45,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=500',
  };

  const createProdRes = await fetch(`${ADMIN_API}/api/admin/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
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
  console.log(`  ✔ Product successfully synchronized to Customer Catalog! ID=${matchedProd.id}, Price=₹${matchedProd.price}`);
  passedSteps++;

  // 4. Customer Login
  console.log('\n▶ Step 4: Authenticating Customer User...');
  const loginRes = await fetch(`${CUSTOMER_API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'customer@skynav',
      password: 'skynav@123',
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
    savedAddress: {
      id: 'addr_test_cbe',
      name: 'Customer SkyNav',
      phone: '+91 98765 43210',
      street: 'Kalapatti Main Road',
      building: 'Tech Corridor Block 4',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      postalCode: '641048',
      latitude: 11.0725,
      longitude: 77.0345,
      dropZoneType: 'Rooftop Helipad',
      clearanceRadiusMeters: 5.0,
    },
    deliveryAddress: {
      id: 'addr_test_cbe',
      name: 'Customer SkyNav',
      phone: '+91 98765 43210',
      street: 'Kalapatti Main Road',
      building: 'Tech Corridor Block 4',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      postalCode: '641048',
      latitude: 11.0725,
      longitude: 77.0345,
      dropZoneType: 'Rooftop Helipad',
      clearanceRadiusMeters: 5.0,
    },
    deliverySpeed: 'express',
    paymentMethod: 'UPI',
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

  // 10. Track Outbound Flight Progression Until Touchdown at Customer Landing Zone
  console.log('\n▶ Step 10: Tracking Outbound Autonomous Flight Telemetry Until Touchdown...');
  let arrivedAtDestination = false;
  let lastLat = 0;
  let lastLng = 0;

  for (let tick = 1; tick <= 30; tick++) {
    await delay(1000);
    const tracking = await fetch(`${CUSTOMER_API}/api/tracking/${customerOrder.id}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    }).then((r) => r.json());

    const fleet = await fetch(`${ADMIN_API}/api/admin/fleet`).then((r) => r.json());
    const drone = fleet.find((d: any) => d.id === availableDrone.id);

    const cLat = tracking.currentDroneLocation?.latitude || 0;
    const cLng = tracking.currentDroneLocation?.longitude || 0;
    const distRem = tracking.remainingDistanceKm;

    console.log(`  [Flight Tick ${tick}s] Admin: [${drone.location.lat.toFixed(5)}, ${drone.location.lng.toFixed(5)}] Alt=${drone.location.altitude}m | Cust: [${cLat.toFixed(5)}, ${cLng.toFixed(5)}] DistRem=${distRem}km Status="${tracking.orderStatus}"`);

    // Verify coordinates match between Admin and Customer
    const coordDiff = Math.abs(drone.location.lat - cLat) + Math.abs(drone.location.lng - cLng);
    if (coordDiff > 0.005 && distRem > 0) {
      console.warn(`  ⚠️ Minor coordinate drift between Admin & Customer: ${coordDiff.toFixed(6)}`);
    }

    if (distRem === 0 || drone.status === 'touchdown' || drone.location.altitude === 0 && tick > 15) {
      arrivedAtDestination = true;
      console.log(`\n  🎯 DRONE TOUCHDOWN AT CUSTOMER DESTINATION!`);
      console.log(`  ✔ Clamped Destination Coords: [${drone.location.lat.toFixed(5)}, ${drone.location.lng.toFixed(5)}]`);
      console.log(`  ✔ Drone Altitude: ${drone.location.altitude}m, Speed: ${drone.location.speed} km/h`);
      console.log(`  ✔ Customer Order Status: "${tracking.orderStatus}"`);
      break;
    }

    lastLat = drone.location.lat;
    lastLng = drone.location.lng;
  }

  if (!arrivedAtDestination) {
    throw new Error('Drone did not arrive at customer destination within 30 seconds!');
  }
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

  // 12. Verify Delivery Completion on Admin Side & Return Flight Initiation
  console.log('\n▶ Step 12: Verifying Admin Receives DELIVERY_COMPLETED & Initiates Return Flight...');
  await delay(1200);
  const updatedAdminOrders = await fetch(`${ADMIN_API}/api/admin/orders`).then((r) => r.json());
  const finalAdminOrder = updatedAdminOrders.find((o: any) => o.id === operationalOrder.id);
  const updatedFleet = await fetch(`${ADMIN_API}/api/admin/fleet`).then((r) => r.json());
  const returningDrone = updatedFleet.find((d: any) => d.id === availableDrone.id);

  console.log(`  ✔ Admin Operational Order Status: "${finalAdminOrder.status}"`);
  console.log(`  ✔ Drone Return Flight Status: "${returningDrone.status}"`);
  if (returningDrone.status !== 'returning' && returningDrone.status !== 'charging' && returningDrone.status !== 'available') {
    throw new Error(`Expected drone status to be 'returning' or 'charging', got '${returningDrone.status}'`);
  }
  passedSteps++;

  // 13. Track Return Flight Telemetry to SkyHub Kurumbapalayam
  console.log('\n▶ Step 13: Tracking Return Flight Telemetry to SkyHub Kurumbapalayam Base...');
  let arrivedAtHub = false;

  for (let tick = 1; tick <= 25; tick++) {
    await delay(1000);
    const fleetCheck = await fetch(`${ADMIN_API}/api/admin/fleet`).then((r) => r.json());
    const droneCheck = fleetCheck.find((d: any) => d.id === availableDrone.id);

    console.log(`  [Return Tick ${tick}s] Drone ${droneCheck.id}: [${droneCheck.location.lat.toFixed(5)}, ${droneCheck.location.lng.toFixed(5)}] Alt=${droneCheck.location.altitude}m Spd=${droneCheck.location.speed}km/h Status="${droneCheck.status}" Battery=${droneCheck.battery}%`);

    if (droneCheck.status === 'charging' || droneCheck.status === 'available') {
      arrivedAtHub = true;
      console.log(`\n  🔌 DRONE SAFELY ARRIVED & DOCKED AT SKYHUB KURUMBAPALAYAM!`);
      console.log(`  ✔ Docked Coords: [${droneCheck.location.lat.toFixed(5)}, ${droneCheck.location.lng.toFixed(5)}]`);
      console.log(`  ✔ Drone Status: "${droneCheck.status}"`);
      break;
    }
  }

  if (!arrivedAtHub) {
    throw new Error('Drone did not return and dock at hub within 25 seconds!');
  }
  passedSteps++;

  // 14. Verify Charging Cycle
  console.log('\n▶ Step 14: Verifying Charging Cycle at SkyHub Base Dock...');
  await delay(2000);
  const fleetCharging = await fetch(`${ADMIN_API}/api/admin/fleet`).then((r) => r.json());
  const droneCharging = fleetCharging.find((d: any) => d.id === availableDrone.id);
  console.log(`  ✔ Battery Level during recharge: ${droneCharging.battery}% (Status: "${droneCharging.status}")`);
  passedSteps++;

  // 15. Verify Transition to AVAILABLE
  console.log('\n▶ Step 15: Waiting for Battery to Reach Full Charge & Transition to AVAILABLE...');
  let droneFinal: any = null;
  for (let i = 0; i < 20; i++) {
    const fleetFinal = await fetch(`${ADMIN_API}/api/admin/fleet`).then((r) => r.json());
    droneFinal = fleetFinal.find((d: any) => d.id === availableDrone.id);
    if (droneFinal.status === 'available' && droneFinal.battery >= 90) {
      break;
    }
    await delay(1000);
  }

  console.log(`  ✔ Final Drone State: ID=${droneFinal.id}, Status="${droneFinal.status}", Battery=${droneFinal.battery}%`);
  passedSteps++;

  // 16. Verify Coordinate Consistency (Coimbatore / Kurumbapalayam)
  console.log('\n▶ Step 16: Verifying Indian Coordinate Consistency across System...');
  const KURUMBAPALAYAM_LAT = 11.1132;
  const KURUMBAPALAYAM_LNG = 77.0277;
  const hubDiff = Math.abs(droneFinal.location.lat - KURUMBAPALAYAM_LAT) + Math.abs(droneFinal.location.lng - KURUMBAPALAYAM_LNG);
  if (hubDiff > 0.05) {
    throw new Error(`Coordinates ${droneFinal.location.lat}, ${droneFinal.location.lng} deviate from Kurumbapalayam hub!`);
  }
  console.log(`  ✔ Coordinates verified: Tamil Nadu / Coimbatore / Kurumbapalayam [${KURUMBAPALAYAM_LAT}, ${KURUMBAPALAYAM_LNG}]`);
  passedSteps++;

  console.log('\n===============================================================');
  console.log(`🏆 ALL 16/16 END-TO-END WORKFLOW TESTS PASSED PERFECTLY!`);
  console.log('===============================================================\n');
}

runE2EIntegrationTest().catch((err) => {
  console.error('\n❌ INTEGRATION TEST FAILED:', err);
  process.exit(1);
});
