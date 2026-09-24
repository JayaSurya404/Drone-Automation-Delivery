const https = require('https');
const fs = require('fs');
const path = require('path');

const targetDirs = [
  path.resolve('customer/frontend/public/images/products'),
  path.resolve('admin/frontend/public/images/products'),
  path.resolve('customer/backend/public/images/products'),
  path.resolve('admin/backend/public/images/products')
];

for (const dir of targetDirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const productImages = [
  { file: 'masala_dosa.jpg', url: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=800&auto=format&fit=crop&q=80' },
  { file: 'plain_dosa.jpg', url: 'https://images.unsplash.com/photo-1694849789325-914b71ab4075?w=800&auto=format&fit=crop&q=80' },
  { file: 'steamed_idli.jpg', url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&auto=format&fit=crop&q=80' },
  { file: 'medu_vada.jpg', url: 'https://images.unsplash.com/photo-1730191843435-073792ba22bc?w=800&auto=format&fit=crop&q=80' },
  { file: 'sambar_pot.jpg', url: 'https://images.unsplash.com/photo-1632104667384-06f58cb7ad44?w=800&auto=format&fit=crop&q=80' },
  { file: 'south_indian_thali.jpg', url: 'https://images.unsplash.com/photo-1680993032090-1ef7ea9b51e5?w=800&auto=format&fit=crop&q=80' },
  { file: 'ghee_mysore_pak.jpg', url: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=800&auto=format&fit=crop&q=80' },
  { file: 'butter_murukku.jpg', url: 'https://images.unsplash.com/photo-1709091052718-3cb8a990edfa?w=800&auto=format&fit=crop&q=80' },
  { file: 'filter_coffee.jpg', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80' },
  { file: 'aavin_milk.jpg', url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&auto=format&fit=crop&q=80' },
  { file: 'first_aid_kit.jpg', url: 'https://images.unsplash.com/photo-1624638760852-8ede1666ab07?w=800&auto=format&fit=crop&q=80' },
  { file: 'pain_relief_balm.jpg', url: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800&auto=format&fit=crop&q=80' },
  { file: 'gan_charger.jpg', url: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&auto=format&fit=crop&q=80' },
  { file: 'power_bank.jpg', url: 'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=800&auto=format&fit=crop&q=80' },
  { file: 'legal_document_pouch.jpg', url: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=80' },
  { file: 'cold_pressed_oil.jpg', url: 'https://images.unsplash.com/photo-1552592074-ea7a91b851b3?w=800&auto=format&fit=crop&q=80' }
];

function download(item) {
  return new Promise((resolve) => {
    https.get(item.url, (res) => {
      if (res.statusCode === 200) {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          for (const dir of targetDirs) {
            fs.writeFileSync(path.join(dir, item.file), buffer);
          }
          console.log(`✅ Downloaded: ${item.file} (${buffer.length} bytes)`);
          resolve(true);
        });
      } else {
        console.error(`❌ HTTP ${res.statusCode} for ${item.file}`);
        resolve(false);
      }
    }).on('error', (err) => {
      console.error(`❌ Error downloading ${item.file}:`, err.message);
      resolve(false);
    });
  });
}

async function main() {
  console.log('🚀 Downloading verified authentic Indian catalog images locally...');
  let successCount = 0;
  for (const item of productImages) {
    const ok = await download(item);
    if (ok) successCount++;
  }
  console.log(`\n🎉 Completed: ${successCount}/${productImages.length} images saved locally!`);
}

main();
