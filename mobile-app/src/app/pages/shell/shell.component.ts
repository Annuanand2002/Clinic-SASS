import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../mobile-core/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss'
})
export class ShellComponent {
  constructor(
    public readonly auth: AuthService,
    private readonly router: Router
  ) {}

  get clinicSelection(): string {
    return this.auth.getClinicHeaderValue() || 'all';
  }

  onClinicChange(value: string): void {
    this.auth.setClinicSelection(value);
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
