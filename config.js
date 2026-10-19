const path = require('node:path');
const fs = require('node:fs');
function loadConfig() {
  const local = path.join(__dirname, '.env');
  const external = path.join(process.env.APPDATA || process.env.HOME || '', 'polylife', '.env');
  const envPath = fs.existsSync(local) ? local : external;
  if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath });
  const value = process.env.PORT || '2008';
  const port = Number(value);
  if (!/^\d+$/.test(value) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT deve essere un intero tra 1 e 65535');
  }
  return { port, apiKey: process.env.GROQ_API_KEY || '', model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile' };
}
module.exports = { loadConfig };
