const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  // Reduced logging to prevent crash
  // console.log('Auth headers:', req.headers['authorization']);
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    // console.log('No token provided');
    return res.status(401).json({ 
      success: false,
      error: 'Access token diperlukan' 
    });
  }

  // console.log('Token received:', token.substring(0, 20) + '...');

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      // console.log('Token verification failed:', err.message);
      return res.status(403).json({ 
        success: false,
        error: 'Token tidak valid' 
      });
    }
    req.user = user;
    // console.log('User authenticated:', user.userId, user.peran);
    next();
  });
};

const authorizeAdmin = (req, res, next) => {
  if (req.user.peran !== 'admin') {
    return res.status(403).json({ 
      success: false,
      error: 'Akses ditolak. Hanya admin yang diizinkan.' 
    });
  }
  next();
};

// Combined middleware for admin access (authenticate + authorize)
const requireAdmin = [authenticateToken, authorizeAdmin];

// Alias for easier usage
const requireAuth = authenticateToken;

module.exports = {
  authenticateToken,
  authorizeAdmin,
  requireAdmin,
  requireAuth
};