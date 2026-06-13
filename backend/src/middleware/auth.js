const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_jwt_secret_token_12345';

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header is missing' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Token is missing' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
}

function verifyAdmin(req, res, next) {
  verifyToken(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied: Admin role required' });
    }
    next();
  });
}

function verifyEmployee(req, res, next) {
  verifyToken(req, res, () => {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ message: 'Access denied: Employee role required' });
    }
    next();
  });
}

module.exports = {
  verifyToken,
  verifyAdmin,
  verifyEmployee,
  JWT_SECRET
};
