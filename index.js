
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Origin coordinates (configurable via env, fallback to MP center)
const origin = {
    lat: Number(process.env.ORIGIN_LAT) || 23.4733,
    lon: Number(process.env.ORIGIN_LON) || 77.947998
};

// Few states with coordinates (You can add all later)
const stateCoordinates = {
    'AN': { lat: 11.7401, lon: 92.6586 }, // Andaman and Nicobar Islands
    'AP': { lat: 15.9129, lon: 79.7400 }, // Andhra Pradesh
    'AR': { lat: 27.5829, lon: 93.9368 }, // Arunachal Pradesh
    'AS': { lat: 26.2006, lon: 92.9376 }, // Assam
    'BR': { lat: 25.0961, lon: 85.3131 }, // Bihar
    'CH': { lat: 30.7333, lon: 76.7794 }, // Chandigarh
    'CT': { lat: 21.2787, lon: 81.8661 }, // Chhattisgarh
    'DN': { lat: 20.1809, lon: 73.0169 }, // Dadra and Nagar Haveli and Daman and Diu
    'DL': { lat: 28.7041, lon: 77.1025 }, // Delhi
    'GA': { lat: 15.2993, lon: 74.1240 }, // Goa
    'GJ': { lat: 22.2587, lon: 71.1924 }, // Gujarat
    'HR': { lat: 29.0588, lon: 76.0856 }, // Haryana
    'HP': { lat: 31.1048, lon: 77.1734 }, // Himachal Pradesh
    'JK': { lat: 33.7782, lon: 76.5762 }, // Jammu and Kashmir
    'JH': { lat: 23.6102, lon: 85.2799 }, // Jharkhand
    'KA': { lat: 15.3173, lon: 75.7139 }, // Karnataka
    'KL': { lat: 10.8505, lon: 76.2711 }, // Kerala
    'LA': { lat: 34.1526, lon: 77.5770 }, // Ladakh
    'LD': { lat: 10.5593, lon: 72.6358 }, // Lakshadweep
    'MP': { lat: 23.4733, lon: 77.947998 }, // Madhya Pradesh
    'MH': { lat: 19.7515, lon: 75.7139 }, // Maharashtra
    'MN': { lat: 24.6637, lon: 93.9063 }, // Manipur
    'ML': { lat: 25.4670, lon: 91.3662 }, // Meghalaya
    'MZ': { lat: 23.1645, lon: 92.9376 }, // Mizoram
    'NL': { lat: 26.1584, lon: 94.5624 }, // Nagaland
    'OR': { lat: 20.9517, lon: 85.0985 }, // Odisha
    'PY': { lat: 11.9416, lon: 79.8083 }, // Puducherry
    'PB': { lat: 31.1471, lon: 75.3412 }, // Punjab
    'RJ': { lat: 27.0238, lon: 74.2179 }, // Rajasthan
    'SK': { lat: 27.5330, lon: 88.5122 }, // Sikkim
    'TN': { lat: 11.1271, lon: 78.6569 }, // Tamil Nadu
    'TG': { lat: 17.1232, lon: 78.3408 }, // Telangana
    'TR': { lat: 23.9408, lon: 91.9882 }, // Tripura
    'UP': { lat: 26.8467, lon: 80.9462 }, // Uttar Pradesh
    'UT': { lat: 30.0668, lon: 79.0193 }, // Uttarakhand
    'WB': { lat: 22.9868, lon: 87.8550 }  // West Bengal
};

// Configuration: base price by state (INR)
const stateBaseInInr = {
    RJ: 300,
    // Add more states as needed. Unlisted states will use defaultBaseInInr
};

const defaultBaseInInr = 0;

// Configuration: weight tier prices (INR) based on package total weight in KG
// Price corresponds to the entire package up to the tier's maxKg
const weightTiersInInr = [
    { maxKg: 0.5, priceInInr: 80 },
    { maxKg: 1, priceInInr: 120 },
    { maxKg: 2, priceInInr: 200 },
    { maxKg: 5, priceInInr: 500 }, // example: 5 kg = 500
    { maxKg: 10, priceInInr: 900 }
];

function getWeightTierPrice(totalWeightKg) {
    for (const tier of weightTiersInInr) {
        if (totalWeightKg <= tier.maxKg) return tier.priceInInr;
    }
    // If above highest tier, charge extra per kg beyond last tier
    const lastTier = weightTiersInInr[weightTiersInInr.length - 1];
    const extraKgs = Math.ceil(totalWeightKg - lastTier.maxKg);
    const extraPerKgInInr = 120; // overflow rate per kg
    return lastTier.priceInInr + extraKgs * extraPerKgInInr;
}

// Haversine formula for distance in KM
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

app.post('/shipping-rate', (req, res) => {
    console.log("Shopify callback body:", req.body);

    const country = req.body?.rate?.destination?.country;
    const province = req.body?.rate?.destination?.province_code
        || req.body?.rate?.destination?.province;
    if (country !== 'IN') {
        return res.json({ rates: [] });
    }

    // Weight from Shopify payload (grams)
    const totalWeightGrams = Number(req.body?.rate?.total_weight) || 0;
    const totalWeightKg = Math.max(totalWeightGrams / 1000, 0.1); // assume at least 100g

    // Calculate base by state and price by weight tier
    const provinceCode = String(province || '').toUpperCase();
    const stateBase = stateBaseInInr[provinceCode] ?? defaultBaseInInr;
    const weightPrice = getWeightTierPrice(totalWeightKg);
    const standardBaseInInr = stateBase + weightPrice;

    // Service multipliers and delivery windows
    const services = [
        {
            key: 'EXPRESS',
            name: 'Express Shipping',
            multiplier: 1.25,
            minDays: 1,
            maxDays: 2
        },
        {
            key: 'STANDARD',
            name: 'Standard Shipping',
            multiplier: 1.0,
            minDays: 2,
            maxDays: 5
        },
        {
            key: 'ECONOMY',
            name: 'Economy Shipping',
            multiplier: 0.85,
            minDays: 4,
            maxDays: 8
        }
    ];

    const now = Date.now();
    const minimumChargeInInr = 30;
    const rates = services.map(svc => {
        const finalInInr = Math.max(minimumChargeInInr, standardBaseInInr * svc.multiplier);
        return {
            service_name: `${svc.name} (${province})`,
            service_code: `${province}_${svc.key}`,
            total_price: Math.round(finalInInr * 100), // paise
            currency: 'INR',
            min_delivery_date: new Date(now).toISOString(),
            max_delivery_date: new Date(now + svc.maxDays * 24 * 60 * 60 * 1000).toISOString()
        };
    });

    console.log("Province:", provinceCode);
    console.log("Weight:", totalWeightKg.toFixed(2), "kg");
    console.log("State base (INR):", stateBase);
    console.log("Weight tier price (INR):", weightPrice);
    console.log("Calculated rates:", rates);
    res.json({ rates });
});

app.listen(8080, () => {
    console.log('Server running on port 8080');
});
