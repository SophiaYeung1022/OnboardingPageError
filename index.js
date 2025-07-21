const express = require('express');
const cors = require('cors');
const router = require('./authRoutes');
const app = express();

// Request logging middleware (Step 2 implementation)
app.use((req, res, next) => {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  res.on('finish', () => {
    const dura