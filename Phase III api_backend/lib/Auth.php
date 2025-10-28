<?php
require_once __DIR__ . '/DB.php';
require_once __DIR__ . '/Response.php';

class Auth {
  private $db;
  public function __construct($db) { $this->db = $db; }

  public function register($name, $email, $password, $role='issuer'){
    $users = $this->db->read('users');
    foreach($users as $u){ if(strtolower($u['email'])===strtolower($email)) Response::error('Email already exists', 409); }
    $users[] = [
      'id' => bin2hex(random_bytes(8)),
      'name' => $name,
      'email' => $email,
      'password' => password_hash($password, PASSWORD_BCRYPT),
      'role' => $role,
      'created_at' => date('c')
    ];
    $this->db->write('users', $users);
    return ['ok'=>true];
  }

  public function login($email, $password){
    $users = $this->db->read('users');
    foreach($users as $u){
      if(strtolower($u['email'])===strtolower($email) && password_verify($password, $u['password'])){
        $sessions = $this->db->read('sessions');
        $token = bin2hex(random_bytes(16));
        $sessions[] = ['token'=>$token, 'email'=>$u['email'], 'role'=>$u['role'], 'created_at'=>date('c')];
        $this->db->write('sessions', $sessions);
        return ['ok'=>true, 'token'=>$token, 'email'=>$u['email'], 'role'=>$u['role']];
      }
    }
    Response::error('Invalid credentials', 401);
  }

  public function userFromToken($authHeader){
    if(!$authHeader) return null;
    if(stripos($authHeader, 'Bearer ')===0){ $token = substr($authHeader, 7); } else { $token = $authHeader; }
    $sessions = $this->db->read('sessions');
    foreach($sessions as $s){ if($s['token']===$token) return $s; }
    return null;
  }
}
