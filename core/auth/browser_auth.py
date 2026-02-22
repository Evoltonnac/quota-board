"""
Browser Cookie 鉴权策略：从本地浏览器读取 Cookie 注入到请求中。
利用 browser_cookie3 读取 Chrome / Edge / Firefox 的 Cookie 数据库。
"""

import logging

import httpx

from core.config_loader import AuthConfig

logger = logging.getLogger(__name__)


def _get_browser_cookies(browser_name: str, domain: str | None = None):
    """
    从指定浏览器读取 Cookie。

    Args:
        browser_name: chrome / edge / firefox
        domain: 可选，按域名过滤
    """
    import browser_cookie3

    browser_map = {
        "chrome": browser_cookie3.chrome,
        "edge": browser_cookie3.edge,
        "firefox": browser_cookie3.firefox,
    }

    loader = browser_map.get(browser_name.lower())
    if loader is None:
        raise ValueError(f"不支持的浏览器: {browser_name}，可选: {list(browser_map.keys())}")

    try:
        cj = loader(domain_name=domain or "")
        return cj
    except Exception as e:
        logger.warning(f"读取 {browser_name} Cookie 失败: {e}")
        raise


class BrowserAuth:
    """从本地浏览器复用登录态 Cookie。"""

    def __init__(self, auth_config: AuthConfig):
        self.browser = auth_config.browser
        self.domain = auth_config.domain

    def apply(self, client: httpx.AsyncClient) -> httpx.AsyncClient:
        """将浏览器 Cookie 注入到 httpx 客户端。"""
        cj = _get_browser_cookies(self.browser, self.domain)
        # 将 http.cookiejar 转为 httpx.Cookies
        cookies = httpx.Cookies()
        for cookie in cj:
            cookies.set(cookie.name, cookie.value, domain=cookie.domain, path=cookie.path)
        client.cookies = cookies
        return client
