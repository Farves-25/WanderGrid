import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService } from './core/services/auth.service';

const requireAuth: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  return auth.signedIn() ? true : router.createUrlTree(['/login'], { queryParams: { redirect: state.url } });
};

const guestOnly: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  if (!auth.signedIn() || route.queryParamMap.get('mode') === 'reset') return true;
  const redirect = route.queryParamMap.get('redirect');
  return router.parseUrl(redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/saved');
};

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'WanderGrid — Live flight prices',
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'flights',
    title: 'Flight results — WanderGrid',
    loadComponent: () => import('./features/results/results.component').then((m) => m.ResultsComponent),
  },
  {
    path: 'login',
    canActivate: [guestOnly],
    title: 'Sign in — WanderGrid',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'saved',
    canActivate: [requireAuth],
    title: 'Saved trips — WanderGrid',
    loadComponent: () => import('./features/saved/saved.component').then((m) => m.SavedComponent),
  },
  { path: 'bookings', redirectTo: 'saved' },
  {
    path: 'alerts',
    canActivate: [requireAuth],
    title: 'Price alerts — WanderGrid',
    loadComponent: () => import('./features/alerts/alerts.component').then((m) => m.AlertsComponent),
  },
  {
    path: 'account',
    canActivate: [requireAuth],
    title: 'Account — WanderGrid',
    loadComponent: () => import('./features/account/account.component').then((m) => m.AccountComponent),
  },
  { path: '**', redirectTo: '' },
];
