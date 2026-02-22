"""
API Key 鉴权策略：将静态 API Key 注入到请求 Header。
"""

import os
import re

import httpx

from core.config_loader import AuthConfig


def _resolve_env(value: str | None) -> str | None:
    """解析 ${ENV_VAR} 占位符为环境变量值。"""
    if value is None:
        return None
    pattern = re.compile(r"\$\{(\w+)\}")
    def replacer(m: re.Match) -> str:
        env_val = os.getenv(m.group(1), "")
        if not env_val:
            raise ValueError(f"环境变量 {m.group(1)} 未设置")
        return env_val
    return pattern.sub(replacer, value)


class ApiKeyAuth:
    """将 API Key 注入到 HTTP 请求的 Header 中。"""

    def __init__(self, auth_config: AuthConfig):
        self.api_key = _resolve_env(auth_config.api_key)
        self.header_name = auth_config.header_name
        self.header_prefix = auth_config.header_prefix

    def apply(self, client: httpx.AsyncClient) -> httpx.AsyncClient:
        """将鉴权信息应用到 httpx 客户端的默认 Headers。"""
        if self.api_key:
            value = f"{self.header_prefix} {self.api_key}" if self.header_prefix else self.api_key
            client.headers[self.header_name] = value
        return client
