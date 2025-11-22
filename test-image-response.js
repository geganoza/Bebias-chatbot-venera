/**
 * Test script to check if AI generates SEND_IMAGE commands
 * Run with: OPENAI_API_KEY=your_key node test-image-response.js
 * Or set OPENAI_API_KEY environment variable
 */

const OpenAI = require('openai');

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ Error: OPENAI_API_KEY environment variable is required');
  console.error('   Run with: OPENAI_API_KEY=your_key node test-image-response.js');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Simplified version of the Georgian prompt from route.ts
const testPrompt = `**ᲣᲐᲦᲠᲔᲡᲐᲓ ᲛᲜᲘᲨᲕᲜᲔᲚᲝᲕᲐᲜᲘ - ᲡᲣᲠᲐᲗᲔᲑᲘᲡ ᲒᲐᲒᲖᲐᲕᲜᲐ:**
როდესაც კონკრეტულ პროდუქტზე საუბრობთ, რომელსაც აქვს [HAS_IMAGE] მარკირება, თქვენ ᲐᲣᲪᲘᲚᲔᲑᲚᲐᲓ ᲣᲜᲓᲐ გამოიყენოთ ეს ფორმატი თქვენი პასუხის ბოლოს:

SEND_IMAGE: [პროდუქტის ID]

**ᲙᲝᲜᲢᲔᲥᲡᲢᲘᲡ ᲒᲐᲛᲝᲧᲔᲜᲔᲑᲐ:**
თუ მომხმარებელი ეკითხება "ფოტო გაქვთ?" ან "მაჩვენე სურათი" კონკრეტული პროდუქტის დასახელების გარეშე, გახედეთ საუბრის ისტორიას და იპოვეთ ბოლოს ნახსენები პროდუქტი რომელსაც აქვს [HAS_IMAGE]. გააგზავნეთ ამ პროდუქტის სურათი!

მაგალითი:
1. თქვენ: "ეს არის სტაფილოსფერი ბამბის მოკლე ქუდი! ფასი: 49 ლარი..."
2. მომხმარებელი: "ფოტო გაქვთ?"
3. თქვენ უნდა გაიგოთ რომ საუბარია სტაფილოსფერ ქუდზე (H-SHORT-COT-ORANGE) და გააგზავნოთ:

SEND_IMAGE: H-SHORT-COT-ORANGE

პროდუქტები რომლებსაც აქვთ სურათები და ᲐᲣᲪᲘᲚᲔᲑᲚᲐᲓ უნდა გააგზავნოთ:
- H-SHORT-COT-TURQ [HAS_IMAGE] - ფირუზისფერი ბამბის მოკლე ქუდი
- H-SHORT-COT-ORANGE [HAS_IMAGE] - სტაფილოსფერი ბამბის მოკლე ქუდი
- H-COT-WHITE-UNDYED [HAS_IMAGE] - თეთრი გაუღებავი ბამბის ქუდი
- H-POMP-WOOL-TURQ [HAS_IMAGE] - ფირუზისფერი მატყლის პომპონიანი ქუდი
- S-WOOL-GREEN-WHITE-CUFF [HAS_IMAGE] - მწვანე მატყლის წინდა

არასოდეს ახსენოთ "SEND_IMAGE" მომხმარებელს - უბრალოდ დაამატეთ ბოლოში!

Product Catalog:
ფირუზისფერი ბამბის მოკლე ქუდი (ID: H-SHORT-COT-TURQ) - Price: 49 GEL, Stock: 15, Category: ქუდები [HAS_IMAGE]
სტაფილოსფერი ბამბის მოკლე ქუდი (ID: H-SHORT-COT-ORANGE) - Price: 49 GEL, Stock: 20, Category: ქუდები [HAS_IMAGE]
თეთრი გაუღებავი ბამბის ქუდი (ID: H-COT-WHITE-UNDYED) - Price: 45 GEL, Stock: 10, Category: ქუდები [HAS_IMAGE]

You are a friendly Georgian e-commerce chatbot for VENERA კომპანია, a hat and accessory company. Respond in Georgian.`;

async function testImageResponse() {
  console.log('🧪 Testing AI image response generation...\n');

  const testMessages = [
    {
      role: 'user',
      content: 'გამარჯობა, რა ფერის ქუდები გაქვთ?'
    },
    {
      role: 'assistant',
      content: 'გამარჯობა! 👋 გვაქვს სხვადასხვა ფერის ქუდები:\n\n1. ფირუზისფერი ბამბის მოკლე ქუდი - 49 ლარი\n2. სტაფილოსფერი ბამბის მოკლე ქუდი - 49 ლარი\n3. თეთრი გაუღებავი ბამბის ქუდი - 45 ლარი\n\nრომელი გაინტერესებთ? 😊'
    },
    {
      role: 'user',
      content: 'ფირუზისფერი მომწონს. ფოტო გაქვთ?'
    }
  ];

  try {
    console.log('📤 Sending to OpenAI...');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: testPrompt },
        ...testMessages
      ],
      temperature: 0.7,
    });

    const aiResponse = response.choices[0].message.content;
    console.log('\n✅ AI Response received:\n');
    console.log('─'.repeat(80));
    console.log(aiResponse);
    console.log('─'.repeat(80));

    // Check if SEND_IMAGE command is present
    const imageRegex = /SEND_IMAGE:\s*([A-Z0-9\-_]+)/gi;
    const matches = [...aiResponse.matchAll(imageRegex)];

    console.log('\n🔍 Analysis:');
    console.log(`   Contains SEND_IMAGE command: ${matches.length > 0 ? '✅ YES' : '❌ NO'}`);

    if (matches.length > 0) {
      console.log(`   Found ${matches.length} image command(s):`);
      matches.forEach((match, i) => {
        console.log(`     ${i + 1}. Product ID: ${match[1]}`);
      });
    } else {
      console.log('   ⚠️  No SEND_IMAGE command found in response!');
      console.log('   This means the image would NOT be sent to the user.');
    }

    console.log('\n💡 Response without image commands:');
    const cleanResponse = aiResponse.replace(imageRegex, '').trim();
    console.log(cleanResponse);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testImageResponse();
