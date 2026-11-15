import { Service, signal } from '@angular/core';

export type ThemeName = 'dark' | 'light';

@Service()
export class ThemeService {
  readonly theme = signal<ThemeName>(this.initial());

  private initial(): ThemeName {
    const attr = document.documentElement.getAttribute('data-theme');
    return attr === 'light' ? 'light' : 'dark';
  }

  toggle(): void {
    this.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  set(theme: ThemeName): void {
    this.theme.set(theme);
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#070b1a' : '#f4f6ff');
    try {
      localStorage.setItem('wg:theme', theme);
    } catch {
      /* storage unavailable – theme still applies for this session */
    }
  }
}
