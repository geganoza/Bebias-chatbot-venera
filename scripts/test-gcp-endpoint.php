<?php
// Upload this to your WordPress root (public_html) as test-gcp.php
// Then I'll trigger a request from Cloud Functions to test if it reaches

header('Content-Type: application/json');

// Log the request
$log = [
    'time' => date('Y-m-d H:i:s'),
    'ip' => $_SERVER['REMOTE_ADDR'],
    'method' => $_SERVER['REQUEST_METHOD'],
    'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
    'reached' => true
];

// Return success
echo json_encode(['status' => 'ok', 'message' => 'Request reached WordPress!', 'details' => $log]);
