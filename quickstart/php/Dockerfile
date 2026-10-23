FROM webdevops/php-nginx:8.4-alpine
COPY services/php /srv/runhive/backend
COPY quickstart/backend.env /srv/runhive/backend/.env
WORKDIR /srv/runhive/backend
RUN composer install --no-dev --no-interaction --no-progress \
    && mkdir -p runtime/cache runtime/log runtime/session \
    && chmod -R 777 runtime
