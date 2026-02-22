"""
开发模式专用：监控 Python 文件变更，自动重启后端服务。
用法: python scripts/dev_server.py [port]
"""

import os
import signal
import subprocess
import sys
import time

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

# 项目根目录
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 监控的目录
WATCH_DIRS = [
    os.path.join(PROJECT_ROOT, "core"),
    os.path.join(PROJECT_ROOT, "config"),
]
# 同时监控 main.py
WATCH_FILES_EXTRA = [
    os.path.join(PROJECT_ROOT, "main.py"),
]

# 监控的文件扩展名
WATCH_EXTENSIONS = {".py", ".yaml", ".yml", ".json"}

# 重启冷却时间（秒），防止多次触发
COOLDOWN = 1.5


class BackendProcess:
    """管理后端子进程的生命周期。"""

    def __init__(self, port: int):
        self.port = port
        self.process: subprocess.Popen | None = None

    def start(self):
        print(f"\n🚀 启动 Python 后端 (port={self.port})...")
        env = os.environ.copy()
        env["PYTHONPATH"] = PROJECT_ROOT

        # 确保使用 pyenv 管理的 Python
        python_path = self._get_pyenv_python()
        self.process = subprocess.Popen(
            [python_path, "main.py", str(self.port)],
            cwd=PROJECT_ROOT,
            env=env,
        )
        print(f"✅ 后端已启动 (PID: {self.process.pid})")

    def _get_pyenv_python(self) -> str:
        """获取 pyenv 管理的 Python 解释器路径"""
        import shutil
        # 优先使用 pyenv which python
        try:
            result = subprocess.run(
                ["pyenv", "which", "python"],
                capture_output=True,
                text=True,
                check=True,
            )
            return result.stdout.strip()
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass
        # 回退到 sys.executable
        return sys.executable

    def stop(self):
        if self.process and self.process.poll() is None:
            print(f"🛑 停止后端 (PID: {self.process.pid})...")
            # 发送 SIGTERM 让 uvicorn 优雅退出
            self.process.send_signal(signal.SIGTERM)
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                print("⚠️  强制终止...")
                self.process.kill()
                self.process.wait()
            print("✅ 后端已停止")

    def restart(self):
        self.stop()
        self.start()


class HotReloadHandler(FileSystemEventHandler):
    """文件变更事件处理：自动重启后端。"""

    def __init__(self, backend: BackendProcess):
        self.backend = backend
        self._last_trigger = 0

    def _should_trigger(self, path: str) -> bool:
        _, ext = os.path.splitext(path)
        if ext not in WATCH_EXTENSIONS:
            return False
        # __pycache__ 变更忽略
        if "__pycache__" in path:
            return False
        return True

    def on_modified(self, event):
        if event.is_directory:
            return
        if not self._should_trigger(event.src_path):
            return

        now = time.time()
        if now - self._last_trigger < COOLDOWN:
            return
        self._last_trigger = now

        rel_path = os.path.relpath(event.src_path, PROJECT_ROOT)
        print(f"\n🔄 检测到变更: {rel_path}")
        self.backend.restart()

    def on_created(self, event):
        self.on_modified(event)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8400

    backend = BackendProcess(port)
    backend.start()

    handler = HotReloadHandler(backend)
    observer = Observer()

    for watch_dir in WATCH_DIRS:
        if os.path.isdir(watch_dir):
            observer.schedule(handler, watch_dir, recursive=True)
            print(f"👁️  监控目录: {os.path.relpath(watch_dir, PROJECT_ROOT)}/")

    # 监控项目根目录下的特定文件（非递归）
    observer.schedule(handler, PROJECT_ROOT, recursive=False)
    print(f"👁️  监控文件: main.py")

    observer.start()
    print(f"\n🔥 开发模式已启动 — 文件变更将自动重启后端")
    print(f"   后端地址: http://localhost:{port}")
    print(f"   按 Ctrl+C 退出\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n👋 正在退出...")
        observer.stop()
        backend.stop()

    observer.join()
    print("✅ 开发服务已完全停止")


if __name__ == "__main__":
    main()
