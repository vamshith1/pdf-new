# One image: the Next.js site is exported to static files and served by Spring Boot.

# 1) Build the website
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
# Used for canonical URLs and the sitemap (Render passes env vars as build args)
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
COPY frontend/ ./
RUN npm run build

# 2) Build the API with the site bundled inside the jar
FROM maven:3.9-eclipse-temurin-21 AS api
WORKDIR /api
COPY backend/pom.xml ./
RUN mvn -q -B dependency:go-offline
COPY backend/src ./src
COPY --from=web /web/out ./src/main/resources/static
RUN mvn -q -B package -DskipTests

# 3) Runtime image (Ubuntu) with the document engines:
#    LibreOffice (Word/Excel/PowerPoint <-> PDF) and Tesseract (OCR), plus fonts
#    metric-compatible with Microsoft's (Liberation, Carlito, Caladea) so layouts stay put.
FROM eclipse-temurin:21-jre
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       libreoffice-writer-nogui libreoffice-calc-nogui libreoffice-impress-nogui libreoffice-draw-nogui \
       tesseract-ocr tesseract-ocr-eng tesseract-ocr-hin \
       fontconfig fonts-dejavu-core fonts-liberation2 fonts-crosextra-carlito fonts-crosextra-caladea \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --create-home app && mkdir -p /data && chown app:app /data
USER app
WORKDIR /app
COPY --from=api /api/target/pdf-new.jar app.jar
# LibreOffice runs beside the JVM, so the JVM gets less of the (512 MB free-tier) memory.
ENV STORAGE_DIR=/data/jobs \
    TRUST_PROXY=true \
    HOME=/home/app \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=45 -XX:+UseSerialGC -Xss512k"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
