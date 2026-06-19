import { NextRequest, NextResponse } from 'next/server';
import db from '../../_lib/db.js';
import { hashPassword, createSession } from '../../_lib/auth.js';

export async function POST(req: NextRequest) {
    try {
        const { username, password } = await req.json();

        if (!username || !password) {
            return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
        }

        const usernameStr = String(username).trim().toLowerCase();
        if (usernameStr.length < 3 || usernameStr.length > 30 || !/^[a-z0-9_]+$/.test(usernameStr)) {
            return NextResponse.json({ error: 'Username must be 3-30 chars, a-z / 0-9 / underscore' }, { status: 400 });
        }

        if (String(password).length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
        }

        const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(usernameStr);
        if (existing) {
            return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
        }

        const passwordHash = hashPassword(String(password));
        const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(usernameStr, passwordHash);
        const userId = Number(result.lastInsertRowid);

        const token = await createSession(userId);

        const response = NextResponse.json({ ok: true, username: usernameStr });
        response.cookies.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60,
            path: '/',
        });

        return response;
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
    }
}