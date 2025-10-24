// Debug server startup
const express = require('express');
const cors = require('cors');
require('dotenv').config();

console.log('🚀 Starting server...');
console.log('Environment variables loaded:');
console.log('- PORT:', process.env.PORT);
console.log('- DB_HOST:', process.env.DB_HOST);
console.log('- DB_NAME:', process.env.DB_NAME);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
console.log('📦 Setting up middleware...');
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test route first
app.get('/', (req, res) => {
  console.log('✅ Root route hit!');
  res.json({ message: 'Inventaris Backend API berjalan!', timestamp: new Date().toISOString() });
});

// Basic routes without database first
app.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint working!', status: 'OK' });
});

console.log('🔗 Setting up routes...');

try {
  // Try to load routes
  app.use('/api/auth', require('./routes/authRoutes'));
  console.log('✅ Auth routes loaded');
  
  app.use('/api/pengguna', require('./routes/penggunaRoutes'));
  console.log('✅ Pengguna routes loaded');
  
  app.use('/api/produk', require('./routes/produkRoutes'));
  console.log('✅ Produk routes loaded');
  
  app.use('/api/kategori', require('./routes/kategoriRoutes'));
  console.log('✅ Kategori routes loaded');
  
  app.use('/api/transaksi', require('./routes/transaksiRoutes'));
  console.log('✅ Transaksi routes loaded');
  
  app.use('/api/riwayat', require('./routes/riwayatRoutes').router);
  console.log('✅ Riwayat routes loaded');
  
} catch (error) {
  console.error('❌ Error loading routes:', error.message);
  console.error('Stack:', error.stack);
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.stack);
  res.status(500).json({ error: 'Terjadi kesalahan server!', details: err.message });
});

// 404 handler
app.use('*', (req, res) => {
  console.log(`❓ 404 - ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Endpoint tidak ditemukan!' });
});

// Start server
console.log(`🚀 Attempting to start server on port ${PORT}...`);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server successfully started!`);
  console.log(`📍 Server berjalan di port ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`🔗 Test: http://localhost:${PORT}/test`);
});

server.on('error', (error) => {
  console.error('❌ Server startup error:', error.message);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} sudah digunakan oleh aplikasi lain!`);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server closed.');
    process.exit(0);
  });
});

module.exports = app;