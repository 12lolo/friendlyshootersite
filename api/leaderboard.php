<?php
// Simple PHP endpoint to serve leaderboard JSON with permissive CORS for the widget.
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');

// Path to the data file (relative to site root)
$dataPath = __DIR__ . '/../webleaderboard/example-data.json';

if (!file_exists($dataPath)) {
    echo json_encode(["entries" => []]);
    exit;
}

$raw = file_get_contents($dataPath);
$decoded = json_decode($raw, true);
if ($decoded === null) {
    // invalid JSON, return empty
    echo json_encode(["entries" => []]);
    exit;
}

// If the file contains a bare array, return as { entries: [...] }
if (array_values($decoded) === $decoded) {
    echo json_encode(["entries" => $decoded]);
    exit;
}

// Otherwise return decoded content as-is
echo json_encode($decoded);
