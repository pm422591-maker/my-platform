-- ═══════════════════════════════════════════════════════════
-- Таблиця відгуків на заявки-анкети (post_type = 'requests')
-- Виконати один раз у БД mywebsite
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS post_applications (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    post_id      INT NOT NULL,                 -- анкета, на яку відгукнулись
    owner_id     INT NOT NULL,                 -- автор анкети (отримувач заявки)
    applicant_id INT NOT NULL,                 -- хто відгукнувся
    comment      VARCHAR(500) DEFAULT NULL,    -- невеликий коментар при відгуку
    status       ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
    is_read      TINYINT(1) NOT NULL DEFAULT 0,-- чи переглянув власник
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_post_applicant (post_id, applicant_id),
    KEY idx_owner (owner_id),
    KEY idx_applicant (applicant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;