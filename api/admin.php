<?php
// Simple PHP admin API backed by SQLite3
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');

// simple session-based admin auth
session_start();
// ADMIN password must be provided via environment variable for safety.
// If not set, login and upload are disabled to avoid accidental exposure.
$ADMIN_PASSWORD = getenv('ADMIN_PASSWORD') ?: null;

$dbPath = __DIR__ . '/admin_php.db';
try {
    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA journal_mode = WAL');
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'db_error', 'message' => $e->getMessage()]);
    exit;
}

// Create tables if missing
$pdo->exec("CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT,
  bio TEXT,
  extra TEXT,
  health INTEGER,
  damage INTEGER,
  movement TEXT
);");
$pdo->exec("-- ensure gadgets column exists (best-effort)");
try { $pdo->exec("ALTER TABLE characters ADD COLUMN gadgets TEXT"); } catch (Exception $e) { /* ignore if column exists */ }
$pdo->exec("CREATE TABLE IF NOT EXISTS enemies (
  id TEXT PRIMARY KEY,
  name TEXT,
  bio TEXT,
  extra TEXT,
  health INTEGER,
  damage INTEGER,
  movement TEXT
);");
$pdo->exec("CREATE TABLE IF NOT EXISTS maps (
  id TEXT PRIMARY KEY,
  name TEXT,
  bio TEXT,
  extra TEXT
);");

// users table for admin accounts
$pdo->exec("CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    password_hash TEXT
);");

function jsonIn() {
    $raw = file_get_contents('php://input');
    $d = json_decode($raw, true);
    return $d ?: [];
}

function generateId() {
    if (function_exists('random_bytes')) {
        return bin2hex(random_bytes(8));
    }
    return uniqid('', true);
}

$action = isset($_GET['action']) ? $_GET['action'] : null;

// POST / GET / PUT / DELETE handlers
try {
    if ($action === 'login') {
        // attempt to read password/username from form, JSON body, or query
        $body = jsonIn();
        $user = null; $pass = null;
        if (isset($_POST['username'])) $user = $_POST['username'];
        elseif (isset($body['username'])) $user = $body['username'];
        elseif (isset($_GET['username'])) $user = $_GET['username'];
        if (isset($_POST['password'])) $pass = $_POST['password'];
        elseif (isset($body['password'])) $pass = $body['password'];
        elseif (isset($_GET['password'])) $pass = $_GET['password'];

        // if username provided, try DB users table first
        if ($user && $pass) {
            $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE username = ?');
            $stmt->execute([$user]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row && isset($row['password_hash']) && password_verify($pass, $row['password_hash'])){
                $_SESSION['admin'] = true;
                echo json_encode(['ok'=>true, 'user'=>$user]); exit;
            }
            http_response_code(401); echo json_encode(['error'=>'invalid_credentials']); exit;
        }

        // fallback: if ADMIN_PASSWORD env var is set, allow single-password login (POST with password only)
        if ($pass && $ADMIN_PASSWORD && $pass === $ADMIN_PASSWORD) {
            $_SESSION['admin'] = true;
            echo json_encode(['ok' => true]); exit;
        }

        // if no auth method available
        http_response_code(401); echo json_encode(['error'=>'invalid_password_or_user']); exit;
    }

    if ($action === 'whoami') {
        $is = !empty($_SESSION['admin']);
        echo json_encode(['admin' => $is]);
        exit;
    }

    if ($action === 'upload') {
        // Uploads are disabled. Do not accept files through this endpoint.
        http_response_code(403);
        echo json_encode(['error' => 'upload_disabled']);
        exit;
    }

    if ($action === 'items') {
        $type = isset($_GET['type']) ? $_GET['type'] : '';
        if (!$type) { http_response_code(400); echo json_encode(['error'=>'missing type']); exit; }
            if ($type === 'character' || $type === 'enemy') {
            $table = $type === 'character' ? 'characters' : 'enemies';
            $stmt = $pdo->query("SELECT * FROM $table ORDER BY name COLLATE NOCASE");
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            // decode extras and gadgets
            foreach ($rows as &$r) {
                $r['extra'] = $r['extra'] ? json_decode($r['extra'], true) : new stdClass();
                if ($type === 'character' && isset($r['gadgets']) && $r['gadgets']) {
                    $gad = json_decode($r['gadgets'], true);
                    if ($gad !== null) $r['extra']['gadgets'] = $gad;
                }
            }
            $key = $type === 'character' ? 'characters' : 'enemies';
            echo json_encode([$key => $rows]);
            exit;
        } elseif ($type === 'map') {
            $stmt = $pdo->query("SELECT * FROM maps ORDER BY name COLLATE NOCASE");
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as &$r) { $r['extra'] = $r['extra'] ? json_decode($r['extra'], true) : new stdClass(); }
            echo json_encode(['maps' => $rows]);
            exit;
        } else {
            http_response_code(400); echo json_encode(['error'=>'invalid type']); exit;
        }
    }

    // List images from workspace folders (maps, Enemy, Charachters)
    if ($action === 'list_images') {
        $allowed = ['maps','Enemy','Charachters'];
        $out = [];
        foreach ($allowed as $fld) {
            $dir = realpath(__DIR__ . '/..') . DIRECTORY_SEPARATOR . $fld;
            $out[$fld] = [];
            if (is_dir($dir)) {
                $files = scandir($dir);
                sort($files, SORT_NATURAL | SORT_FLAG_CASE);
                foreach ($files as $f) {
                    if ($f === '.' || $f === '..') continue;
                    $full = $dir . DIRECTORY_SEPARATOR . $f;
                    if (!is_file($full)) continue;
                    $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
                    if (in_array($ext, ['png','jpg','jpeg','gif','webp','svg'])) {
                        // return web-accessible path (relative to web root)
                        $out[$fld][] = '/' . $fld . '/' . $f;
                    }
                }
            }
        }
        echo json_encode(['folders' => $out]);
        exit;
    }

    if ($action === 'item' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        if (empty($_SESSION['admin'])) { http_response_code(401); echo json_encode(['error'=>'unauthorized']); exit; }
        $body = jsonIn();
        $type = isset($body['type']) ? $body['type'] : null;
        $item = isset($body['item']) ? $body['item'] : null;
        if (!$type || !$item) { http_response_code(400); echo json_encode(['error'=>'missing type or item']); exit; }
        $id = generateId();
        if ($type === 'map') {
            $stmt = $pdo->prepare('INSERT INTO maps (name,bio,extra) VALUES (?,?,?)');
            $stmt->execute([$item['name'] ?? '', $item['bio'] ?? '', json_encode($item['extra'] ?? new stdClass())]);
            $id = $pdo->lastInsertId();
            $stmt = $pdo->prepare('SELECT * FROM maps WHERE id = ?'); $stmt->execute([$id]); $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $row['extra'] = $row['extra'] ? json_decode($row['extra'], true) : new stdClass();
            echo json_encode($row); exit;
        } elseif ($type === 'character' || $type === 'enemy') {
            $table = $type === 'character' ? 'characters' : 'enemies';
            if ($type === 'character') {
                $gad_json = isset($item['extra']['gadgets']) ? json_encode($item['extra']['gadgets']) : null;
                $stmt = $pdo->prepare("INSERT INTO $table (name,bio,extra,health,damage,movement,gadgets) VALUES (?,?,?,?,?,?,?)");
                $stmt->execute([$item['name'] ?? '', $item['bio'] ?? '', json_encode($item['extra'] ?? new stdClass()), intval($item['health'] ?? 0), intval($item['damage'] ?? 0), $item['movement'] ?? 'medium', $gad_json]);
            } else {
                $stmt = $pdo->prepare("INSERT INTO $table (name,bio,extra,health,damage,movement) VALUES (?,?,?,?,?,?)");
                $stmt->execute([$item['name'] ?? '', $item['bio'] ?? '', json_encode($item['extra'] ?? new stdClass()), intval($item['health'] ?? 0), intval($item['damage'] ?? 0), $item['movement'] ?? 'medium']);
            }
            $id = $pdo->lastInsertId();
            $stmt = $pdo->prepare("SELECT * FROM $table WHERE id = ?"); $stmt->execute([$id]); $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $row['extra'] = $row['extra'] ? json_decode($row['extra'], true) : new stdClass();
            if ($type === 'character' && isset($row['gadgets']) && $row['gadgets']) { $row['extra']['gadgets'] = json_decode($row['gadgets'], true); }
            echo json_encode($row); exit;
        } else { http_response_code(400); echo json_encode(['error'=>'invalid type']); exit; }
    }

    if ($action === 'item' && $_SERVER['REQUEST_METHOD'] === 'PUT') {
        if (empty($_SESSION['admin'])) { http_response_code(401); echo json_encode(['error'=>'unauthorized']); exit; }
        $id = isset($_GET['id']) ? $_GET['id'] : null;
        $body = jsonIn();
        $type = isset($body['type']) ? $body['type'] : null;
        $item = isset($body['item']) ? $body['item'] : null;
        if (!$id || !$type || !$item) { http_response_code(400); echo json_encode(['error'=>'missing id/type/item']); exit; }
        if ($type === 'map') {
            $stmt = $pdo->prepare('UPDATE maps SET name = ?, bio = ?, extra = ? WHERE id = ?');
            $stmt->execute([$item['name'] ?? '', $item['bio'] ?? '', json_encode($item['extra'] ?? new stdClass()), $id]);
            $stmt = $pdo->prepare('SELECT * FROM maps WHERE id = ?'); $stmt->execute([$id]); $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $row['extra'] = $row['extra'] ? json_decode($row['extra'], true) : new stdClass();
            echo json_encode($row); exit;
        } elseif ($type === 'character' || $type === 'enemy') {
            $table = $type === 'character' ? 'characters' : 'enemies';
            if ($type === 'character') {
                $gad_json = isset($item['extra']['gadgets']) ? json_encode($item['extra']['gadgets']) : null;
                $stmt = $pdo->prepare("UPDATE $table SET name = ?, bio = ?, extra = ?, health = ?, damage = ?, movement = ?, gadgets = ? WHERE id = ?");
                $stmt->execute([$item['name'] ?? '', $item['bio'] ?? '', json_encode($item['extra'] ?? new stdClass()), intval($item['health'] ?? 0), intval($item['damage'] ?? 0), $item['movement'] ?? 'medium', $gad_json, $id]);
            } else {
                $stmt = $pdo->prepare("UPDATE $table SET name = ?, bio = ?, extra = ?, health = ?, damage = ?, movement = ? WHERE id = ?");
                $stmt->execute([$item['name'] ?? '', $item['bio'] ?? '', json_encode($item['extra'] ?? new stdClass()), intval($item['health'] ?? 0), intval($item['damage'] ?? 0), $item['movement'] ?? 'medium', $id]);
            }
            $stmt = $pdo->prepare("SELECT * FROM $table WHERE id = ?"); $stmt->execute([$id]); $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $row['extra'] = $row['extra'] ? json_decode($row['extra'], true) : new stdClass();
            if ($type === 'character' && isset($row['gadgets']) && $row['gadgets']) { $row['extra']['gadgets'] = json_decode($row['gadgets'], true); }
            echo json_encode($row); exit;
        } else { http_response_code(400); echo json_encode(['error'=>'invalid type']); exit; }
    }

    if ($action === 'item' && $_SERVER['REQUEST_METHOD'] === 'DELETE') {
        if (empty($_SESSION['admin'])) { http_response_code(401); echo json_encode(['error'=>'unauthorized']); exit; }
        $id = isset($_GET['id']) ? $_GET['id'] : null;
        $type = isset($_GET['type']) ? $_GET['type'] : null;
        if (!$id || !$type) { http_response_code(400); echo json_encode(['error'=>'missing id or type']); exit; }
        if ($type === 'map') {
            $stmt = $pdo->prepare('SELECT * FROM maps WHERE id = ?'); $stmt->execute([$id]); $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $stmt = $pdo->prepare('DELETE FROM maps WHERE id = ?'); $stmt->execute([$id]);
            if ($row) { $row['extra'] = $row['extra'] ? json_decode($row['extra'], true) : new stdClass(); }
            echo json_encode(['removed' => $row]); exit;
        } elseif ($type === 'character' || $type === 'enemy') {
            $table = $type === 'character' ? 'characters' : 'enemies';
            $stmt = $pdo->prepare("SELECT * FROM $table WHERE id = ?"); $stmt->execute([$id]); $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $stmt = $pdo->prepare("DELETE FROM $table WHERE id = ?"); $stmt->execute([$id]);
            if ($row) { $row['extra'] = $row['extra'] ? json_decode($row['extra'], true) : new stdClass(); }
            echo json_encode(['removed' => $row]); exit;
        } else { http_response_code(400); echo json_encode(['error'=>'invalid type']); exit; }
    }

    http_response_code(404);
    echo json_encode(['error' => 'unknown_action']);
    exit;
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server_error', 'message' => $e->getMessage()]);
    exit;
}

?>
