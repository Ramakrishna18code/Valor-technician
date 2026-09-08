# Valor Technician App shell

This workspace contains a mobile-first technician client and a new Spring Boot backend in `backend/`. The backend uses a MySQL database, Flyway migrations, JWT authentication, and role-protected technician APIs.

## Connect it to the existing Valor platform

Before launching the mobile app, start the backend (or configure an existing Valor API origin) and set `apiBaseUrl` in `src/config/environment.ts`.

```js
localStorage.setItem('valor_api_base', 'https://your-existing-valor-api.example');
```

The technician API enforces JWT authentication, the `TECHNICIAN` role, request ownership, and valid status transitions. Its API contract is in `backend/README.md` and matches the routes used by the native app under `/api/technician`.

The modal implementation uses the native `dialog` element, returns focus to its trigger on close, and never hides a focused element with `aria-hidden`, addressing the reported accessibility failure.
