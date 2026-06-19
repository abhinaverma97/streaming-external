import { NextRequest, NextResponse } from 'next/server';
import { deleteSession } from '../../_lib/auth.js';

export async function POST(req: NextRequest) {
    const token = req.cookies.get('token')?.value;
    if (token) await deleteSession(token);

    const response = NextResponse.json({ ok: true });
    response.cookies.set('token', '', { maxAge: 0, path: '/' });
    return response;
}