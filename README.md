# PDF Toolkit (working name)

An online PDF toolkit: merge, split, organize, rotate, compress, convert (JPG ↔ PDF) and secure (protect/unlock) PDFs. Free, no sign-up, and files are deleted automatically.

| Part | Stack |
|---|---|
| Backend | Java 21, Spring Boot 4.2, Apache PDFBox 3 (all Apache-2.0, no AGPL) |
| Frontend | Next.js 16 (static export), React 19, Tailwind CSS 4, pdf.js for previews |
| Deploy | One Docker image: Spring Boot serves the API **and** the exported site |

## Tools

| Tool | API id | Options |
|---|---|---|
| Merge PDF | `merge` | files in order (2–20) |
| Split PDF | `split` | `mode=ranges&ranges=1-3,4-6` · `mode=every&every=2` · `mode=all` |
| Organize PDF | `organize` | `order=3,1,2` (omitted pages are removed), `rotations=0,90,0` |
| Rotate PDF | `rotate` | `angle=90&pages=1-3` or `rotations=90,0,270` (one per page) |
| Compress PDF | `compress` | `level=low\|medium\|high` |
| JPG to PDF | `jpg-to-pdf` | `pageSize=fit\|a4\|letter`, `orientation=auto\|portrait\|landscape`, `margin=none\|small\|large` |
| PDF to JPG | `pdf-to-jpg` | `quality=low\|normal\|high` (72/150/300 DPI), `pages=all` |
| Protect PDF | `protect` | `password` (AES-256) |
| Unlock PDF | `unlock` | `password` |

## API

```
POST   /api/v1/tools/{tool}/jobs   multipart: files=@a.pdf, plus options as fields  → 202 {id, status}
GET    /api/v1/jobs/{id}           → {status: QUEUED|PROCESSING|DONE|FAILED, error?, result?}
GET    /api/v1/jobs/{id}/download  → the file (PDF, JPG or ZIP)
DELETE /api/v1/jobs/{id}           → delete now
GET    /api/v1/tools · /api/v1/limits · /actuator/health
```

Interactive docs: `/api/docs`. Errors are RFC 9457 `application/problem+json` with a user-friendly `detail`.

## How it works

- **Jobs**: uploads are validated (type, magic bytes, size, count), stored in a per-job folder named by a random 144-bit id, and processed on a small bounded worker pool. The client polls until done.
- **Privacy**: originals are deleted as soon as processing ends; results after `FILE_TTL` (60 min) or on "Delete now". Leftovers are purged on startup.
- **Protection**: per-IP rate limit on job creation, queue limit (503 when full), security headers, `no-store` on API responses, PDFs parsed with temp-file buffering to keep memory low.

## Run locally

Requirements: JDK 21+, Node 20+.

```bash
# 1. Build the site (outputs frontend/out)
cd frontend && npm install && npm run build

# 2. Run the app serving that site
cd ../backend && ./mvnw spring-boot:run -Dspring-boot.run.arguments=--app.site-location=file:../frontend/out/
```

Open http://localhost:8080.

Frontend development with hot reload: run the backend with `CORS_ORIGINS=http://localhost:3000`, then `npm run dev` in `frontend/` (it calls the API at `NEXT_PUBLIC_API_URL`, see `.env.development`).

Tests: `cd backend && ./mvnw verify` (unit + HTTP integration tests for every tool) and `cd frontend && npm run lint`.

## Deploy for free (Render)

1. Push this folder to a GitHub repository.
2. Render → **New → Blueprint** → choose the repo → **Apply**. `render.yaml` creates a free Docker web service.
3. Set `NEXT_PUBLIC_SITE_URL` to your final URL.

The free plan sleeps after 15 minutes idle (the first visit then takes ~1 minute) and has 512 MB RAM, so `JOB_WORKERS=1` is set. No database is needed.

## Configuration (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 8080 | HTTP port |
| `STORAGE_DIR` | `./data/jobs` | where job files live |
| `FILE_TTL` | `60m` | how long results are kept |
| `JOB_WORKERS` / `JOB_QUEUE` | 2 / 20 | parallel jobs / waiting jobs |
| `MAX_FILE_SIZE` / `MAX_TOTAL_SIZE` / `MAX_FILES` | 50MB / 100MB / 20 | upload limits |
| `RATE_LIMIT_PER_MINUTE` | 30 | jobs per IP per minute |
| `TRUST_PROXY` | false (true in Docker) | use `X-Forwarded-For` for client IPs |
| `CORS_ORIGINS` | – | only for a separately hosted frontend |

## Rebranding

Name, tagline and description: `frontend/src/lib/brand.ts`. Logo: `frontend/src/components/Logo.tsx` and `frontend/src/app/icon.svg`. Colours: tokens at the top of `frontend/src/app/globals.css`.

## Roadmap

- Phase 2: Word/PowerPoint/Excel ↔ PDF (LibreOffice), OCR, watermark, page numbers
- Phase 3: accounts, free vs Premium limits, payments
- Phase 4: in-browser editor and e-sign, public API keys
