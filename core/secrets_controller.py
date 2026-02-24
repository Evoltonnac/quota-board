"""
Secrets 控制器：负责安全存储 API Key、OAuth Token 等敏感信息。
统一存储到 secrets.json 文件中，每个 secret_id 作为顶层 key。
"""

import os
import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_SECRETS_DIR = Path(os.getenv("QUOTA_BOARD_ROOT", ".")) / "data"
_SECRETS_FILE = "secrets.json"


class SecretsController:
    """
    基于文件的安全存储。
    所有 secrets 统一存储到 secrets.json 文件中，每个 secret_id 作为顶层 key。
    """

    def __init__(self, secrets_dir: str | Path | None = None):
        if secrets_dir is None:
            secrets_dir = _SECRETS_DIR
        self.secrets_dir = Path(secrets_dir)
        self.secrets_dir.mkdir(parents=True, exist_ok=True)
        self.secrets_file = self.secrets_dir / _SECRETS_FILE
        logger.info(f"Secrets 存储文件: {self.secrets_file}")

    def _load_all(self) -> dict[str, Any]:
        """加载所有 secrets。"""
        if not self.secrets_file.exists():
            return {}
        try:
            with open(self.secrets_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"读取 secrets 文件失败: {e}")
            return {}

    def _save_all(self, data: dict[str, Any]):
        """保存所有 secrets。"""
        try:
            with open(self.secrets_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except IOError as e:
            logger.error(f"保存 secrets 文件失败: {e}")

    def get_secrets(self, secret_id: str) -> dict[str, Any]:
        """
        获取指定 secret_id 的所有 secrets。
        返回空字典如果不存在。
        """
        all_secrets = self._load_all()
        return all_secrets.get(secret_id, {})

    def get_secret(self, secret_id: str, key: str) -> Any:
        """获取指定 secret_id 下的单个 secret 值。"""
        secrets = self.get_secrets(secret_id)
        return secrets.get(key)

    def set_secrets(self, secret_id: str, data: dict[str, Any]):
        """
        设置指定 secret_id 的 secrets（合并现有值）。
        """
        all_secrets = self._load_all()

        # 合并到现有 secret_id 下
        if secret_id in all_secrets:
            all_secrets[secret_id].update(data)
        else:
            all_secrets[secret_id] = data

        self._save_all(all_secrets)
        logger.debug(f"Secrets 已保存: {secret_id}")

    def set_secret(self, secret_id: str, key: str, value: Any):
        """设置单个 secret 值。"""
        self.set_secrets(secret_id, {key: value})

    def delete_secrets(self, secret_id: str):
        """删除指定 secret_id 的所有 secrets。"""
        all_secrets = self._load_all()
        if secret_id in all_secrets:
            del all_secrets[secret_id]
            self._save_all(all_secrets)
            logger.debug(f"Secrets 已删除: {secret_id}")

    def delete_secret(self, secret_id: str, key: str):
        """删除指定 secret_id 下的单个 secret。"""
        all_secrets = self._load_all()
        if secret_id in all_secrets and key in all_secrets[secret_id]:
            del all_secrets[secret_id][key]
            self._save_all(all_secrets)
            logger.debug(f"Secret '{key}' 已删除: {secret_id}")
