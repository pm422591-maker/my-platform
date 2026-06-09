FROM php:8.1-apache

RUN apt-get update \
    && apt-get install -y --no-install-recommends libcurl4-openssl-dev \
    && docker-php-ext-install mysqli pdo pdo_mysql curl \
    && rm -rf /var/lib/apt/lists/*

RUN a2enmod rewrite

COPY . /var/www/html/

# Копіюємо та даємо права на entrypoint
RUN chmod +x /var/www/html/entrypoint.sh

# Права на весь сайт
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

# Ліміт завантаження файлів
RUN echo "upload_max_filesize = 15M" >> /usr/local/etc/php/php.ini \
 && echo "post_max_size = 16M" >> /usr/local/etc/php/php.ini

ENTRYPOINT ["/var/www/html/entrypoint.sh"]