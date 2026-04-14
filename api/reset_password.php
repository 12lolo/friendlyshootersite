<?php
// Reset or create a user's password in the admin_php.db SQLite database.
// Usage: php reset_password.php <username> <new_password>

if (PHP_SAPI !== 'cli') {
    echo "This script must be run from the command line.\n"; exit(1);
}

if ($argc < 3) {
    echo "Usage: php reset_password.php <username> <new_password>\n"; exit(1);
}

$username = $argv[1];
$pw = $argv[2];
$dbPath = __DIR__ . '/admin_php.db';
$pdo = new PDO('sqlite:' . $dbPath);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$hash = password_hash($pw, PASSWORD_DEFAULT);

$stmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE username = ?');
$stmt->execute([$hash, $username]);
if ($stmt->rowCount() > 0) {
    echo "Updated password for user: $username\n";
    exit(0);
}

// If the user did not exist, create them
$id = bin2hex(random_bytes(8));
$stmt2 = $pdo->prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)');
try {
    $stmt2->execute([$id, $username, $hash]);
    echo "User not found; created user: $username\n";
    exit(0);
} catch (Exception $e) {
    echo "Failed to update or create user: " . $e->getMessage() . "\n";
    exit(1);
}

?>
