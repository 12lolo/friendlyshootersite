<?php
// Leaderboard endpoint with optional Unity Gaming Services (UGS) proxy.
// It will use UGS when the following environment variables are set on the server:
//   UGS_SERVERTOKEN  - server access token (keep this secret)
//   UGS_ORG_ID       - Unity organization id
//   UGS_PROJECT_ID   - Unity project id
//   UGS_LEADERBOARD_ID - leaderboard id
// If any of those are missing, the endpoint falls back to serving the local example JSON.

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');

$dataPath = __DIR__ . '/../webleaderboard/example-data.json';

// Helper: return local data
function serve_local() {
    global $dataPath;
    if (!file_exists($dataPath)) {
        echo json_encode(["entries" => []]);
        return;
    }
    $raw = @file_get_contents($dataPath);
    $decoded = json_decode($raw, true);
    if ($decoded === null) {
        echo json_encode(["entries" => []]);
        return;
    }
    if (array_values($decoded) === $decoded) {
        echo json_encode(["entries" => $decoded]);
        return;
    }
    echo json_encode($decoded);
}

// Read config from environment (preferred) or query params (useful for testing)
$token = getenv('UGS_SERVERTOKEN') ?: (isset($_GET['token']) ? $_GET['token'] : null);
$org = getenv('UGS_ORG_ID') ?: (isset($_GET['org']) ? $_GET['org'] : null);
$project = getenv('UGS_PROJECT_ID') ?: (isset($_GET['project']) ? $_GET['project'] : null);
$leaderboard = getenv('UGS_LEADERBOARD_ID') ?: (isset($_GET['leaderboard']) ? $_GET['leaderboard'] : null);

if (!$token || !$org || !$project || !$leaderboard) {
    // Not configured for UGS — serve local data
    serve_local();
    return;
}

// Build UGS REST API URL
$ugsUrl = sprintf('https://leaderboards.services.api.unity.com/v1/organizations/%s/projects/%s/leaderboards/%s/scores', rawurlencode($org), rawurlencode($project), rawurlencode($leaderboard));

// Perform request to UGS
$ch = curl_init($ugsUrl . '?limit=100');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $token,
    'Accept: application/json'
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
$resp = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
curl_close($ch);

if ($resp === false || $code < 200 || $code >= 300) {
    // On error, fall back to local data to keep the widget usable
    serve_local();
    return;
}

$json = json_decode($resp, true);
if ($json === null) {
    serve_local();
    return;
}

// Map UGS response to widget-friendly entries array
$results = isset($json['results']) ? $json['results'] : (isset($json['entries']) ? $json['entries'] : []);
$entries = [];
foreach ($results as $r) {
    $entries[] = [
        'playerId' => isset($r['playerId']) ? $r['playerId'] : (isset($r['playerId']) ? $r['playerId'] : ''),
        'playerName' => isset($r['playerName']) ? $r['playerName'] : (isset($r['playerId']) ? $r['playerId'] : ''),
        'score' => isset($r['score']) ? $r['score'] : (isset($r['value']) ? $r['value'] : 0),
        'timestamp' => isset($r['submittedAt']) ? strtotime($r['submittedAt']) : (isset($r['createdAt']) ? strtotime($r['createdAt']) : time())
    ];
}

echo json_encode(['entries' => $entries]);
