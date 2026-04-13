import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../mobile-core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  usernameOrEmail = '';
  password = '';
  loading = false;
  error = '';

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router
  ) {}

  submit(): void {
    if (!this.usernameOrEmail.trim() || !this.password) {
      this.error = 'Username/email and password are required.';
      return;
    }
    this.loading = true;
    this.error = '';
    this.auth.login(this.usernameOrEmail.trim(), this.password).subscribe({
      next: () => {
        this.loading = false;
        void this.router.navigateByUrl('/home', { replaceUrl: true });
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || err?.message || 'Login failed.';
      }
    });
  }
}
