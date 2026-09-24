const https = require('https');

function getOgImage(photoSlug) {
  return new Promise((resolve) => {
    const fetchUrl = (url) => {
      https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const nextUrl = res.headers.location.startsWith('http') ? res.headers.location : 'https://unsplash.com' + res.headers.location;
          return fetchUrl(nextUrl);
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const match = data.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                        data.match(/content="(https:\/\/images\.unsplash\.com\/photo-[^"]+)"/);
          if (match) {
            const cleanUrl = match[1].split('?')[0];
            resolve(cleanUrl);
          } else {
            resolve('No match: ' + res.statusCode);
          }
        });
      }).on('error', err => resolve('Error: ' + err.message));
    };
    fetchUrl('https://unsplash.com/photos/' + photoSlug);
  });
}

async function main() {
  const slugs = [
    'a-white-plate-topped-with-donuts-next-to-a-bowl-of-sauce-jsTnzgTJGUk', // Medu Vada
    'dosa-with-chutney-and-sambar-breakfast-VIqcVqZ1uxM', // Masala Dosa Rameshwaram Cafe
    'a-delicious-dosa-is-served-with-sides-3qHDm3IQCUs', // Dosa on banana leaf
    'a-dosa-is-served-with-three-dipping-sauces-4Au4dHNjt7w' // Golden crispy Dosa
  ];
  for (const s of slugs) {
    const img = await getOgImage(s);
    console.log(s, '=>', img);
  }
}
main();
