import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token;
  if (!token) return next(req);
  const clinicHeader = auth.getClinicHeaderValue();
  return next(
    req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
        ...(clinicHeader ? { 'X-Clinic-Id': clinicHeader } : {})
      }
    })
  );
};
