<?php
class DB {
  private $dir;
  public function __construct($dir) {
    $this->dir = rtrim($dir, '/');
  }
  private function path($name){ return $this->dir . '/' . $name . '.json'; }
  public function read($name) {
    $p = $this->path($name);
    if(!file_exists($p)) return [];
    $txt = file_get_contents($p);
    $data = json_decode($txt, true);
    return $data ?: [];
  }
  public function write($name, $data) {
    $p = $this->path($name);
    file_put_contents($p, json_encode($data, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT));
  }
}
