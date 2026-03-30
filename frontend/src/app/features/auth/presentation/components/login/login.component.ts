import { Component } from '@angular/core';
import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthFacade } from '../../../application/auth.facade';
import { LoginResponse } from '../../../domain/models/login-response';
import { animate, state, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  animations: [
    trigger('cardEnter', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('520ms ease-out', style({ opacity: 1 }))
      ])
    ]),
    trigger('shakeOnError', [
      state('idle', style({ transform: 'translateX(0)' })),
      state('shake', style({ transform: 'translateX(0)' })),
      transition('idle => shake', [
        animate('70ms', style({ transform: 'translateX(-6px)' })),
        animate('70ms', style({ transform: 'translateX(6px)' })),
        animate('70ms', style({ transform: 'translateX(-5px)' })),
        animate('70ms', style({ transform: 'translateX(5px)' })),
        animate('70ms', style({ transform: 'translateX(-3px)' })),
        animate('70ms', style({ transform: 'translateX(0)' }))
      ])
    ]),
    trigger('fadeDown', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-6px)' }),
        animate('180ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [animate('140ms ease-in', style({ opacity: 0, transform: 'translateY(-4px)' }))])
    ])
  ]
})
export class LoginComponent {
  form = this.fb.group({
    usernameOrEmail: ['', [Validators.required, this.emailFormatIfEmailValidator]],
    password: ['', [Validators.required, Validators.minLength(4)]]
  });

  loading = false;
  errorMessage: string | null = null;
  /** Brief UI state before redirect (matches v3 “Access granted” button). */
  accessGranted = false;
  loggedInUser: LoginResponse['user'] | null = null;
  shakeState: 'idle' | 'shake' = 'idle';
  showPassword = false;
  rememberMe = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authFacade: AuthFacade,
    private readonly router: Router
  ) {}

  get usernameOrEmailCtrl() {
    return this.form.get('usernameOrEmail');
  }

  get passwordCtrl() {
    return this.form.get('password');
  }

  emailFormatIfEmailValidator(control: AbstractControl): ValidationErrors | null {
    const value = String(control.value || '').trim();
    if (!value.includes('@')) {
      return null;
    }
    const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
    return emailRegex.test(value) ? null : { invalidEmail: true };
  }

  submit(): void {
    this.errorMessage = null;
    this.accessGranted = false;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.triggerShake();
      return;
    }

    const { usernameOrEmail, password } = this.form.value;
    this.loading = true;
    this.authFacade.login(usernameOrEmail!, password!).subscribe({
      next: (res) => {
        this.loggedInUser = res.user;
        this.loading = false;
        this.accessGranted = true;
        setTimeout(() => this.router.navigate(['/home']), 700);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage =
          err?.error?.message || err?.message || 'Incorrect email or password. Please try again.';
        this.triggerShake();
      }
    });
  }

  triggerShake(): void {
    this.shakeState = 'shake';
    setTimeout(() => (this.shakeState = 'idle'), 500);
  }

  onInputChange(): void {
    this.errorMessage = null;
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  logout(): void {
    this.authFacade.logout();
    this.loggedInUser = null;
    this.accessGranted = false;
    this.form.reset();
    this.router.navigate(['/login']);
  }
}
