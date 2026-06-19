import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from './api/_lib/auth.js';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/register', '/api/auth/logout'];

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
        return NextResponse.next();
    }

    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon') ||
        pathname.startsWith('/nob.') ||
        pathname.startsWith('/manifest') ||
        pathname === '/sw.js' ||
        /\.[a-z]{2,6}$/i.test(pathname)
    ) {
        return NextResponse.next();
    }

    const token = req.cookies.get('token')?.value;
    const session = await verifyJwt(token);

    if (!session) {
        const loginUrl = new URL('/login', req.url);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image).*)'],
};