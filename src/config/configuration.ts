export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  environment: process.env.NODE_ENV || 'development',
  loginUrl: process.env.LOGIN_URL || 'http://localhost:3000/login',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  resend: {
    apiKey: process.env.RESEND_API_KEY,
    webhookSecret: process.env.RESEND_WEBHOOK_SECRET,
    from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
  },
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
