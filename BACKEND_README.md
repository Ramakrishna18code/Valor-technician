# Valor shared backend

This is the single Spring Boot service for Customer, Technician, Admin, and Super Admin clients. It is intentionally not a technician-only backend: all roles work against the same MySQL database and shared aggregates.

## Run prerequisites

- Java 21
- Maven 3.9+
- MySQL 8+
- a Base64-encoded, 32-byte-or-longer `JWT_SECRET` (required in every environment)

Create the `valor_lifts` database, configure `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD`, then run:

```powershell
mvn spring-boot:run
```

OpenAPI UI is available at `/swagger-ui.html`. Migrations live in `src/main/resources/db/migration` and are managed by Flyway.

## Security and ownership

- All users exist in one `users` table with `CUSTOMER`, `TECHNICIAN`, `ADMIN`, or `SUPER_ADMIN` roles.
- Technician endpoints require `ROLE_TECHNICIAN` and validate `TechnicianAssignment` ownership before allowing a job transition.
- A job cannot be completed with a generic status call; it requires a service visit/diagnosis and a final service report.
- Local storage is behind `FileStorageService`; an S3 implementation can replace `LocalFileStorageService` later.

## Initial technician endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/v1/auth/login` | JWT login |
| GET | `/api/v1/technician/dashboard` | Job counters |
| GET | `/api/v1/technician/jobs` | Current technician's assigned jobs |
| POST | `/api/v1/technician/jobs/{id}/accept` | Accept own assigned job |
| PATCH | `/api/v1/technician/jobs/{id}/status` | Update permitted in-progress status |
| PUT | `/api/v1/technician/jobs/{id}/diagnosis` | Begin/update service visit diagnosis |
| POST | `/api/v1/technician/jobs/{id}/report` | Submit report and complete request |
