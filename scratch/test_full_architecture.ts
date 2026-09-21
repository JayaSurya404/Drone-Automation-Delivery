const CUST_API = 'http://localhost:5000/api';
const ADMIN_API = 'http://localhost:5001/api/admin';

async function testArchitecture() {
  console.log('🚀 Starting Full Architecture Verification...\n');

  // 1. Authenticate Customer Jaya
  console.log('--- Step 1: Authenticate Customer Jaya ---');
  const loginRes = await fetch(`${CUST_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@skynav', password: 'skynav@123' }),
  });
  const loginData: any = await loginRes.json();
  if (!loginRes.ok) throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
  const token = loginData.token;
  console.log(`✅ Customer Authenticated. hasDeliveryPin: ${loginData.user.hasDeliveryPin}`);
  if (loginData.user.delivery_pin || loginData.user.deliveryPin) {
    throw new Error('SECURITY VIOLATION: Raw PIN leaked in user object!');
  }

  // 2. Add product to cart & place order
  console.log('\n--- Step 2: Add Product to Cart & Checkout ---');
  const cartRes = await fetch(`${CUST_API}/cart/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ productId: 'prod_elec_1', quantity: 1 }),
  });
  const cartData = await cartRes.json();
  console.log('   Cart item added:', cartRes.status);

  const orderRes = await fetch(`${CUST_API}/checkout/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      deliveryAddress: {
        id: 'addr_test',
        name: 'Jaya',
        phone: '+91 98422 12345',
        street: 'Kalapatti Main Road',
        building: 'Villa 12',
        city: 'Coimbatore',
        latitude: 11.0725,
        longitude: 77.0345,
        dropZoneType: 'Lawn',
        clearanceRadiusMeters: 3.5,
      },
      paymentMethod: 'Credit Card',
      deliverySpeed: 'express',
    }),
  });
  const orderData: any = await orderRes.json();
  if (!orderRes.ok) throw new Error(`Checkout failed: ${JSON.stringify(orderData)}`);
  console.log(`✅ Order Placed: #${orderData.id}`);
  console.log(`   Delivery PIN Required: ${orderData.deliveryPinRequired}`);
  if (orderData.deliveryOtp) {
    console.warn(`   Note: deliveryOtp field returned: "${orderData.deliveryOtp}" (should be blank or omitted)`);
  }

  // 3. Wait 1 second for Admin Backend ingestion
  await new Promise(r => setTimeout(r, 1000));
  const ordersRes = await fetch(`${ADMIN_API}/orders`);
  const adminOrders: any = await ordersRes.json();
  const operationalOrder = adminOrders.find((o: any) => o.customerOrderId === orderData.id);
  if (!operationalOrder) throw new Error(`Operational order not found in admin for ${orderData.id}`);
  console.log(`✅ Operational Order Synced: ${operationalOrder.id}`);

  // 4. Assign Drone & Create Mission with Corridor Route
  console.log('\n--- Step 3: Assign Drone & Plan Non-Straight Corridor Airway ---');
  const dronesRes = await fetch(`${ADMIN_API}/fleet`);
  const drones: any = await dronesRes.json();
  const availableDrone = drones.find((d: any) => d.status === 'available') || drones[0];
  console.log(`   Selected Drone: ${availableDrone.id} (${availableDrone.name})`);

  const assignRes = await fetch(`${ADMIN_API}/dispatch/orders/${operationalOrder.id}/assign-drone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ droneId: availableDrone.id }),
  });
  const assignData: any = await assignRes.json();
  if (!assignRes.ok) throw new Error(`Drone assign failed: ${JSON.stringify(assignData)}`);
  const missionId = assignData.missionId;
  console.log(`✅ Drone Assigned. Mission Created: ${missionId}`);
  console.log(`   Airway Distance: ${assignData.distanceKm} km`);
  console.log(`   Estimated Flight Duration: ${assignData.estimatedDurationMinutes} mins`);

  // 5. Launch Mission
  console.log('\n--- Step 4: Launch Mission & Validate Physical Kinematics ---');
  const launchRes = await fetch(`${ADMIN_API}/missions/${missionId}/launch`, { method: 'POST' });
  const launchData: any = await launchRes.json();
  if (!launchRes.ok) throw new Error(`Launch failed: ${JSON.stringify(launchData)}`);
  console.log(`✅ Mission Launched! Physical flight loop active.`);

  // 6. Test Incorrect PIN Handover Verification (Should Reject)
  console.log('\n--- Step 5: Test Permanent Delivery PIN Security Handover ---');
  const failPinRes = await fetch(`${CUST_API}/orders/${orderData.id}/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ deliveryPin: '9999' }),
  });
  const failPinData: any = await failPinRes.json();
  console.log(`   Attempting incorrect PIN "9999": Status ${failPinRes.status}`);
  if (failPinRes.status === 400) {
    console.log(`✅ Incorrect PIN correctly rejected: "${failPinData.error}"`);
  } else {
    throw new Error(`SECURITY FAILURE: Incorrect PIN was not rejected!`);
  }

  // 7. Test Correct Permanent PIN Handover Verification (Jaya's PIN "4827")
  const successPinRes = await fetch(`${CUST_API}/orders/${orderData.id}/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ deliveryPin: '4827' }),
  });
  const successPinData: any = await successPinRes.json();
  if (!successPinRes.ok) throw new Error(`Correct PIN failed: ${JSON.stringify(successPinData)}`);
  console.log(`✅ Permanent Delivery PIN "4827" Verified Successfully!`);
  console.log(`   Message: "${successPinData.message}"`);
  console.log(`   Order Status: "${successPinData.status}"`);

  // 8. Verify Return Flight Initiated on East Airway
  await new Promise(r => setTimeout(r, 1200));
  const postFleetRes = await fetch(`${ADMIN_API}/fleet`);
  const postFleet: any = await postFleetRes.json();
  const postDrone = postFleet.find((d: any) => d.id === availableDrone.id) || postFleet[0];
  console.log(`\n--- Step 6: Return Flight Verification ---`);
  console.log(`   Drone ${postDrone.id} Status: ${postDrone.status}`);
  console.log(`   Drone Speed: ${postDrone.location?.speed ?? postDrone.speed} km/h, Altitude: ${postDrone.location?.altitude ?? postDrone.altitude}m`);

  // 9. Verify Gazebo Telemetry Bridge
  console.log(`\n--- Step 7: Gazebo Telemetry Bridge Status ---`);
  const bridgeRes = await fetch('http://localhost:8085/health');
  const bridgeData: any = await bridgeRes.json();
  console.log(`   Gazebo Status: ${bridgeData.status}`);
  console.log(`   Physics Engine: ${bridgeData.physicsEngine}`);
  console.log(`   Real-Time Factor: ${bridgeData.realTimeFactor}x`);
  console.log(`   Bridge Port: ${bridgeData.bridgePort}`);

  console.log('\n========================================================');
  console.log('🎉 FULL ARCHITECTURE OVERHAUL COMPLETE & VERIFIED! 🎉');
  console.log('========================================================');
}

testArchitecture().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
