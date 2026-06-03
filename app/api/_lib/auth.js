import crypto from "crypto";
import fs from "fs";
import path from "path";

const USERS_FILE = path.join(process.cwd(), ".cache", "users.json");
const SECRET_FILE = path.join(process.cwd(), ".cache", "auth-secret.txt");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getSecret() {
  if (fs.existsSync(SECRET_FILE)) {
    return fs.readFileSync(SECRET_FILE, "utf-8").trim();
  }
  const secret = crypto.randomBytes(32).toString("hex");
  ensureDir(path.dirname(SECRET_FILE));
  fs.writeFileSync(SECRET_FILE, secret);
  return secret;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return derived === hash;
}

export function generateToken(username) {
  const secret = getSecret();
  const payload = `${username}:${Date.now() + 7 * 24 * 60 * 60 * 1000}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(payload).toString("base64") + "." + signature;
}

export function verifyToken(token) {
  try {
    const [encoded, signature] = token.split(".");
    if (!encoded || !signature) return null;
    const payload = Buffer.from(encoded, "base64").toString();
    const secret = getSecret();
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    if (signature !== expected) return null;
    const [username, expiry] = payload.split(":");
    if (Date.now() > Number(expiry)) return null;
    return username;
  } catch {
    return null;
  }
}

export function loadUsers() {
  ensureDir(path.dirname(USERS_FILE));
  if (!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
}

export function saveUsers(users) {
  ensureDir(path.dirname(USERS_FILE));
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

export function migrateLegacyData(username) {
  const legacyPath = path.join(process.cwd(), ".cache", "user-data.json");
  if (!fs.existsSync(legacyPath)) return;
  const userDir = path.join(process.cwd(), ".cache", "users", username);
  const destPath = path.join(userDir, "user-data.json");
  if (fs.existsSync(destPath)) return;
  ensureDir(userDir);
  fs.copyFileSync(legacyPath, destPath);
  console.log(`[Auth] Migrated legacy user-data.json to user '${username}'`);
}
