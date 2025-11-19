/**
 * Georgian Common First Names Database
 * Used to identify which part of a name is the first name vs surname
 */

export const GEORGIAN_COMMON_FIRST_NAMES = [
    // Male names
    'გიორგი', 'გიორგის', // Giorgi
    'დავითი', 'დავით', // Davit
    'ნიკა', 'ნიკას', // Nika
    'ლუკა', 'ლუკას', // Luka
    'ილია', 'ილიას', // Ilia
    'გიგა', 'გიგას', // Giga
    'ლევან', 'ლევანი', 'ლევანის', // Levan
    'ირაკლი', 'ირაკლის', // Irakli
    'ვახტანგ', 'ვახტანგი', 'ვახტანგის', // Vakhtang
    'ზურაბ', 'ზურაბი', 'ზურაბის', // Zurab
    'თემურ', 'თემური', 'თემურის', // Temur
    'გიგლა', 'გიგლას', // Gigla
    'ალექსანდრე', 'ალექსანდრეს', // Alexandre
    'მიხეილ', 'მიხეილი', 'მიხეილის', // Mikheil
    'ნიკოლოზ', 'ნიკოლოზი', 'ნიკოლოზის', // Nikoloz
    'ბაჩო', 'ბაჩოს', // Bacho
    'მამუკა', 'მამუკას', // Mamuka
    'გოგა', 'გოგას', // Goga
    'გოგი', 'გოგის', // Gogi
    'კახა', 'კახას', // Kakha
    'გია', 'გიას', // Gia
    'შალვა', 'შალვას', // Shalva
    'ოთარ', 'ოთარი', 'ოთარის', // Otar
    'რევაზ', 'რევაზი', 'რევაზის', // Revaz
    'მერაბ', 'მერაბი', 'მერაბის', // Merab
    'ნუგზარ', 'ნუგზარი', 'ნუგზარის', // Nugzar
    'თენგიზ', 'თენგიზი', 'თენგიზის', // Tengiz
    'ბესო', 'ბესოს', // Beso
    'ბექა', 'ბექას', // Beka
    'გურამ', 'გურამი', 'გურამის', // Guram
    'გოჩა', 'გოჩას', // Gocha
    'როინ', 'როინი', 'როინის', // Roin
    'სოსო', 'სოსოს', // Soso

    // Female names
    'ანა', 'ანას', 'ანამ', // Ana
    'მარიამ', 'მარიამი', 'მარიამის', // Mariam
    'ნინო', 'ნინოს', // Nino
    'თამარ', 'თამარი', 'თამარის', // Tamar
    'ნათია', 'ნათიას', // Natia
    'თამუნა', 'თამუნას', // Tamuna
    'ეკა', 'ეკას', // Eka
    'სალომე', 'სალომეს', // Salome
    'თეა', 'თეას', // Tea
    'ნანა', 'ნანას', // Nana
    'სოფო', 'სოფოს', // Sopo
    'ქეთევან', 'ქეთევანი', 'ქეთევანის', // Ketevan
    'ქეთი', 'ქეთის', // Keti
    'მაკა', 'მაკას', // Maka
    'ლალი', 'ლალის', // Lali
    'ლია', 'ლიას', // Lia
    'მანანა', 'მანანას', // Manana
    'მაია', 'მაიას', // Maia
    'ნატო', 'ნატოს', // Nato
    'სოფიკო', 'სოფიკოს', // Sopiko
    'ანასტასია', 'ანასტასიას', // Anastasia
    'ხათუნა', 'ხათუნას', // Khatuna
    'ციცი', 'ციცის', // Tsitsi
    'მარინა', 'მარინას', // Marina
    'ნანუკა', 'ნანუკას', // Nanuka
    'ნანული', 'ნანულის', // Nanuli
    'ქეთინო', 'ქეთინოს', // Ketino
    'ელენე', 'ელენეს', // Elene
    'თინათინ', 'თინათინი', 'თინათინის', // Tinatin
    'რუსუდან', 'რუსუდანი', 'რუსუდანის', // Rusudan
    'ციალა', 'ციალას', // Tsiala
    'ვერა', 'ვერას', // Vera
];

/**
 * Check if a word is a common Georgian first name
 */
export function isGeorgianFirstName(name: string): boolean {
    const normalized = name.toLowerCase().trim();
    return GEORGIAN_COMMON_FIRST_NAMES.some(fn =>
        fn.toLowerCase() === normalized
    );
}

/**
 * Parse Georgian full name and identify first name and surname
 *
 * Examples:
 * - "გიორგი ნოზაძე" → { firstName: "გიორგი", surname: "ნოზაძე" }
 * - "ნოზაძე გიორგი" → { firstName: "გიორგი", surname: "ნოზაძე" }
 * - "ანასტასია გოგოლაძე" → { firstName: "ანასტასია", surname: "გოგოლაძე" }
 */
export function parseGeorgianName(fullName: string): {
    firstName: string;
    surname: string;
    parsed: boolean;
} {
    const parts = fullName.trim().split(/\s+/);

    if (parts.length < 2) {
        // Only one word - can't determine
        return {
            firstName: '',
            surname: parts[0] || '',
            parsed: false,
        };
    }

    // Check first word
    if (isGeorgianFirstName(parts[0])) {
        return {
            firstName: parts[0],
            surname: parts.slice(1).join(' '),
            parsed: true,
        };
    }

    // Check second word
    if (isGeorgianFirstName(parts[1])) {
        return {
            firstName: parts[1],
            surname: parts[0],
            parsed: true,
        };
    }

    // Couldn't identify - assume first word is first name (common pattern)
    return {
        firstName: parts[0],
        surname: parts.slice(1).join(' '),
        parsed: false, // Not confirmed
    };
}
