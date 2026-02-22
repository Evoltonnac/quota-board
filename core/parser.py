"""
数据解析器：支持 JSONPath / CSS Selector / Regex / 自定义脚本 四种模式。
将 HTTP 响应解析为结构化的 dict。
"""

import importlib.util
import logging
import re
from typing import Any

from core.config_loader import FieldMapping, ParserConfig, ParserType

logger = logging.getLogger(__name__)


def _cast_value(value: Any, type_hint: str) -> Any:
    """将提取的值按类型转换。"""
    if value is None:
        return None
    try:
        if type_hint == "int":
            return int(float(str(value)))
        elif type_hint == "float":
            return float(str(value))
        elif type_hint == "bool":
            return str(value).lower() in ("true", "1", "yes")
        elif type_hint in ("object", "json", "list", "dict"):
            return value
        return str(value)
    except (ValueError, TypeError):
        logger.warning(f"类型转换失败: {value!r} -> {type_hint}")
        return value


# ── JSONPath 解析 ─────────────────────────────────────

def _parse_jsonpath(data: dict | list, fields: list[FieldMapping]) -> dict[str, Any]:
    from jsonpath_ng.ext import parse as jp_parse

    result = {}
    for field in fields:
        try:
            expr = jp_parse(field.expr)
            matches = expr.find(data)
            if matches:
                raw = matches[0].value
                result[field.name] = _cast_value(raw, field.type)
            else:
                result[field.name] = None
                logger.debug(f"JSONPath '{field.expr}' 无匹配")
        except Exception as e:
            logger.warning(f"JSONPath 解析错误 [{field.name}]: {e}")
            result[field.name] = None
    return result


# ── CSS Selector 解析 ─────────────────────────────────

def _parse_css(html: str, fields: list[FieldMapping]) -> dict[str, Any]:
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "lxml")
    result = {}
    for field in fields:
        try:
            elements = soup.select(field.expr)
            if elements:
                raw = elements[0].get_text(strip=True)
                result[field.name] = _cast_value(raw, field.type)
            else:
                result[field.name] = None
                logger.debug(f"CSS Selector '{field.expr}' 无匹配")
        except Exception as e:
            logger.warning(f"CSS 解析错误 [{field.name}]: {e}")
            result[field.name] = None
    return result


# ── Regex 解析 ────────────────────────────────────────

def _parse_regex(text: str, fields: list[FieldMapping]) -> dict[str, Any]:
    result = {}
    for field in fields:
        try:
            match = re.search(field.expr, text)
            if match:
                # 优先取命名组，其次取第一个组，最后取整个匹配
                raw = match.group(field.name) if field.name in (match.groupdict() or {}) else (
                    match.group(1) if match.lastindex else match.group(0)
                )
                result[field.name] = _cast_value(raw, field.type)
            else:
                result[field.name] = None
                logger.debug(f"Regex '{field.expr}' 无匹配")
        except Exception as e:
            logger.warning(f"Regex 解析错误 [{field.name}]: {e}")
            result[field.name] = None
    return result


# ── Script 解析 ───────────────────────────────────────

def _parse_script(response_text: str, script_path: str) -> dict[str, Any]:
    """
    执行自定义 Python 脚本进行解析。
    脚本需要定义 parse(response_text: str) -> dict 函数。
    """
    try:
        spec = importlib.util.spec_from_file_location("custom_parser", script_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        if not hasattr(module, "parse"):
            raise AttributeError(f"脚本 {script_path} 缺少 parse() 函数")

        return module.parse(response_text)
    except Exception as e:
        logger.error(f"脚本解析错误 [{script_path}]: {e}")
        return {"_error": str(e)}


# ── 统一解析入口 ──────────────────────────────────────

def parse_response(
    response_text: str,
    response_json: dict | list | None,
    parser_config: ParserConfig,
) -> dict[str, Any]:
    """
    统一解析入口。

    Args:
        response_text: HTTP 响应原文
        response_json: 尝试 JSON 解析后的数据（可能为 None）
        parser_config: 解析配置
    Returns:
        解析后的字段字典
    """
    ptype = parser_config.type

    if ptype == ParserType.JSONPATH:
        if response_json is None:
            logger.error("JSONPath 模式需要 JSON 响应，但解析失败")
            return {"_error": "Response is not valid JSON"}
        return _parse_jsonpath(response_json, parser_config.fields)

    elif ptype == ParserType.CSS:
        return _parse_css(response_text, parser_config.fields)

    elif ptype == ParserType.REGEX:
        return _parse_regex(response_text, parser_config.fields)

    elif ptype == ParserType.SCRIPT:
        if not parser_config.script:
            return {"_error": "Script 模式未指定脚本路径"}
        return _parse_script(response_text, parser_config.script)

    else:
        return {"_error": f"未知的解析类型: {ptype}"}
