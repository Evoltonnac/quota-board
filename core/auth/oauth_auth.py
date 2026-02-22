"""
OAuth 2.0 授权流程管理器 (支持 PKCE).

不仅处理标准的 OAuth 流程 (RFC 7636)，还支持 OpenRouter 等平台的自定义扩展
(如参数重命名、JSON Token 请求等)。
"""

import logging
import time
import httpx
from urllib.parse import urlencode
from typing import Optional, Any

from core.config_loader import AuthConfig
from core.secrets_controller import SecretsController
from .oauth_types import OAuthParams, CodeChallengeMethod, GrantType, ResponseType
from .pkce import PKCEUtils

logger = logging.getLogger(__name__)


class OAuthAuth:
    """
    OAuth 2.0 授权流程管理器。
    """

    def __init__(self, auth_config: AuthConfig, source_id: str, secrets_controller: SecretsController):
        self.config = auth_config
        self.source_id = source_id
        self.secrets = secrets_controller
        self._token_data: dict | None = None
        self._load_token()

    # ── Token 持久化 ──────────────────────────────────

    def _load_token(self):
        """从 SecretsController 加载 token。"""
        secrets = self.secrets.get_secrets(self.source_id)
        # 兼容旧版和新版存储
        self._token_data = secrets.get(OAuthParams.ACCESS_TOKEN) or secrets.get("oauth_token")
        if self._token_data:
            # 确保 access_token 字段存在
            if OAuthParams.ACCESS_TOKEN not in self._token_data:
                # 尝试从自定义字段回复
                field = self.config.token_field or "access_token"
                if field in self._token_data:
                    self._token_data[OAuthParams.ACCESS_TOKEN] = self._token_data[field]

            logger.info(f"[{self.source_id}] 已加载 OAuth Token")

    def _save_token(self, token_data: dict[str, Any]):
        """保存 Token 到 SecretsController。"""
        # 标准化：确保包含保存时间
        token_data["saved_at"] = time.time()

        # 确保关键字段存在（从 token_field 复制到 access_token）
        if self.config.token_field and self.config.token_field in token_data:
            token = token_data[self.config.token_field]
            # 清理：移除原始的 provider 特定字段，只保留标准化字段
            clean_data = {
                "access_token": token,
                "saved_at": token_data["saved_at"]
            }
            # 如果有 refresh_token 也保留
            if "refresh_token" in token_data:
                clean_data["refresh_token"] = token_data["refresh_token"]
            token_data = clean_data

        # 保存为标准结构
        self.secrets.set_secrets(self.source_id, {
            OAuthParams.ACCESS_TOKEN: token_data
        })
        self._token_data = token_data
        logger.info(f"[{self.source_id}] OAuth Token 已保存")

    def _save_pkce_state(self, verifier: str, state: str) -> None:
        """保存 PKCE Verifier (用于后续换 Token)。存储到同一 source_id 下。"""
        self.secrets.set_secrets(self.source_id, {
            "oauth_pkce": {
                "verifier": verifier,
                "state": state,
                "created_at": time.time()
            }
        })

    def _get_pkce_verifier(self) -> str | None:
        """获取并清除保存的 PKCE Verifier。"""
        secrets = self.secrets.get_secrets(self.source_id)
        pkce_data = secrets.get("oauth_pkce") if secrets else None

        if not pkce_data:
            return None

        # 验证过期 (例如 10 分钟)
        if time.time() - pkce_data.get("created_at", 0) > 600:
            logger.warning(f"[{self.source_id}] PKCE Verifier 已过期")
            return None

        # 获取后清除 oauth_pkce，防止重放
        self.secrets.delete_secret(self.source_id, "oauth_pkce")
        return pkce_data.get("verifier")

    # ── Token 刷新 ────────────────────────────────────

    def _is_expired(self) -> bool:
        """检查 Token 是否过期。"""
        if not self._token_data:
            return True
            
        # 如果没有 expires_at 且没有 expires_in，假设不过期 (如长期 Key)
        if "expires_at" not in self._token_data:
            return False
            
        expires_at = self._token_data.get("expires_at", 0)
        return time.time() >= expires_at - 60  # 提前 60 秒刷新

    async def _refresh_token(self):
        """使用 refresh_token 刷新 access_token。"""
        if not self._token_data:
             return

        refresh_token = self._token_data.get(OAuthParams.REFRESH_TOKEN)
        if not refresh_token:
            logger.warning(f"[{self.source_id}] Token 已过期且无 refresh_token")
            # 不抛出异常，让上层处理重新授权
            return

        # 获取凭据
        client_id, client_secret = self._get_client_credentials()

        async with httpx.AsyncClient() as client:
            # 准备参数
            data = {
                OAuthParams.GRANT_TYPE: GrantType.REFRESH_TOKEN.value,
                OAuthParams.REFRESH_TOKEN: refresh_token,
            }
            if client_id:
                data[OAuthParams.CLIENT_ID] = client_id
            if client_secret:
                data[OAuthParams.CLIENT_SECRET] = client_secret

            try:
                if self.config.token_request_type == "json":
                    resp = await client.post(self.config.token_url, json=data)
                else:
                    resp = await client.post(self.config.token_url, data=data)

                resp.raise_for_status()
                new_token = resp.json()

                # 合并旧数据
                merged_token = self._token_data.copy()
                merged_token.update(new_token)

                self._save_token(merged_token)
                logger.info(f"[{self.source_id}] Token 已刷新")

            except Exception as e:
                logger.error(f"[{self.source_id}] 刷新 token 失败: {e}")
                # 可能需要重新授权

    # ── 授权流程 (Client-Side Driven) ────────────────

    def _get_client_credentials(self) -> tuple[str | None, str | None]:
        """
        获取客户端凭据。
        优先从配置获取，其次从 Secrets 获取。
        """
        client_id = self.config.client_id
        client_secret = self.config.client_secret

        # 如果配置中没有，从 Secrets 中获取
        if not client_id or not client_secret:
            secrets = self.secrets.get_secrets(self.source_id)
            if secrets:
                if not client_id:
                    client_id = secrets.get(OAuthParams.CLIENT_ID) or secrets.get("client_id")
                if not client_secret:
                    client_secret = secrets.get(OAuthParams.CLIENT_SECRET) or secrets.get("client_secret")

        return client_id, client_secret

    def get_authorize_url(self, redirect_uri: Optional[str] = None) -> str:
        """
        生成 OAuth 授权 URL。
        根据 supports_pkce 配置决定是否使用 PKCE。

        对于公共客户端，回调地址由前端动态决定（当前前端域名 + /oauth/callback）。
        这样无论客户端部署在哪里，OAuth 回调都能正确返回。

        Returns:
            str: 授权 URL

        Raises:
            ValueError: 如果缺少必要的 client_id
        """
        # 0. 获取凭据
        client_id, _ = self._get_client_credentials()

        # 1. 确定 Redirect URI - 优先使用前端传递的地址，其次使用配置中的默认值
        if not redirect_uri:
            redirect_uri = self.config.redirect_uri
        if not redirect_uri:
            raise ValueError(f"[{self.source_id}] OAuth 授权需要回调地址 (redirect_uri)")
        final_redirect_uri = redirect_uri

        # 2. 生成 PKCE (仅当 supports_pkce 为 True)
        verifier = None
        if self.config.supports_pkce:
            verifier = PKCEUtils.generate_verifier()
            challenge = PKCEUtils.generate_challenge(verifier, CodeChallengeMethod(self.config.code_challenge_method))

            # 3. 保存状态 (Verifier)
            # 简单起见使用 source_id 作为 state，增强安全性可使用随机串并映射
            state = self.source_id
            self._save_pkce_state(verifier, state)

        # 4. 构建参数
        params = {}

        # 添加 PKCE 参数 (仅当 supports_pkce 为 True)
        if self.config.supports_pkce and verifier:
            params[OAuthParams.CODE_CHALLENGE] = challenge
            params[OAuthParams.CODE_CHALLENGE_METHOD] = self.config.code_challenge_method

        # 添加 client_id (某些 OAuth Provider 需要)
        if client_id:
            params[OAuthParams.CLIENT_ID] = client_id

        # 添加 response_type (标准 OAuth 参数)
        params[OAuthParams.RESPONSE_TYPE] = ResponseType.CODE.value

        # 处理参数重命名 (如 OpenRouter callback_url)
        # 注意: 某些 Provider (如 OpenRouter) 可能要求 key 为 callback_url
        redirect_key = self.config.redirect_param or OAuthParams.REDIRECT_URI
        params[redirect_key] = final_redirect_uri

        if self.config.scopes:
            params[OAuthParams.SCOPE] = " ".join(self.config.scopes)

        # 添加 state 参数
        state = self.source_id
        params[OAuthParams.STATE] = state

        return f"{self.config.auth_url}?{urlencode(params)}"

    async def exchange_code(self, code: str, redirect_uri: Optional[str] = None):
        """
        用授权码交换 Token。
        根据 supports_pkce 配置决定是否使用 PKCE。

        通常由前端回调后调用此接口。

        OpenRouter OAuth 流程需要 (PKCE):
        - code: 授权码
        - code_verifier: PKCE verifier
        - code_challenge_method: S256 (必须与授权时一致)

        注意: OpenRouter 不需要 redirect_uri 在 token 交换中。
        """
        # 1. 获取并验证 Verifier (仅当 supports_pkce 为 True)
        verifier = None
        if self.config.supports_pkce:
            verifier = self._get_pkce_verifier()
            # 注意：如果 verifier 丢失，可能是过期或被清除。
            if not verifier:
                logger.warning(f"[{self.source_id}] PKCE Verifier 丢失或过期")

        # 2. 获取凭据
        client_id, client_secret = self._get_client_credentials()

        # 3. 准备请求参数
        data = {
            OAuthParams.CODE: code,
            OAuthParams.GRANT_TYPE: GrantType.AUTHORIZATION_CODE.value,
        }

        # 添加 redirect_uri (某些 Provider 需要，如 HuggingFace)
        if redirect_uri:
            redirect_key = self.config.redirect_param or OAuthParams.REDIRECT_URI
            data[redirect_key] = redirect_uri

        # 添加 PKCE 参数 (仅当 supports_pkce 为 True)
        if self.config.supports_pkce:
            data["code_challenge_method"] = self.config.code_challenge_method
            if verifier:
                data[OAuthParams.CODE_VERIFIER] = verifier

        # 补充 Client Info
        if client_id:
            data[OAuthParams.CLIENT_ID] = client_id
        if client_secret:
            data[OAuthParams.CLIENT_SECRET] = client_secret

        # 4. 发送请求
        async with httpx.AsyncClient() as client:
            logger.info(f"[{self.source_id}] Exchanging code for token at {self.config.token_url}")
            logger.info(f"[{self.source_id}] Token request data: {data}")
            try:
                if self.config.token_request_type == "json":
                    # OpenRouter: JSON body
                    resp = await client.post(self.config.token_url, json=data)
                else:
                    # Standard: Form Data
                    resp = await client.post(self.config.token_url, data=data)

                resp.raise_for_status()
                token_data = resp.json()

                self._save_token(token_data)

            except httpx.HTTPStatusError as e:
                logger.error(f"[{self.source_id}] Token 交换失败: {e.response.text}")
                raise

    # ── 应用到客户端 ──────────────────────────────────

    async def ensure_valid_token(self):
        """确保 Token 有效，必要时刷新。"""
        if self._is_expired():
            await self._refresh_token()

    def apply(self, client: httpx.AsyncClient) -> httpx.AsyncClient:
        """将 access_token 注入到 httpx 客户端 Header。"""
        if self._token_data and OAuthParams.ACCESS_TOKEN in self._token_data:
            token = self._token_data[OAuthParams.ACCESS_TOKEN]
            client.headers["Authorization"] = f"Bearer {token}"
        return client

    @property
    def has_token(self) -> bool:
        return self._token_data is not None and OAuthParams.ACCESS_TOKEN in self._token_data
