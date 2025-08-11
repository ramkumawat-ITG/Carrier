

const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.post('/shipping-rate', (req, res) => {
    console.log("Shopify callback body:", req.body);

    const country = req.body?.rate?.destination?.country;

    let rates = [];

    if (country === 'CA') {
        rates.push({
            service_name: "Canada Flat Rate",
            service_code: "CANADA_FLAT",
            total_price: 500, // cents me, yani $5
            currency: "USD",
            min_delivery_date: new Date().toISOString(),
            max_delivery_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
        });
    }
    console.log(rates)

    res.json({ rates });
});

app.listen(8080, () => {
    console.log('Server running on port 8080');
});
