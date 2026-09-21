# syntax=docker/dockerfile:1

# ---------- Etapa 1: build ----------
FROM eclipse-temurin:25-jdk AS build
WORKDIR /workspace

# Copiar primero el wrapper y los descriptores para aprovechar la cache de capas.
COPY gradlew ./
COPY gradle ./gradle
COPY settings.gradle build.gradle ./
RUN chmod +x gradlew

# Codigo fuente y build del jar ejecutable (sin tests: el pipeline de Render es de despliegue).
COPY src ./src
RUN ./gradlew --no-daemon clean bootJar -x test \
    && find build/libs -maxdepth 1 -name '*.jar' ! -name '*-plain.jar' -exec cp {} app.jar \;

# ---------- Etapa 2: runtime ----------
FROM eclipse-temurin:25-jre
WORKDIR /app

# Usuario no root (buena practica en Render).
RUN groupadd --system app && useradd --system --gid app app
COPY --from=build /workspace/app.jar app.jar
RUN chown app:app app.jar
USER app

# Render define PORT; application-prod.properties lo respeta (server.port=${PORT:8090}).
EXPOSE 8090
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+UseSerialGC"

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
