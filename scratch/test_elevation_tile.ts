// Test decoding real elevation from AWS Terrarium DEM tiles for Kurumbapalayam
// Lat: 11.1132, Lng: 77.0277
// Tile formula at zoom Z:
// n = 2 ^ Z
// x = Math.floor((lng + 180) / 360 * n)
// y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n)

function latLngToTile(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
  return { x, y, zoom };
}

const tile = latLngToTile(11.1132, 77.0277, 14);
console.log('Kurumbapalayam Zoom 14 Tile:', tile);

const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${tile.zoom}/${tile.x}/${tile.y}.png`;
console.log('Terrarium URL:', url);

async function testFetchTile() {
  const res = await fetch(url);
  console.log('Fetch Status:', res.status);
  const buf = await res.arrayBuffer();
  console.log('Tile Size in Bytes:', buf.byteLength);
}

testFetchTile();
