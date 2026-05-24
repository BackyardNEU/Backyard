// Set before any server module is imported — requireAuth.js and supabaseAdmin.js
// both throw at module-load time if these are missing.
process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret-do-not-use-in-prod';
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
