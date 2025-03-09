const axios = require("axios");
const bodyParser = require("body-parser");
const crypto = require("crypto");
require("dotenv").config();
const express = require("express");
const products = require("./products.json");
const { v4: uuidv4 } = require("uuid");


const app = express();
app.set("view engine", "ejs")
app.use(bodyParser.json());
app.use(express.static("public")); // Serve frontend assets

const RAPYD_ACCESS_KEY = process.env.RAPYD_ACCESS_KEY;
const RAPYD_SECRET_KEY = process.env.RAPYD_SECRET_KEY;
const RAPYD_BASE_URL = process.env.RAPYD_BASE_URL;

// Function to generate Rapyd API signature
function generateSignature(httpMethod, urlPath, body = "") {
    const salt = crypto.randomBytes(8).toString("hex"); // 16-char salt
    const timestamp = Math.round(new Date().getTime() / 1000); // Current UNIX timestamp (in seconds)
    
    // Ensure body is a valid JSON string
    const bodyString = body && Object.keys(body).length ? JSON.stringify(body) : "";
    

    // Correct order of concatenation (NO spaces)
    const toSign = httpMethod.toLowerCase() + urlPath + salt + timestamp + RAPYD_ACCESS_KEY + RAPYD_SECRET_KEY + bodyString;

    // Create HMAC-SHA256 signature
    const hash = crypto.createHmac("sha256", RAPYD_SECRET_KEY);
    hash.update(toSign);

    // Convert signature to Base64
    const base64Signature = Buffer.from(hash.digest("hex")).toString("base64");
    
    return { signature: base64Signature, salt, timestamp };
}

// Display products
app.get("/", (req, res) => {
    res.render("index", { products });
});

// Load checkout page for product
app.get("/buy", (req, res) => {
    const { productId, amount, currency } = req.query;
    console.log({ productId, amount, currency })
    res.render("checkout", { productId, amount, currency });
});

// Payment Success Page
app.get("/success", (req, res) => {
    console.log('Payment succeeded...')
    res.send("Payment Successful")
});


// Payment Success Page
app.get("/fail", (req, res) => {
    console.log('Payment failed...')
    res.send("Payment Failure")
});

app.post("/api/webhook", (req, res) => {
    console.log('Webhook called...')
    res.send("OK")
});

// Route to create a payment checkout page
app.post("/create-checkout", async (req, res) => {
    const { amount, currency } = req.body;
    
    const body = {
        amount: amount.toString(),
        currency: currency,
        country: 'SG', // change as the case may be
        complete_payment_url: "http://localhost:3000/success",
        error_payment_url: "http://localhost:3000/fail"
    };

    const { signature, salt, timestamp } = generateSignature("post", "/v1/checkout", body);
    const idempotencyKey = uuidv4();
    try {

        const response = await axios.post(`${RAPYD_BASE_URL}/v1/checkout`, body, {
            headers: {
                "Content-Type": "application/json",
                "access_key": RAPYD_ACCESS_KEY,
                "idempotency": idempotencyKey,
                "salt": salt,
                "timestamp": timestamp,
                "signature": signature
            }
        });
        console.log("Rapyd's response", response.data.data)

        res.json({ checkout_url: response.data.data.redirect_url, checkout_id: response.data.data.id});
    } catch (error) {
        console.log("Rapyd's response", error.message)
        res.status(400).json({ error: error.response.data });
    }
});

// Start server
app.listen(3000, () => console.log("Server running on port 3000"));