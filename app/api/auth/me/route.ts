import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '../../_lib/auth.js';
import db from '../../_lib/db.js';

export async function GET(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ username: null });

    const session = await verifySession(token);
    if (!session) return NextResponse.json({ username: null });

    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(session.userId);
    return NextResponse.json({ username: user?.username || null });
}