# Una sola imagen: Spring Boot sirve la API (/api) y la app de React ya compilada.

# 1) Compila el frontend
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2) Compila el backend con el frontend adentro (src/main/resources/static)
FROM eclipse-temurin:21-jdk AS backend
WORKDIR /app/backend
COPY backend/.mvn .mvn
COPY backend/mvnw backend/pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline
COPY backend/src src
COPY --from=frontend /app/frontend/dist src/main/resources/static
RUN ./mvnw -B -q package -DskipTests

# 3) Imagen final, solo con el JRE
FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 1001 app
COPY --from=backend /app/backend/target/app.jar app.jar
USER app
ENV SPRING_PROFILES_ACTIVE=prod \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+UseSerialGC -XX:TieredStopAtLevel=1"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
