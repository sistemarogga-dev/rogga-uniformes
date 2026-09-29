import { NextRequest, NextResponse } from "next/server";
import { verificarToken } from "@/lib/session";

const PROTEGIDAS = ["/gerador", "/dashboard", "/admin"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("sessao")?.value;
  const sessao = token ? await verificarToken(token) : null;

  // Já logado tentando abrir /login → vai pro gerador
  if (pathname === "/login" && sessao) {
    const url = req.nextUrl.clone();
    url.pathname = "/gerador";
    return NextResponse.redirect(url);
  }

  const protegida = PROTEGIDAS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (protegida && !sessao) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // /admin só para administradores
  if (pathname.startsWith("/admin") && sessao?.papel !== "admin") {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/gerador/:path*", "/dashboard/:path*", "/admin/:path*", "/login"],
};
