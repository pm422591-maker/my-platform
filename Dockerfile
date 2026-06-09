FROM php:8.1-apache

# Встановлюємо модулі для бази даних (mysqli та pdo)
RUN apt-get update \
    && apt-get install -y --no-install-recommends libcurl4-openssl-dev \
    && docker-php-ext-install mysqli pdo pdo_mysql curl \
    && rm -rf /var/lib/apt/lists/*

# Вмикаємо модуль Apache для гарних посилань
RUN a2enmod rewrite

# Копіюємо всі файли в папку сервера
COPY . /var/www/html/

# Створюємо папки для завантажень заздалегідь (щоб www-data мав права)
RUN mkdir -p /var/www/html/uploads/avatars \
             /var/www/html/uploads/banners \
             /var/www/html/uploads/backgrounds \
    && chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html \
    && chmod -R 775 /var/www/html/uploads