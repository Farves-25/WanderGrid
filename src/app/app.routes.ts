import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService } from './core/services/auth.service';

const requireAuth: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.signedIn() ? true : router.createUrlTree(['/login'], { queryParams: { redirect: state.url } });
};

const guestOnly: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.signedIn()) return true;
  const redirect = route.queryParamMap.get('redirect');
  return router.parseUrl(redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/bookings');
};

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'WanderGrid — Book international flights',
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
    path: 'checkout',
    canActivate: [requireAuth],
    title: 'Checkout — WanderGrid',
    loadComponent: () => import('./features/checkout/checkout.component').then((m) => m.CheckoutComponent),
  },
  {
    path: 'booking/:ref',
    canActivate: [requireAuth],
    title: 'Your booking — WanderGrid',
    loadComponent: () => import('./features/bookings/booking-detail.component').then((m) => m.BookingDetailComponent),
  },
  {
    path: 'bookings',
    canActivate: [requireAuth],
    title: 'My trips — WanderGrid',
    loadComponent: () => import('./features/bookings/bookings.component').then((m) => m.BookingsComponent),
  },
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
