import crypto from "crypto";
import fs from "fs";
import path from "path";
import db from "./db";

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
  const rows = db.prepare("SELECT * FROM users").all();
  const users = {};
  for (const row of rows) {
    users[row.username] = {
      hash: row.hash,
      salt: row.salt,
      createdAt: row.createdAt,
      lastActive: row.lastActive
    };
  }
  return users;
}

export function saveUsers(users) {
  const stmt = db.prepare("INSERT OR REPLACE INTO users (username, hash, salt, createdAt, lastActive) VALUES (?, ?, ?, ?, ?)");
  const transaction = db.transaction(() => {
    for (const [username, data] of Object.entries(users)) {
      stmt.run(username, data.hash, data.salt, data.createdAt || Date.now(), data.lastActive || null);
    }
  });
  transaction();
}

export function migrateLegacyData(username) {
  // Migration disabled as per user request to start fresh
}
