-- Одноразова чистка старих/битих подарунків (іконки img/gifts/gift_N.png більше не існують).
-- Видаляє лише биті записи, нормальні подарунки не чіпає.
DELETE FROM post_gifts WHERE gift_icon LIKE 'img/gifts/gift_%';
DELETE FROM post_gifts WHERE gift_icon IS NULL OR gift_icon = '';