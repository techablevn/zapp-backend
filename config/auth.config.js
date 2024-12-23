module.exports = {
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN,
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    user: process.env.REDIS_USER,
    pass: process.env.REDIS_PASSWORD,
    auth: process.env.REDIS_AUTH_PASSWORD
  }
};
