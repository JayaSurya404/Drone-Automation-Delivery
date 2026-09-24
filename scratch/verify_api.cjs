async function test() {
  const res = await fetch('http://localhost:5000/api/products');
  const data = await res.json();
  const products = data.products || data;
  console.log('Total products returned from Customer API:', products.length);
  products.forEach(p => {
    console.log(`[${p.id}] ${p.name.slice(0, 35).padEnd(35)} | ${(p.category || '').padEnd(12)} | ${p.image}`);
  });

  const adminRes = await fetch('http://localhost:5001/api/admin/products');
  const adminData = await adminRes.json();
  const adminProducts = adminData.products || adminData;
  console.log('\nTotal products returned from Admin API:', adminProducts.length);
  adminProducts.forEach(p => {
    console.log(`[${p.id}] ${p.name.slice(0, 35).padEnd(35)} | ${(p.category_name || p.category_id || '').padEnd(12)} | ${p.image}`);
  });
}
test();
