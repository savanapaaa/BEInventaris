// Simple server test tanpa dependencies
const express = require('express');
const app = express();
const PORT = 5000;

app.get('/', (req, res) => {
  res.json({ message: 'Server berjalan!', status: 'OK', timestamp: new Date() });
});

app.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint', status: 'OK' });
});

app.post('/api/auth/login', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Test login endpoint', 
    data: { user: 'test' }
  });
});

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`✅ Simple server running on http://127.0.0.1:${PORT}`);
});

// Keep alive
setTimeout(() => {
  console.log('Server still running...');
}, 5000);