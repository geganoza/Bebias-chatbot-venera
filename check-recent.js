import { getBOGClient } from './lib/bogClient.ts';

const bog = getBOGClient();
await bog.authenticate();

const response = await fetch(
    `https://api.businessonline.ge/api/statement/GE31BG0000000101465259/GEL/2025-11-18/2025-11-19`,
    {
        headers: {
            'Authorization': `Bearer ${bog.accessToken}`,
            'Content-Type': 'application/json',
        },
    }
);

const data = await response.json();

console.log('Last 2 days transactions:', data.Count);
console.log();

if (data.Records) {
    data.Records.forEach((record, idx) => {
        const isCredit = record.EntryAmountCredit > 0;
        const amount = isCredit ? record.EntryAmountCredit : record.EntryAmountDebit;
        
        console.log(`#${idx + 1}: ${amount} GEL ${isCredit ? 'IN' : 'OUT'} - ${record.EntryDate}`);
        console.log(`   Comment: ${record.EntryComment}`);
        
        // Show ALL non-null fields for incoming payments
        if (isCredit) {
            console.log('   All fields:');
            Object.keys(record).forEach(key => {
                if (record[key] && record[key] !== 0 && record[key] !== null) {
                    console.log(`      ${key}: ${JSON.stringify(record[key])}`);
                }
            });
        }
        console.log();
    });
}
