import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const searches = [
    { term: 'medu-vada', label: 'Medu Vada' },
    { term: 'vada', label: 'Vada' },
    { term: 'mithai', label: 'Mithai / Indian Sweets' },
    { term: 'gulab-jamun', label: 'Gulab Jamun / Sweets' },
    { term: 'sesame-oil', label: 'Sesame Oil' },
    { term: 'first-aid-kit', label: 'First Aid Kit' },
    { term: 'powerbank', label: 'Power Bank' },
    { term: 'gan-charger', label: 'GaN Charger' }
  ];

  for (const s of searches) {
    try {
      console.log(`\n🔍 Searching Unsplash for: ${s.label} (${s.term})...`);
      await page.goto(`https://unsplash.com/s/photos/${s.term}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise(r => setTimeout(r, 2000));

      const images = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('figure img'));
        return imgs.map(img => {
          const el = img as HTMLImageElement;
          return {
            src: el.src,
            alt: el.alt
          };
        }).filter(i => i.src && i.src.includes('images.unsplash.com/photo-'));
      });

      console.log(`Found ${images.length} images for ${s.label}:`);
      for (let i = 0; i < Math.min(3, images.length); i++) {
        // Strip down to photo base URL
        const clean = images[i].src.split('?')[0];
        console.log(`  [${i+1}] ${clean} | Alt: "${images[i].alt}"`);
      }
    } catch (e: any) {
      console.error(`Failed ${s.label}:`, e.message);
    }
  }

  await browser.close();
}

main();
