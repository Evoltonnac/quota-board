"""
Quota Board 主入口：启动 FastAPI 后端服务。
"""

import asyncio
import copy
import logging
import sys
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config_loader import load_config, AppConfig, SourceConfig
from core.models import StoredSource
from core.data_controller import DataController
from core.secrets_controller import SecretsController
from core.executor import Executor
from core.auth.manager import AuthManager
from core.resource_manager import ResourceManager
from core.integration_manager import IntegrationManager
from core import api


def resolve_stored_source(stored: "StoredSource", config: AppConfig) -> SourceConfig | None:
    """将 StoredSource 解析为可执行的 SourceConfig。"""
    # 查找对应的集成配置
    integration = config.get_integration(stored.integration_id) if stored.integration_id else None

    if not integration:
        logger.warning(f"[{stored.id}] 集成 '{stored.integration_id}' 未找到")
        return None

    # 构建基础配置
    base = copy.deepcopy(integration.model_dump())
    base.pop("id", None)
    base.pop("templates", None)

    # 应用变量替换
    variables = stored.vars
    for k, v in base.items():
        if isinstance(v, str):
            try:
                base[k] = v.format(**variables)
            except (KeyError, IndexError):
                pass
        elif isinstance(v, dict):
            base[k] = {key: val.format(**variables) if isinstance(val, str) else val for key, val in v.items()}

    # 覆盖配置
    for key, val in stored.config.items():
        if key == "vars":
            continue
        base[key] = val

    # 添加必需字段
    base["id"] = stored.id
    base["name"] = stored.name

    return SourceConfig.model_validate(base)

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan 事件处理：启动时和关闭时的逻辑。"""

    # 启动时：自动刷新 JSON 存储的所有数据源
    executor = app.state.executor
    resource_manager = app.state.resource_manager
    config = app.state.config

    # 刷新 JSON 存储的数据源 (StoredSource)
    stored_sources = resource_manager.load_sources()
    if stored_sources:
        logger.info(f"启动时自动刷新 {len(stored_sources)} 个存储数据源...")
        for stored in stored_sources:
            try:
                # 将 StoredSource 解析为 SourceConfig
                resolved = resolve_stored_source(stored, config)
                if resolved:
                    await executor.fetch_source(resolved)
                else:
                    logger.warning(f"[{stored.id}] 无法解析 StoredSource，跳过刷新")
            except Exception as e:
                logger.error(f"[{stored.id}] 启动刷新失败: {e}")
    else:
        logger.info("没有存储的数据源，跳过启动刷新")

    yield  # 应用运行中

    # 关闭时：关闭数据库连接
    logger.info("正在关闭...")
    app.state.data_controller.close()


def create_app() -> FastAPI:
    """创建并配置 FastAPI 应用。"""
    app = FastAPI(
        title="Quota Board API",
        description="API for quota monitoring and data fetching",
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS 中间件
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── 初始化核心组件 ────────────────────────────────────────
    logger.info("正在加载配置...")
    config = load_config()
    logger.info(f"已加载 {len(config.integrations)} 个集成配置")

    # 数据持久化
    data_controller = DataController()

    # 敏感信息存储
    secrets_controller = SecretsController()

    # 鉴权管理器
    auth_manager = AuthManager(secrets_controller, app_config=config)

    # 执行器
    executor = Executor(data_controller, secrets_controller)

    # 资源管理器 (JSON-based storage)
    resource_manager = ResourceManager()

    # 集成管理器 (YAML 文件管理)
    integration_manager = IntegrationManager()

    # 注入依赖到 API 模块
    api.init_api(
        executor=executor,
        data_controller=data_controller,
        config=config,
        auth_manager=auth_manager,
        secrets_controller=secrets_controller,
        resource_manager=resource_manager,
        integration_manager=integration_manager,
    )

    # 注册 API 路由
    app.include_router(api.router)

    # 将组件存到 app.state，供 lifespan 访问
    app.state.config = config
    app.state.executor = executor
    app.state.data_controller = data_controller
    app.state.resource_manager = resource_manager

    return app


def main():
    """主入口。"""
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8400

    logger.info(f"🚀 启动 Quota Board 后端 (port={port})...")

    app = create_app()

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
