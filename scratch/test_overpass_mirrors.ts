async function testOverpassMirrors() {
  const mirrors = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter'
  ];

  // Smaller bbox around Kurumbapalayam: 11.108 to 11.118, 77.022 to 77.032
  const q = `[out:json][timeout:15];way["building"](11.108,77.022,11.118,77.032);out body geom 50;`;

  for (const mirror of mirrors) {
    try {
      console.log('Trying mirror:', mirror);
      const res = await fetch(mirror, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'SkyNavAeroPlatform/1.0',
        },
        body: 'data=' + encodeURIComponent(q),
      });
      console.log('Status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('Success! Buildings found in Kurumbapalayam:', data.elements?.length);
        if (data.elements?.length > 0) {
          console.log('Sample building tags:', data.elements[0].tags);
          console.log('Sample building geometry points:', data.elements[0].geometry?.length);
        }
        return data;
      }
    } catch (e: any) {
      console.log('Failed mirror:', mirror, e.message);
    }
  }
}

testOverpassMirrors();
