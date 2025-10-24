// Simple test without external dependencies

console.log('🧪 Testing Backend Inventaris API...');
console.log('📍 Server should be running at: http://localhost:5000');
console.log('');

console.log('🔍 Manual Tests to run:');
console.log('');

// Basic test
console.log('1️⃣  Test Basic Endpoint:');
console.log('   Method: GET');
console.log('   URL: http://localhost:5000/');
console.log('   Expected: {"message": "Inventaris Backend API berjalan!"}');
console.log('');

// Login test
console.log('2️⃣  Test Admin Login:');
console.log('   Method: POST');
console.log('   URL: http://localhost:5000/api/auth/login');
console.log('   Headers: Content-Type: application/json');
console.log('   Body: {');
console.log('     "email": "admin@inventaris.com",');
console.log('     "password": "admin123"');
console.log('   }');
console.log('   Expected: Login successful with token');
console.log('');

// Profile test  
console.log('3️⃣  Test Get Profile (needs token from step 2):');
console.log('   Method: GET');
console.log('   URL: http://localhost:5000/api/pengguna/profil');
console.log('   Headers: Authorization: Bearer {your_token}');
console.log('   Expected: User profile data');
console.log('');

console.log('💡 Test with Postman, Thunder Client, or browser DevTools');
console.log('📝 Database needs to be imported first: database.sql');

// Check if database exists
console.log('');
console.log('⚠️  IMPORTANT: Make sure to:');
console.log('   1. Import database.sql to MySQL');
console.log('   2. Update .env with correct MySQL credentials');
console.log('   3. Restart server if needed');