import fs from 'fs';

async function investigate() {
  console.log('--- 1. Testing OpenStreetMap / Overpass for Kurumbapalayam & Kalapatti ---');
  // Bounding box around Kurumbapalayam (11.1132, 77.0277) to Kalapatti (11.0725, 77.0345)
  const q = `[out:json][timeout:25];(way["building"](11.065,77.020,11.125,77.045);relation["building"](11.065,77.020,11.125,77.045););out body geom qt 100;`;
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SkyNavAeroPlatform/1.0 (Research)',
      },
      body: 'data=' + encodeURIComponent(q),
    });
    console.log('Overpass HTTP status:', res.status);
    if (res.ok) {
      const data = await res.json();
      console.log('Total OSM building elements found:', data.elements?.length);
      if (data.elements && data.elements.length > 0) {
        console.log('Sample OSM building:', JSON.stringify(data.elements[0], null, 2));
      }
    } else {
      const txt = await res.text();
      console.log('Overpass error text:', txt.slice(0, 200));
    }
  } catch (err: any) {
    console.error('Overpass error:', err.message);
  }

  console.log('\n--- 2. Testing Public AWS Terrain Tiles / Mapzen Terrarium (SRTM/Copernicus DEM) ---');
  // Kurumbapalayam at zoom 12 is approx tile x=2924, y=1921 (or zoom 14 x=11697, y=7684)
  // Let's test standard AWS Terrain-RGB endpoint (free, public Open Data on AWS)
  const terrainUrl = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/14/11697/7684.png';
  try {
    const tRes = await fetch(terrainUrl, { method: 'HEAD' });
    console.log('AWS Elevation Terrarium Tile HTTP status:', tRes.status, tRes.headers.get('content-type'));
  } catch (err: any) {
    console.error('Terrain tile error:', err.message);
  }

  console.log('\n--- 3. Testing MapTiler / Mapbox / Google Maps 3D requirements ---');
  console.log('Checking environment keys in process.env...');
  const keys = ['MAPBOX_ACCESS_TOKEN', 'VITE_MAPBOX_TOKEN', 'MAPTILER_API_KEY', 'GOOGLE_MAPS_API_KEY', 'CESIUM_ION_TOKEN', 'ARCGIS_API_KEY'];
  keys.forEach(k => console.log(`  ${k}: ${process.env[k] ? 'PRESENT' : 'NOT SET'}`));
}

investigate();
