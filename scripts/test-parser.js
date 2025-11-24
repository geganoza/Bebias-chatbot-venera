// Test parseOrderNotification function

function parseOrderNotification(text) {
  console.log(`🔍 parseOrderNotification called, text length: ${text.length}`);

  // Check if ORDER_NOTIFICATION marker exists
  if (!text.includes('ORDER_NOTIFICATION')) {
    console.log('❌ No ORDER_NOTIFICATION marker found');
    return null;
  }

  // Extract the block after ORDER_NOTIFICATION
  const notifIndex = text.indexOf('ORDER_NOTIFICATION');
  const orderBlock = text.substring(notifIndex);
  console.log(`🔍 ORDER_NOTIFICATION block (first 400 chars): ${orderBlock.substring(0, 400)}`);

  // FLEXIBLE FIELD EXTRACTION - handles both English and Georgian field names
  // Extract each field independently to handle mixed formats

  // Product: English or Georgian
  const productMatch = orderBlock.match(/(?:Product|პროდუქტი):\s*(.+?)(?:\n|$)/i);

  // Client Name: various formats
  const clientNameMatch = orderBlock.match(/(?:Client Name|კლიენტის სახელი|გაყიდვის სახელი|სახელი|Name):\s*(.+?)(?:\n|$)/i);

  // Telephone: English or Georgian
  const telephoneMatch = orderBlock.match(/(?:Telephone|Phone|ტელეფონი):\s*(.+?)(?:\n|$)/i);

  // Address: English or Georgian
  const addressMatch = orderBlock.match(/(?:Address|მისამართი):\s*(.+?)(?:\n|$)/i);

  // Total: English or Georgian (capture up to newline or ლარი or end)
  const totalMatch = orderBlock.match(/(?:Total|ჯამი|თანხა):\s*(.+?)(?:\n|$)/i);

  console.log(`🔍 Field extraction results:`);
  console.log(`   Product: ${productMatch ? 'FOUND - ' + productMatch[1].substring(0, 50) : 'MISSING'}`);
  console.log(`   Client Name: ${clientNameMatch ? 'FOUND - ' + clientNameMatch[1] : 'MISSING'}`);
  console.log(`   Telephone: ${telephoneMatch ? 'FOUND - ' + telephoneMatch[1] : 'MISSING'}`);
  console.log(`   Address: ${addressMatch ? 'FOUND - ' + addressMatch[1].substring(0, 50) : 'MISSING'}`);
  console.log(`   Total: ${totalMatch ? 'FOUND - ' + totalMatch[1] : 'MISSING'}`);

  // All fields are required
  if (productMatch && clientNameMatch && telephoneMatch && addressMatch && totalMatch) {
    const result = {
      product: productMatch[1].trim(),
      quantity: '1',
      clientName: clientNameMatch[1].trim(),
      telephone: telephoneMatch[1].trim().replace(/\s/g, ''),
      address: addressMatch[1].trim(),
      total: totalMatch[1].trim(),
    };
    console.log('✅ Parsed ORDER_NOTIFICATION successfully (flexible extraction)');
    console.log(`📦 Order: ${result.product}, ${result.clientName}, ${result.telephone}`);
    return result;
  }

  console.log('❌ Could not parse ORDER_NOTIFICATION - missing required fields');
  return null;
}

const testText = `მადლობა, მარიამო! ❤️

რამდენიმე დეტალი შევამოწმოთ:
• გადარიცხვის სქრინი: ✅
• სახელი: ძაგნიძე მარიამო ✅
• ტელეფონი: 599048725 ✅
• მისამართი: თაბუკაშვილის 181, მე 7 ე სართული ბინა 38, ქუთაისი ✅

შენი შეკვეთა მიღებულია ✅
🎫 შეკვეთის ნომერი: [ORDER_NUMBER]
👤 მიმღები: ძაგნიძე მარიამო
📞 ტელეფონი: 599048725
📍 მისამართი: თაბუკაშვილის 181, მე 7 ე სართული ბინა 38, ქუთაისი
📦 პროდუქტი: თეთრი ბამბის მოკლე ქუდი - სტანდარტი (M) x 1, თეთრი შეუღებავი შალის წინდა - 36-39 x 1
💰 ჯამი: 118 ლარი
თბილად ჩაიცვი, არ გაცივდე 🧡

ORDER_NOTIFICATION:
Product: თეთრი ბამბის მოკლე ქუდი - სტანდარტი (M) x 1, თეთრი შეუღებავი შალის წინდა - 36-39 x 1
Client Name: ძაგნიძე მარიამო
Telephone: 599048725
Address: თაბუკაშვილის 181, მე 7 ე სართული ბინა 38, ქუთაისი
Total: 118 ლარი`;

console.log('='.repeat(80));
console.log('Testing parseOrderNotification with exact message from screenshot...');
console.log('='.repeat(80));

const result = parseOrderNotification(testText);
console.log('\n='.repeat(80));
console.log('FINAL RESULT:', result ? 'SUCCESS' : 'NULL (FAILED)');
if (result) {
  console.log(JSON.stringify(result, null, 2));
}
