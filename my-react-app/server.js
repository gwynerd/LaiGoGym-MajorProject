import express from 'express';
import cors from 'cors'; 
import { OAuth2Client } from 'google-auth-library';

const app = express();

app.use(cors()); 
app.use(express.json()); 

const CLIENT_ID = "1092209529245-d792ks4c83it85ji1tv781mf5p508o15.apps.googleusercontent.com";
const CLIENT_SECRET = "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"; // ⚠️ REPLACE THIS SOON!

const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, "postmessage");

// --- 1. FIRST TIME LOGIN (Exchange Code for Tokens) ---
app.post('/api/exchange-token', async (req, res) => {
  try {
    const { code } = req.body;
    console.log(`🔄 Exchanging Google code...`);

    const { tokens } = await oAuth2Client.getToken(code);
    
    // Send back BOTH tokens so React can store them in localStorage
    res.status(200).json({ 
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token 
    });

  } catch (error) {
    console.error("Token exchange error:", error);
    res.status(500).json({ error: "Failed to exchange token" });
  }
});

// --- 2. RETURNING USER (Get a Fresh 1-Hour Token) ---
app.post('/api/get-fresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body; 
    
    if (!refreshToken) {
      return res.status(400).json({ error: "No refresh token provided." });
    }

    oAuth2Client.setCredentials({ refresh_token: refreshToken });
    const newTokens = await oAuth2Client.getAccessToken();

    res.status(200).json({ accessToken: newTokens.token });

  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({ error: "Failed to refresh token" });
  }
});

// --- 3. EXISTING DATA ROUTE (Preserved as requested) ---
app.post('/api/save-health-data', async (req, res) => {
  try {
    const fitbitData = req.body;
    console.log("Received data from React:", fitbitData);
    res.status(200).json({ message: "Data successfully saved to database!" });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Failed to save data" });
  }
});

app.listen(3000, () => console.log('🚀 Backend server running on port 3000'));