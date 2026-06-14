<?php
// admin_api.php — головний ендпоінт дій адміністратора.
// Усі дії вимагають requireAdmin() (is_admin + пройдений другий пароль).
//
// Підтримувані action:
//   stats          — лічильники для дашборду
//   list_reports   — список скарг (фільтр за статусом, пошук, пагінація)
//   report_detail  — повні деталі скарги + дані порушника + його історія
//   set_status     — змінити статус скарги (reviewing/resolved/rejected)
//   warn_user      — винести попередження + надіслати повідомлення
//   restrict_user  — обмежити користувача на N днів
//   ban_user       — забанити користувача
//   unban_user     — зняти санкції (повернути active)
//   delete_content — приховати/видалити пост чи коментар зі скарги
//   send_message   — надіслати повідомлення користувачу від адміністрації
//   list_users     — пошук користувачів для ручної модерації

require_once __DIR__ . '/cors_session.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/moderation_schema.php';

ensureModerationSchema($pdo);
$admin   = requireAdmin($pdo);          // 403 + exit, якщо не адмін
$adminId = (int)$admin['id'];

$input  = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $input['action'] ?? ($_GET['action'] ?? '');

/** Записати дію в журнал аудиту. */
function modLog(PDO $pdo, int $adminId, string $action, ?int $targetUserId = null, ?int $reportId = null, ?string $details = null): void {
    $s = $pdo->prepare("INSERT INTO moderation_log (admin_id, target_user_id, report_id, action, details) VALUES (?, ?, ?, ?, ?)");
    $s->execute([$adminId, $targetUserId, $reportId, $action, $details]);
}

/** Надіслати повідомлення користувачу від імені адміністрації. */
function sendAdminMessage(PDO $pdo, int $userId, int $adminId, ?int $reportId, string $subject, string $body): void {
    $s = $pdo->prepare("INSERT INTO admin_messages (user_id, admin_id, report_id, subject, body) VALUES (?, ?, ?, ?, ?)");
    $s->execute([$userId, $adminId, $reportId, mb_substr($subject, 0, 200), mb_substr($body, 0, 2000)]);
}

try {
    switch ($action) {

        // ── Лічильники для шапки дашборду ───────────────────────────
        case 'stats': {
            $stats = [];
            $stats['pending']    = (int)$pdo->query("SELECT COUNT(*) FROM reports WHERE status='pending'")->fetchColumn();
            $stats['reviewing']  = (int)$pdo->query("SELECT COUNT(*) FROM reports WHERE status='reviewing'")->fetchColumn();
            $stats['resolved']   = (int)$pdo->query("SELECT COUNT(*) FROM reports WHERE status='resolved'")->fetchColumn();
            $stats['rejected']   = (int)$pdo->query("SELECT COUNT(*) FROM reports WHERE status='rejected'")->fetchColumn();
            $stats['total']      = (int)$pdo->query("SELECT COUNT(*) FROM reports")->fetchColumn();
            $stats['banned']     = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE status='banned'")->fetchColumn();
            $stats['restricted'] = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE status='restricted'")->fetchColumn();
            echo json_encode(['success' => true, 'stats' => $stats]);
            break;
        }

        // ── Список скарг ────────────────────────────────────────────
        case 'list_reports': {
            $status = $input['status'] ?? 'pending';
            $page   = max(1, (int)($input['page'] ?? 1));
            $limit  = 20;
            $offset = ($page - 1) * $limit;

            $where  = '';
            $params = [];
            if (in_array($status, ['pending','reviewing','resolved','rejected'], true)) {
                $where = 'WHERE r.status = ?';
                $params[] = $status;
            } elseif ($status !== 'all') {
                $where = "WHERE r.status = 'pending'";
            }

            $sql = "
                SELECT r.id, r.target_type, r.target_id, r.target_url, r.reason_code,
                       r.reason_text, r.content_snapshot, r.status, r.action_taken, r.created_at,
                       rep.username  AS reporter_name,
                       tu.username   AS target_username,
                       tu.status     AS target_status,
                       tu.avatar_url AS target_avatar
                FROM reports r
                LEFT JOIN users rep ON r.reporter_id   = rep.id
                LEFT JOIN users tu  ON r.target_user_id = tu.id
                $where
                ORDER BY (r.status='pending') DESC, r.created_at DESC
                LIMIT $limit OFFSET $offset
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $reports = $stmt->fetchAll();

            echo json_encode(['success' => true, 'reports' => $reports, 'page' => $page]);
            break;
        }

        // ── Деталі однієї скарги + профіль порушника + його історія ──
        case 'report_detail': {
            $id = (int)($input['report_id'] ?? 0);
            $stmt = $pdo->prepare("
                SELECT r.*, rep.username AS reporter_name, rep.avatar_url AS reporter_avatar,
                       tu.username AS target_username, tu.email AS target_email,
                       tu.avatar_url AS target_avatar, tu.status AS target_status,
                       tu.warnings_count, tu.restricted_until, tu.ban_reason, tu.created_at AS target_created
                FROM reports r
                LEFT JOIN users rep ON r.reporter_id    = rep.id
                LEFT JOIN users tu  ON r.target_user_id = tu.id
                WHERE r.id = ? LIMIT 1
            ");
            $stmt->execute([$id]);
            $report = $stmt->fetch();
            if (!$report) { echo json_encode(['success' => false, 'message' => 'Скаргу не знайдено']); break; }

            // Інші скарги на цього ж користувача
            $history = [];
            if (!empty($report['target_user_id'])) {
                $h = $pdo->prepare("
                    SELECT id, target_type, reason_code, status, created_at
                    FROM reports WHERE target_user_id = ? AND id <> ?
                    ORDER BY created_at DESC LIMIT 20
                ");
                $h->execute([(int)$report['target_user_id'], $id]);
                $history = $h->fetchAll();
            }
            echo json_encode(['success' => true, 'report' => $report, 'history' => $history]);
            break;
        }

        // ── Зміна статусу скарги ────────────────────────────────────
        case 'set_status': {
            $id     = (int)($input['report_id'] ?? 0);
            $status = $input['status'] ?? '';
            $note   = trim($input['admin_note'] ?? '');
            if (!in_array($status, ['reviewing','resolved','rejected','pending'], true)) {
                echo json_encode(['success' => false, 'message' => 'Невірний статус']); break;
            }
            $resolvedAt = in_array($status, ['resolved','rejected'], true) ? date('Y-m-d H:i:s') : null;
            $stmt = $pdo->prepare("UPDATE reports SET status=?, admin_id=?, admin_note=?, resolved_at=? WHERE id=?");
            $stmt->execute([$status, $adminId, ($note !== '' ? $note : null), $resolvedAt, $id]);
            modLog($pdo, $adminId, 'set_status:' . $status, null, $id, $note);
            echo json_encode(['success' => true, 'message' => 'Статус оновлено']);
            break;
        }

        // ── Попередження користувачу ────────────────────────────────
        case 'warn_user': {
            $userId   = (int)($input['user_id'] ?? 0);
            $reportId = (int)($input['report_id'] ?? 0) ?: null;
            $msg      = trim($input['message'] ?? '');
            if ($userId <= 0 || $msg === '') { echo json_encode(['success' => false, 'message' => 'Вкажіть користувача та текст']); break; }

            $pdo->prepare("UPDATE users SET warnings_count = warnings_count + 1 WHERE id = ?")->execute([$userId]);
            sendAdminMessage($pdo, $userId, $adminId, $reportId,
                'Попередження від адміністрації',
                "Порушення виявлено.\n\n" . $msg . "\n\nЗа повторні порушення ваш обліковий запис може бути обмежено або заблоковано.");
            if ($reportId) {
                $pdo->prepare("UPDATE reports SET status='resolved', admin_id=?, action_taken='warning', resolved_at=NOW() WHERE id=?")
                    ->execute([$adminId, $reportId]);
            }
            modLog($pdo, $adminId, 'warn', $userId, $reportId, $msg);
            echo json_encode(['success' => true, 'message' => 'Попередження надіслано']);
            break;
        }

        // ── Обмеження користувача ───────────────────────────────────
        case 'restrict_user': {
            $userId   = (int)($input['user_id'] ?? 0);
            $reportId = (int)($input['report_id'] ?? 0) ?: null;
            $days     = max(1, min(365, (int)($input['days'] ?? 7)));
            $msg      = trim($input['message'] ?? '');
            if ($userId <= 0) { echo json_encode(['success' => false, 'message' => 'Вкажіть користувача']); break; }

            $until = date('Y-m-d H:i:s', time() + $days * 86400);
            $pdo->prepare("UPDATE users SET status='restricted', restricted_until=? WHERE id=?")->execute([$until, $userId]);
            sendAdminMessage($pdo, $userId, $adminId, $reportId,
                'Ваш обліковий запис обмежено',
                "Порушення виявлено.\n\n" . ($msg !== '' ? $msg . "\n\n" : '') .
                "Ваш обліковий запис обмежено до {$until} (на {$days} дн.). У цей період частина функцій буде недоступна.");
            if ($reportId) {
                $pdo->prepare("UPDATE reports SET status='resolved', admin_id=?, action_taken='restrict', resolved_at=NOW() WHERE id=?")
                    ->execute([$adminId, $reportId]);
            }
            modLog($pdo, $adminId, "restrict:{$days}d", $userId, $reportId, $msg);
            echo json_encode(['success' => true, 'message' => "Користувача обмежено на {$days} дн."]);
            break;
        }

        // ── Бан користувача ─────────────────────────────────────────
        case 'ban_user': {
            $userId   = (int)($input['user_id'] ?? 0);
            $reportId = (int)($input['report_id'] ?? 0) ?: null;
            $reason   = trim($input['reason'] ?? '');
            $msg      = trim($input['message'] ?? '');
            if ($userId <= 0) { echo json_encode(['success' => false, 'message' => 'Вкажіть користувача']); break; }
            if ($userId === $adminId) { echo json_encode(['success' => false, 'message' => 'Не можна забанити себе']); break; }

            $pdo->prepare("UPDATE users SET status='banned', ban_reason=? WHERE id=?")
                ->execute([($reason !== '' ? mb_substr($reason, 0, 500) : 'Порушення правил'), $userId]);
            sendAdminMessage($pdo, $userId, $adminId, $reportId,
                'Ваш обліковий запис заблоковано',
                "Порушення виявлено.\n\n" . ($msg !== '' ? $msg . "\n\n" : '') .
                "Ваш обліковий запис заблоковано за порушення правил сайту" .
                ($reason !== '' ? ": {$reason}." : "."));
            if ($reportId) {
                $pdo->prepare("UPDATE reports SET status='resolved', admin_id=?, action_taken='ban', resolved_at=NOW() WHERE id=?")
                    ->execute([$adminId, $reportId]);
            }
            modLog($pdo, $adminId, 'ban', $userId, $reportId, $reason);
            echo json_encode(['success' => true, 'message' => 'Користувача заблоковано']);
            break;
        }

        // ── Зняти санкції ───────────────────────────────────────────
        case 'unban_user': {
            $userId = (int)($input['user_id'] ?? 0);
            if ($userId <= 0) { echo json_encode(['success' => false, 'message' => 'Вкажіть користувача']); break; }
            $pdo->prepare("UPDATE users SET status='active', restricted_until=NULL, ban_reason=NULL WHERE id=?")->execute([$userId]);
            sendAdminMessage($pdo, $userId, $adminId, null,
                'Санкції знято',
                "Обмеження з вашого облікового запису знято. Будь ласка, дотримуйтесь правил сайту.");
            modLog($pdo, $adminId, 'unban', $userId, null, null);
            echo json_encode(['success' => true, 'message' => 'Санкції знято']);
            break;
        }

        // ── Приховати/видалити контент зі скарги ────────────────────
        case 'delete_content': {
            $type = $input['target_type'] ?? '';
            $tid  = (int)($input['target_id'] ?? 0);
            $reportId = (int)($input['report_id'] ?? 0) ?: null;
            if ($tid <= 0) { echo json_encode(['success' => false, 'message' => 'Невірний об\'єкт']); break; }

            if ($type === 'post') {
                $pdo->prepare("DELETE FROM posts WHERE id = ?")->execute([$tid]);
            } elseif ($type === 'comment') {
                $pdo->prepare("DELETE FROM comments WHERE id = ?")->execute([$tid]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Цей тип не можна видалити тут']); break;
            }
            if ($reportId) {
                $pdo->prepare("UPDATE reports SET action_taken='content_removed' WHERE id=?")->execute([$reportId]);
            }
            modLog($pdo, $adminId, 'delete_content:' . $type, null, $reportId, 'id=' . $tid);
            echo json_encode(['success' => true, 'message' => 'Контент видалено']);
            break;
        }

        // ── Довільне повідомлення користувачу ───────────────────────
        case 'send_message': {
            $userId   = (int)($input['user_id'] ?? 0);
            $reportId = (int)($input['report_id'] ?? 0) ?: null;
            $subject  = trim($input['subject'] ?? 'Повідомлення від адміністрації');
            $body     = trim($input['body'] ?? '');
            if ($userId <= 0 || $body === '') { echo json_encode(['success' => false, 'message' => 'Вкажіть користувача та текст']); break; }
            sendAdminMessage($pdo, $userId, $adminId, $reportId, $subject, $body);
            modLog($pdo, $adminId, 'message', $userId, $reportId, mb_substr($body, 0, 200));
            echo json_encode(['success' => true, 'message' => 'Повідомлення надіслано']);
            break;
        }

        // ── Пошук користувачів (ручна модерація) ────────────────────
        case 'list_users': {
            $qstr = trim($input['q'] ?? '');
            if ($qstr === '') {
                $stmt = $pdo->query("SELECT id, username, email, status, warnings_count, restricted_until FROM users ORDER BY id DESC LIMIT 30");
                $users = $stmt->fetchAll();
            } else {
                $like = '%' . $qstr . '%';
                $stmt = $pdo->prepare("SELECT id, username, email, status, warnings_count, restricted_until FROM users WHERE username LIKE ? OR email LIKE ? ORDER BY id DESC LIMIT 30");
                $stmt->execute([$like, $like]);
                $users = $stmt->fetchAll();
            }
            echo json_encode(['success' => true, 'users' => $users]);
            break;
        }

        default:
            echo json_encode(['success' => false, 'message' => 'Невідома дія']);
    }
} catch (Exception $e) {
    error_log('admin_api error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Помилка сервера']);
}
