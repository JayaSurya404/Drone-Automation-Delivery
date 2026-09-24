import { WebSocket } from 'ws';

async function testRealtimeOrderSync() {
  console.log('====================================================');
  console.log('🧪 TESTING REALTIME ADMIN ORDER SYNCHRONIZATION');
  console.log('====================================================\n');

  // 1. Connect to Admin WebSocket
  console.log('1. Connecting to Admin WebSocket (ws://localhost:5001/ws/admin)...');
  const ws = new WebSocket('ws://localhost:5001/ws/admin');

  const receivedEvents: any[] = [];

  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => {
      console.log('✓ Admin WebSocket connected successfully!');
      resolve();
    });
    ws.on('error', (err) => {
      reject(new Error(`WebSocket connection failed: ${err.message}`));
    });
    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.type === 'ORDER_CREATED') {
          console.log(`📡 [WS EVENT RECEIVED] type: ORDER_CREATED, orderId: ${parsed.data.order?.id}, customerOrderId: ${parsed.data.customerOrderId}`);
          receivedEvents.push(parsed.data);
        }
      } catch (e) {}
    });
  });

  // 2. Login as dev customer to obtain token
  console.log('\n2. Authenticating as development customer (customer@skynav)...');
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@skynav', password: 'skynav@123' }),
  });
  if (!loginRes.ok) throw new Error('Customer login failed');
  const { token, user } = await loginRes.json();
  console.log(`✓ Authenticated as: ${user.name} (${user.id})`);

  // 3. Place Order #1 via Customer Backend
  console.log('\n3. Adding product to cart and placing Customer Order #1...');
  const cartRes1 = await fetch('http://localhost:5000/api/cart/items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ productId: 'prod_groc_1', quantity: 1 }),
  });
  if (!cartRes1.ok) {
    throw new Error(`Add to cart failed: ${await cartRes1.text()}`);
  }

  const checkoutPayload1 = {
    deliverySpeed: 'express',
    paymentMethod: 'UPI',
    deliveryAddress: {
      label: 'Home',
      name: 'Jaya',
      phone: '+91 98422 10002',
      building: 'SkyNest Villa',
      street: 'Avinashi Road',
      area: 'Kurumbapalayam',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      postalCode: '641107',
      latitude: 11.1042,
      longitude: 77.0281,
    },
  };

  const order1Res = await fetch('http://localhost:5000/api/checkout/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(checkoutPayload1),
  });

  if (!order1Res.ok) {
    const errText = await order1Res.text();
    throw new Error(`Order #1 checkout failed: ${errText}`);
  }
  const order1Data = await order1Res.json();
  const order1Id = order1Data.id || order1Data.order?.id;
  console.log(`✓ Customer Order #1 placed: ${order1Id}`);

  // Wait up to 3 seconds for WebSocket ORDER_CREATED event
  console.log('Waiting for ORDER_CREATED event on Admin WebSocket...');
  const startWait1 = Date.now();
  while (receivedEvents.length === 0 && Date.now() - startWait1 < 4000) {
    await new Promise((r) => setTimeout(r, 100));
  }

  if (receivedEvents.length === 0) {
    throw new Error('FAILED: No ORDER_CREATED event received for Order #1!');
  }
  const event1 = receivedEvents[0];
  if (event1.customerOrderId !== order1Id) {
    throw new Error(`Mismatch: Expected customerOrderId ${order1Id}, got ${event1.customerOrderId}`);
  }
  console.log(`✓ ORDER_CREATED verified for Order #1!`);
  console.log(`  Operational Order ID: ${event1.operationalOrderId}`);
  console.log(`  Package: ${event1.order?.packageName}`);
  console.log(`  Destination: ${event1.order?.destinationCoords?.lat}, ${event1.order?.destinationCoords?.lng}`);

  console.log('\n4. Adding product to cart and placing Customer Order #2...');
  const cartRes2 = await fetch('http://localhost:5000/api/cart/items', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ productId: 'prod_food_2', quantity: 2 }),
  });
  if (!cartRes2.ok) {
    throw new Error(`Add to cart failed: ${await cartRes2.text()}`);
  }

  const order2Res = await fetch('http://localhost:5000/api/checkout/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(checkoutPayload1),
  });

  if (!order2Res.ok) {
    const errText = await order2Res.text();
    throw new Error(`Order #2 checkout failed: ${errText}`);
  }
  const order2Data = await order2Res.json();
  const order2Id = order2Data.id || order2Data.order?.id;
  console.log(`✓ Customer Order #2 placed: ${order2Id}`);

  const startWait2 = Date.now();
  while (receivedEvents.length < 2 && Date.now() - startWait2 < 4000) {
    await new Promise((r) => setTimeout(r, 100));
  }

  if (receivedEvents.length < 2) {
    throw new Error('FAILED: No ORDER_CREATED event received for Order #2!');
  }
  const event2 = receivedEvents[1];
  console.log(`✓ ORDER_CREATED verified for Order #2! (Operational ID: ${event2.operationalOrderId})`);

  // Verify uniqueness (no duplicate orders)
  const ids = receivedEvents.map((e) => e.customerOrderId);
  const uniqueIds = new Set(ids);
  if (ids.length !== uniqueIds.size) {
    throw new Error('FAILED: Duplicate order IDs received!');
  }
  console.log(`✓ Zero duplicate orders detected. Unique IDs: ${Array.from(uniqueIds).join(', ')}`);

  ws.close();
  console.log('\n====================================================');
  console.log('🎉 REALTIME ADMIN ORDER SYNCHRONIZATION VERIFIED 100%');
  console.log('====================================================\n');
}

testRealtimeOrderSync().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
