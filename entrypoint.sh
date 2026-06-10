#!/bin/bash
# Виправляємо права на uploads після монтування volume
mkdir -p /var/www/html/uploads/avatars \
         /var/www/html/uploads/banners \
         /var/www/html/uploads/backgrounds \
         /var/www/html/uploads/chat \
         /var/www/html/uploads/blogs

chown -R www-data:www-data /var/www/html/uploads
chmod -R 775 /var/www/html/uploads

# Запускаємо Apache штатно
exec apache2-foreground
