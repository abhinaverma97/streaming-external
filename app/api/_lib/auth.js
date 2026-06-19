import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from './db.js';

const AUTH_SECRET = process.env.AUTH_SECRET || 'spicy-default-secret-change-in-production';
const secret = new TextEncoder().encode(AUTH_SECRET);

export function hashPassword(password) {
    return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password, hash) {
    return bcrypt.compareSync(password, hash);
}

export async function createSession(userId) {
    const token = await new SignJWT({ userId })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('7d')
        .setIssuedAt()
        .sign(secret);

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

    db.prepare('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
        .run(userId, tokenHash, expiresAt);

    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Math.floor(Date.now() / 1000));

    return token;
}

export async function verifySession(token) {
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, secret);
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const session = db.prepare('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?')
            .get(tokenHash, Math.floor(Date.now() / 1000));
        return session ? { userId: session.user_id } : null;
    } catch {
        return null;
    }
}

export async function deleteSession(token) {
    if (!token) return;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

export async function verifyJwt(token) {
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, secret);
        return { userId: payload.userId };
    } catch {
        return null;
    }
}

export function getUserIdFromCookies(cookieStore) {
    return async () => {
        const token = cookieStore.get('token')?.value;
        if (!token) throw new Error('Unauthorized');
        const session = await verifySession(token);
        if (!session) throw new Error('Unauthorized');
        return session.userId;
    };
}