export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  environment: process.env.NODE_ENV || 'development',
  loginUrl: process.env.LOGIN_URL || 'http://localhost:3000/login',
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  superAdmin: {
    email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@church.org',
    password: process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!',
  },
});
