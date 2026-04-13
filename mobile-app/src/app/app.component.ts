import { Component, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { WideScreenComponent } from './pages/wide-screen/wide-screen.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, WideScreenComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  protected mobileOrTabletOnly = this.isMobileOrTablet();

  @HostListener('window:resize')
  onResize(): void {
    this.mobileOrTabletOnly = this.isMobileOrTablet();
  }

  private isMobileOrTablet(): boolean {
    return window.innerWidth <= 1024;
  }
}
