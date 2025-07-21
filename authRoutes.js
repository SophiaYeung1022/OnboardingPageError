const express = require("express");
const crypto = require("crypto");
const {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  generateRegistrationOptions,
  verifyRegistrationResponse,
} = require("@simplewebauthn/server");

const router = express.Router();
console.log("✅ authRoutes loaded");

// Allowlisted frontend origins
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174'
];

// In-memory store (temporary)
let registrationChallenge = "";
let authenticationChallenge = "";
let storedCredential = null;

// Constants
const RP_ID = "localhost";
const RP_NAME = "SwingIn App";

// Helpers
function bufferToBase64Url(buffer) {
  return buffer.toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlToBuffer(base64url) {
  base64url = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64url.length % 4) base64url += "=";
  return Buffer.from(base64url, "base64");
}

// Route: Test if router is loaded
router.get("/ping", (req, res) => {
  res.json({ message: "pong from authRoutes" });
});

// 1. Generate Registration Options
router.get("/register-options", (req, res) => {
  try {
    const options = generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: Buffer.from(crypto.randomUUID()).toString("base64url"),
      userName: "user@example.com",
      timeout: 60000,
      attestationType: "none",
      authenticatorSelection: {
        userVerification: "required",
        authenticatorAttachment: "platform",
      },
      excludeCredentials: [],
      supportedAlgorithmIDs: [-7, -257],
    });

    registrationChallenge = options.challenge;
    console.log("✅ Registration options generated:", options);
    res.json(options);
  } catch (err) {
    console.error("❌ Error generating registration options:", err);
    res.status(500).json({ error: "Failed to generate registration options" });
  }
});

// 2. Verify Registration Response
router.post("/register", async (req, res) => {
  const { body } = req;
  const origin = req.headers.origin;

  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ success: false, message: "Invalid origin" });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: registrationChallenge,
      expectedOrigin: origin,
      expectedRPID: RP_ID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

      storedCredential = {
        credentialID: bufferToBase64Url(credentialID),
        credentialPublicKey,
        counter,
      };

      return res.json({ success: true });
    }

    res.status(400).json({ success: false, message: "Registration verification failed" });
  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).json({ success: false, message: err.message || "Internal error" });
  }
});

// 3. Generate Authentication Challenge
router.get("/challenge", (req, res) => {
  try {
    if (!storedCredential) {
      return res.status(400).json({ success: false, message: "No credential registered yet" });
    }

    const options = generateAuthenticationOptions({
      timeout: 60000,
      allowCredentials: [{
        id: base64UrlToBuffer(storedCredential.credentialID),
        type: "public-key",
        transports: ["internal"],
      }],
      userVerification: "required",
    });

    authenticationChallenge = options.challenge;
    res.json(options);
  } catch (err) {
    console.error("❌ Error generating challenge:", err);
    res.status(500).json({ success: false, message: "Failed to generate challenge" });
  }
});

// 4. Verify Authentication Response
router.post("/verify", async (req, res) => {
  const { body } = req;
  const origin = req.headers.origin;

  if (!storedCredential) {
    return res.status(400).json({ success: false, message: "No credential registered yet" });
  }

  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ success: false, message: "Invalid origin" });
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: authenticationChallenge,
      expectedOrigin: origin,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: base64UrlToBuffer(storedCredential.credentialID),
        credentialPublicKey: storedCredential.credentialPublicKey,
        counter: storedCredential.counter,
        transports: ["internal"],
      },
    });

    if (verification.verified) {
      storedCredential.counter = verification.authenticationInfo.newCounter;
      return res.json({ success: true });
    }

    res.status(401).json({ success: false, message: "Authentication failed" });
  } catch (err) {
    console.error("❌ Authentication error:", err);
    res.status(500).json({ success: false, message: err.message || 