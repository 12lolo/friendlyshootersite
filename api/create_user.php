<?php
// Create a new admin user in the admin_php.db SQLite database.
// Usage: php create_user.php <username>
// It will prompt for a password on stdin.

if (PHP_SAPI !== 'cli') {
    echo "This script must be run from the command line.\n"; exit(1);
}

if ($argc < 2) {
    echo "Usage: php create_user.php <username>\n"; exit(1);
}

$username = $argv[1];
$dbPath = __DIR__ . '/admin_php.db';
$pdo = new PDO('sqlite:' . $dbPath);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
// Ensure users table exists (in case admin.php hasn't been invoked)
$pdo->exec("CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    password_hash TEXT
);");

function prompt($msg){
    echo $msg;
    $line = trim(fgets(STDIN));
    return $line;
}

if ($argc >= 3) {
    // password provided as argument (non-interactive)
    $pw1 = $argv[2];
    $pw2 = isset($argv[3]) ? $argv[3] : $pw1;
} else {
    $pw1 = prompt('Enter password: ');
    $pw2 = prompt('Confirm password: ');
}
if ($pw1 !== $pw2) { echo "Passwords do not match. Aborting.\n"; exit(1); }

$hash = password_hash($pw1, PASSWORD_DEFAULT);
$id = bin2hex(random_bytes(8));

$stmt = $pdo->prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)');
try{
    $stmt->execute([$id, $username, $hash]);
    echo "Created user: $username\n";
} catch (Exception $e){
    echo "Failed to create user: " . $e->getMessage() . "\n";
    exit(1);
}
