const requiredEnvVars = [
  "DATABASE_URL",
  "PORT",
  "NODE_ENV",
  "JWT_ACCESS_SECRET",
  "JWT_ISSUER",
  "JWT_AUDIENCE",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
] as const;

type EnvVars = (typeof requiredEnvVars)[number];

function validateEnv(): Record<EnvVars, string> {
  const missing: string[] = [];

  for (const key of requiredEnvVars) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.error(`❌ Missing environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }

  return process.env as Record<EnvVars, string>;
}

export const env = validateEnv();
