<?php
require_once __DIR__ . '/lib/Response.php';
require_once __DIR__ . '/lib/DB.php';
require_once __DIR__ . '/lib/Auth.php';

$db = new DB(__DIR__ . '/db');
$auth = new Auth($db);

$method = $_SERVER['REQUEST_METHOD'];
if($method==='OPTIONS'){ Response::json(['ok'=>true]); }
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = preg_replace('#^/+#','/',$path);

// helper to read JSON body
function read_json() {
  $raw = file_get_contents('php://input');
  $data = json_decode($raw, true);
  return $data ?: [];
}

// ---- Routes ----

// Health
if($path==='/api' || $path==='/api/'){ Response::json(['ok'=>true, 'service'=>'CertiVerify API']); }

// Register
if($path==='/api/register' && $method==='POST'){
  $d = read_json();
  $name = $d['name'] ?? '';
  $email = $d['email'] ?? '';
  $password = $d['password'] ?? '';
  $role = $d['role'] ?? 'issuer';
  if(!$name || !$email || !$password) Response::error('name, email, password required', 422);
  $res = $auth->register($name, $email, $password, $role);
  Response::json($res, 201);
}

// Login
if($path==='/api/login' && $method==='POST'){
  $d = read_json();
  $email = $d['email'] ?? '';
  $password = $d['password'] ?? '';
  $res = $auth->login($email, $password);
  Response::json($res);
}

// Me
if($path==='/api/me' && $method==='GET'){
  $user = $auth->userFromToken($_SERVER['HTTP_AUTHORIZATION'] ?? null);
  if(!$user) Response::error('Unauthorized', 401);
  Response::json(['ok'=>true, 'user'=>$user]);
}

// List certificates (issuer only)
if($path==='/api/certificates' && $method==='GET'){
  $user = $auth->userFromToken($_SERVER['HTTP_AUTHORIZATION'] ?? null);
  if(!$user) Response::error('Unauthorized', 401);
  $all = $db->read('certificates');
  // issuers see their own; admins see all
  if(($user['role'] ?? '')==='admin'){ $list = $all; }
  else { $list = array_values(array_filter($all, fn($c)=> ($c['issuer_email'] ?? '')===$user['email'])); }
  Response::json(['ok'=>true, 'data'=>$list]);
}

// Issue certificate (issuer)
if($path==='/api/certificates' && $method==='POST'){
  $user = $auth->userFromToken($_SERVER['HTTP_AUTHORIZATION'] ?? null);
  if(!$user) Response::error('Unauthorized', 401);

  $hash = '';
  if(isset($_FILES['pdf']) && is_uploaded_file($_FILES['pdf']['tmp_name'])){
    $hash = hash_file('sha256', $_FILES['pdf']['tmp_name']);
  } else {
    // allow JSON POST without file
    $d = $_POST ?: read_json();
    $text = trim(($d['studentName'] ?? '').'|'.($d['studentId'] ?? '').'|'.($d['program'] ?? '').'|'.($d['issueDate'] ?? ''));
    $hash = hash('sha256', $text);
  }

  $d = $_POST ?: read_json();
  $rec = [
    'id' => bin2hex(random_bytes(8)),
    'student_name' => $d['studentName'] ?? '',
    'student_id' => $d['studentId'] ?? '',
    'program' => $d['program'] ?? '',
    'issue_date' => $d['issueDate'] ?? date('Y-m-d'),
    'hash' => $hash,
    'tx' => bin2hex(random_bytes(16)),
    'status' => 'Valid',
    'issuer_email' => $user['email'] ?? '',
    'created_at' => date('c')
  ];
  $all = $db->read('certificates'); $all[] = $rec; $db->write('certificates', $all);
  Response::json(['ok'=>true, 'record'=>$rec], 201);
}

// Verify by hash or file
if(($path==='/api/verify' || $path==='/api/verify/') && $method==='POST'){
  $hash = '';
  if(isset($_FILES['pdf']) && is_uploaded_file($_FILES['pdf']['tmp_name'])){
    $hash = hash_file('sha256', $_FILES['pdf']['tmp_name']);
  } else {
    $d = $_POST ?: read_json();
    $hash = strtolower(trim($d['hash'] ?? ''));
  }
  if(!$hash) Response::error('hash or pdf required', 422);
  $all = $db->read('certificates');
  foreach($all as $c){
    if(strtolower($c['hash']) === $hash){
      Response::json(['ok'=>true, 'result'=>['status'=>$c['status'],'record'=>$c]]);
    }
  }
  Response::json(['ok'=>true, 'result'=>['status'=>'Not Found']]);
}

// Revoke (issuer owns record)
if($path==='/api/revoke' && $method==='POST'){
  $user = $auth->userFromToken($_SERVER['HTTP_AUTHORIZATION'] ?? null);
  if(!$user) Response::error('Unauthorized', 401);
  $d = read_json();
  $hash = strtolower(trim($d['hash'] ?? ''));
  if(!$hash) Response::error('hash required', 422);
  $all = $db->read('certificates');
  $updated = false;
  foreach($all as &$c){
    if(strtolower($c['hash'])===$hash && (($user['role']==='admin') || ($c['issuer_email']===$user['email']))){
      $c['status'] = 'Revoked';
      $updated = true;
    }
  }
  if($updated){ $db->write('certificates', $all); Response::json(['ok'=>true]); }
  Response::error('Certificate not found or not owned by issuer', 404);
}

// Stats
if($path==='/api/stats' && $method==='GET'){
  $all = $db->read('certificates');
  $valid = 0; $revoked = 0;
  foreach($all as $c){ if($c['status']==='Valid') $valid++; else if($c['status']==='Revoked') $revoked++; }
  Response::json(['ok'=>true, 'stats'=>['total'=>count($all), 'valid'=>$valid, 'revoked'=>$revoked]]);
}

Response::error('Not Found', 404);
