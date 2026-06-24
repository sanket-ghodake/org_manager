export const PORT = process.env.PORT || 8095;
export const PORTAL_INTERNAL_URL = process.env.PORTAL_INTERNAL_URL || 'http://app:3001';
export const CLIENT_ID = process.env.CLIENT_ID || 'client_sg_dashboard';
export const CLIENT_SECRET = process.env.CLIENT_SECRET || 'secret_sg_dashboard';
export const PORTAL_SSO_URL = process.env.PORTAL_SSO_URL || 'http://localhost:3001/api/v1/auth/authorize';
export const DATABASE_URL = process.env.DATABASE_URL || 'file:local.db';
export const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_dashboard_jwt_key';
