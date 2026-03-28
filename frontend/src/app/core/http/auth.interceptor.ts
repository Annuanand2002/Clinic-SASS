import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthSessionService } from '../../features/auth/application/auth-session.service';
import { environment } from '../../../environments/environment';

function shouldSkipClinicHeader(url: string): boolean {
  return (
    /\/api\/auth(\/|$|\?)/.test(url) ||
    /\/api\/organisation(\/|$|\?)/.test(url) ||
    /\/api\/users(\/|$|\?)/.test(url) ||
    /\/api\/clinics(\/|$|\?)/.test(url)
  );
}

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private readonly session: AuthSessionService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.session.getToken();
    const base = environment.apiUrl.replace(/\/$/, '');
    const isOurApi = req.url.startsWith(base) || req.url.includes('/api/');

    if (!token) return next.handle(req);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`
    };

    if (isOurApi && !shouldSkipClinicHeader(req.url)) {
      const clinicHeader = this.session.getClinicIdHeaderValue();
      if (clinicHeader != null && clinicHeader !== '') {
        headers['X-Clinic-Id'] = clinicHeader;
      }
    }

    return next.handle(req.clone({ setHeaders: headers }));
  }
}

