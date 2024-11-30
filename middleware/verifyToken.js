const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
    const token = req.header('Authorization')?.split(' ')[1]; // Extract token from 'Authorization' header

    if (!token) {
        return res.status(403).json({ message: "No token provided" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: "Invalid or expired token" });
        }
        req.user = decoded;  // Store the decoded user information in the request object
        next();  // Proceed to the next middleware or route handler
    });
}

const verifyRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Access denied." });
        }
        next();
    };
};

module.exports = {
    verifyToken,
    verifyRole
};
