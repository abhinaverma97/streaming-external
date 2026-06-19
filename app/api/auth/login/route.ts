import { NextRequest, NextResponse } from 'next/server';
import db from '../../_lib/db.js';
import { verifyPassword, createSession } from '../../_lib/auth.js';

export async function POST(req: NextRequest) {
    try {
        const { username, password } = await req.json();

        if (!username || !password) {
            return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
        }

        const usernameStr = String(username).trim().toLowerCase();
        const user = db.prepare('SELECT id, password_hash FROM users WHERE username = ?').get(usernameStr);

        if (!user || !verifyPassword(String(password), user.password_hash)) {
            return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
        }

        const token = await createSession(user.id);

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