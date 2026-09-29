import { generateHmacSignature } from '../shared/contracts/security.js';

async function testPost() {
  const event = {
    eventType: 'TELEMETRY_UPDATE',
    eventId: 'evt_test_1',
    timestamp: new Date().toISOString(),
    data: {
      customerOrderId: 'ORD-1002',
      missionId: 'MS-TEST',
      droneId: 'D-001',
      droneName: 'SkyNav Alpha-01',
      status: 'Out for Delivery',
      currentLocation: { latitude: 11.11, longitude: 77.02, altitudeMeters: 40, speedKmh: 40, bearing: 185 },
      remainingDistanceKm: 0.5,
      estimatedArrivalMins: 2,
      progressPercent: 50,
      timestamp: new Date().toISOString(),
      sampleId: 100,
      simTime: 10
    }
  };
  const timestamp = new Date().toISOString();
  const signature = generateHmacSignature(event, 'skynav_secure_internal_service_key_2026', timestamp);

  try {
    const r = await fetch('http://localhost:5000/api/internal/telemetry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SkyNav-Timestamp': timestamp,
        'X-SkyNav-Signature': signature,
        'X-SkyNav-Event-Type': 'TELEMETRY_UPDATE',
        'X-SkyNav-Idempotency-Key': 'evt_test_1'
      },
      body: JSON.stringify(event)
    });
    console.log('Status:', r.status);
    console.log('Body:', await r.text());
  } catch (e: any) {
    console.error('Fetch error:', e.message);
  }
}

testPost();
