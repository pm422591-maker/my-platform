FROM php:8.1-apache

# Встановлюємо модулі для бази даних (mysqli та pdo)
RUN docker-php-ext-install mysqli pdo pdo_mysql

# Вмикаємо модуль Apache для гарних посилань
RUN a2enmod rewrite

# Копіюємо всі твої файли в папку сервера всередині Docker
COPY . /var/www/html/

# Даємо серверу права на твої файли (це виправить 403 помилки)
RUN chown -R www-data:www-data /var/www/html