"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const requiredEnvVars = [
    "DATABASE_URL",
    "PORT",
    "JWT_SECRET",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
];
function validateEnv() {
    const missing = [];
    for (const key of requiredEnvVars) {
        if (!process.env[key]) {
            missing.push(key);
        }
    }
    if (missing.length > 0) {
        console.error(`❌ Missing environment variables: ${missing.join(", ")}`);
        process.exit(1);
    }
    return process.env;
}
exports.env = validateEnv();
