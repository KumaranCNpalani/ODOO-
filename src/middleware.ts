import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from './lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let root redirect to login or dashboard
  if (pathname === '/') {
    const token = request.cookies.get('auth_token')?.value;
    if (token) {
      const session = await verifyJWT(token);
      if (session) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Define paths that do not require authentication
  const isPublicPath = pathname === '/login';

  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    if (!isPublicPath) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  const session = await verifyJWT(token);

  if (!session) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('auth_token');
    return response;
  }

  // If user is logged in and trying to access /login, redirect to /dashboard
  if (isPublicPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Protect Admin setup page
  if (pathname.startsWith('/dashboard/setup') && session.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
