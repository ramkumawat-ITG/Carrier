const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors({ origin: 'https://*.myshopify.com' }));
app.use(express.json());

const origin = {
    lat: 23.4733,
    lon: 77.947998
};

// State coordinates
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

// OpenRouteService Distance Matrix API
async function getRoadDistance(origin, dest) {
    try {
        const response = await axios.post(
            'https://api.openrouteservice.org/v2/matrix/driving-car',
            {
                locations: [
                    [origin.lon, origin.lat],
                    [dest.lon, dest.lat]
                ],
                metrics: ['distance']
            },

            {
                headers: {
                    'Authorization': "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImU0MTYzYWQwMjU5MzRiZDZiODA1NDU5YmUzYmE5NDNiIiwiaCI6Im11cm11cjY0In0=",
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log(response, "djdjdjdjdjdj")


        const distanceInMeters = response.data.distances[0][1];
        return distanceInMeters / 1000;
    } catch (error) {
        console.error("OpenRouteService API error:", error.message);
        return getDistance(origin.lat, origin.lon, dest.lat, dest.lon);
    }
}


// Haversine formula (as fallback)
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
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

app.post('/shipping-rate', async (req, res) => {
    console.log("Shopify callback body:", JSON.stringify(req.body, null, 2));

    const country = req.body?.rate?.destination?.country;
    const province = (req.body?.rate?.destination?.province_code || req.body?.rate?.destination?.province)?.toUpperCase();

    if (!country || !province || country !== 'IN') {
        return res.json({ rates: [] });
    }

    // Get product weight (in kg)
    const items = req.body?.rate?.items || [];
    if (!items.length) return res.json({ rates: [] });

    let totalWeightKg = 0;
    for (let item of items) {
        if (!item.grams || item.grams <= 0) return res.json({ rates: [] });
        totalWeightKg += (item.grams / 1000) * item.quantity;
    }

    // Get destination coordinates
    const dest = stateCoordinates[province];
    if (!dest) return res.json({ rates: [] });

    // Origin coordinates (Example: New Delhi)

    // Calculate distance in km
    const distance = await getRoadDistance(origin, dest);

    // Per km rates
    const perKmRates = {
        EXPRESS: 2.0,   // INR/km
        STANDARD: 1.2,  // INR/km
        ECONOMY: 0.8    // INR/km
    };

    // Weight-based costs
    function getWeightCost(type, weightKg) {
        if (weightKg <= 5) return { EXPRESS: 30, STANDARD: 20, ECONOMY: 10 }[type];
        else if (weightKg <= 10) return { EXPRESS: 60, STANDARD: 40, ECONOMY: 25 }[type];
        else if (weightKg <= 25) return { EXPRESS: 120, STANDARD: 80, ECONOMY: 50 }[type];
        else return { EXPRESS: 200, STANDARD: 150, ECONOMY: 100 }[type];
    }

    const now = Date.now();
    const minimumChargeInInr = 30;

    // Shipping services
    const services = [
        { key: 'EXPRESS', name: 'Express Shipping', minDays: 1, maxDays: 2 },
        { key: 'STANDARD', name: 'Standard Shipping', minDays: 2, maxDays: 5 },
        { key: 'ECONOMY', name: 'Economy Shipping', minDays: 4, maxDays: 8 }
    ];

    const rates = services.map(svc => {
        const perKmInInr = perKmRates[svc.key];
        const weightCost = getWeightCost(svc.key, totalWeightKg);
        const baseTransportCostInInr = distance * perKmInInr;
        const finalInInr = Math.max(minimumChargeInInr, baseTransportCostInInr + weightCost);

        return {
            service_name: `${svc.name} (${province})`,
            service_code: `${province}_${svc.key}`,
            total_price: Math.round(finalInInr * 100), // Shopify wants paise
            currency: 'INR',
            min_delivery_date: new Date(now + svc.minDays * 24 * 60 * 60 * 1000).toISOString(),
            max_delivery_date: new Date(now + svc.maxDays * 24 * 60 * 60 * 1000).toISOString()
        };
    });

    console.log("Origin:", origin);
    console.log("Destination:", dest);
    console.log("Distance:", distance.toFixed(2), "km");
    console.log("Calculated rates:", JSON.stringify(rates, null, 2));

    res.json({ rates });
});




app.listen(8080, () => {
    console.log('Server running on port 8080');
});