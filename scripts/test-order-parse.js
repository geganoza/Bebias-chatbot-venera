const text = `მადლობა მარიამო ❤️ შენი შეკვეთა მიღებულია ✅
🎫 შეკვეთის ნომერი: [ORDER_NUMBER]
👤 მიმღები: ძაგნიძე მარიამო
📞 ტელეფონი: 599048725
📍 მისამართი: ქუთაისი, თაბუკაშვილის 181, მე 7 ე სართული, ბინა 38
📦 პროდუქტი: თეთრი ბამბის მოკლე ქუდი - სტანდარტი (M) x 1, თეთრი შეუღებავი შალის წინდა - 36-39 x 1
💰 ჯამი: 118 ლარი
თბილად ჩაიცვი, არ გაცივდე 🧡`;

function parseGeorgianOrderConfirmation(text) {
  console.log("🔍 parseGeorgianOrderConfirmation called, text length:", text.length);

  const hasOrderConfirmation = text.includes("შეკვეთა მიღებულია");
  if (!hasOrderConfirmation) {
    console.log("❌ No შეკვეთა მიღებულია found");
    return null;
  }

  const hasOrderNumberPlaceholder =
    text.includes("[ORDER_NUMBER]") ||
    text.includes("[შეკვეთის ნომერი მალე]") ||
    text.includes("შეკვეთის ნომერი:") ||
    text.includes("🎫");

  if (!hasOrderNumberPlaceholder) {
    console.log("❌ No order number placeholder found");
    return null;
  }

  console.log("✅ Order confirmation pattern detected");

  const nameMatch = text.match(/👤[^:]*:\s*(.+?)(?:\n|$)/);
  const phoneMatch = text.match(/📞[^:]*:\s*(.+?)(?:\n|$)/);
  const addressMatch = text.match(/📍[^:]*:\s*(.+?)(?:\n|$)/);
  const productMatch = text.match(/📦[^:]*:\s*(.+?)(?:\n|$)/);
  const totalMatch = text.match(/💰[^:]*:\s*(.+?)(?:\n|$)/);

  console.log("👤 Name:", nameMatch ? nameMatch[1] : "MISSING");
  console.log("📞 Phone:", phoneMatch ? phoneMatch[1] : "MISSING");
  console.log("📍 Address:", addressMatch ? addressMatch[1].substring(0,40) : "MISSING");
  console.log("📦 Product:", productMatch ? productMatch[1].substring(0,40) : "MISSING");
  console.log("💰 Total:", totalMatch ? totalMatch[1] : "MISSING");

  if (nameMatch && phoneMatch && addressMatch && productMatch && totalMatch) {
    return {
      product: productMatch[1].trim(),
      quantity: "1",
      clientName: nameMatch[1].trim(),
      telephone: phoneMatch[1].trim().replace(/\s/g, ""),
      address: addressMatch[1].trim(),
      total: totalMatch[1].trim(),
      needsOrderNumber: true,
    };
  }

  console.log("❌ Missing required fields");
  return null;
}

const result = parseGeorgianOrderConfirmation(text);
console.log("\n=== RESULT ===");
console.log(result ? "SUCCESS - Order data parsed!" : "FAILED - null returned");
if (result) console.log(JSON.stringify(result, null, 2));
