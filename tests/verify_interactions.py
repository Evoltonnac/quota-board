import asyncio
import sys
import os
from unittest.mock import MagicMock

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.source_state import SourceState, SourceStatus, InteractionType
from core.executor import Executor
from core.config_loader import SourceConfig, AuthConfig, AuthType, RequestConfig, ParserConfig

async def test_api_key_interaction():
    print("--- Testing API Key Missing Interaction ---")
    
    # Mock dependencies
    data_controller = MagicMock()
    secrets_controller = MagicMock()
    secrets_controller.get_secret.return_value = None # Simulate missing key
    
    executor = Executor(data_controller, secrets_controller)
    
    # Config with API Key Auth
    source = SourceConfig(
        id="test_source",
        name="Test Source",
        description="Test",
        enabled=True,
        auth=AuthConfig(
            type=AuthType.API_KEY
        ),
        request=RequestConfig(url="http://example.com"),
        parser=ParserConfig()
    )
    
    # Run fetch
    await executor.fetch_source(source)
    
    # Verify State
    state = executor.get_source_state("test_source")
    print(f"Status: {state.status}")
    print(f"Message: {state.message}")
    
    if state.status == SourceStatus.SUSPENDED and state.interaction:
        print(f"Interaction Type: {state.interaction.type}")
        print(f"Source ID: {state.interaction.source_id}")
        if state.interaction.type == InteractionType.INPUT_TEXT and state.interaction.source_id == "test_source":
             print("PASS: Correct interaction generated.")
        else:
             print("FAIL: Incorrect interaction.")
    else:
        print("FAIL: Source should be suspended.")

async def test_oauth_interaction():
    print("\n--- Testing OAuth Missing Interaction ---")
    
    # Mock dependencies
    data_controller = MagicMock()
    secrets_controller = MagicMock()
    secrets_controller.get_secret.return_value = None # Simulate missing token
    
    executor = Executor(data_controller, secrets_controller)
    
    # Config with OAuth
    source = SourceConfig(
        id="test_oauth_source",
        name="Test OAuth Source",
        description="Test",
        enabled=True,
        auth=AuthConfig(
            type=AuthType.OAUTH
        ),
        request=RequestConfig(url="http://example.com"),
        parser=ParserConfig()
    )
    
    # Run fetch
    await executor.fetch_source(source)
    
    # Verify State
    state = executor.get_source_state("test_oauth_source")
    print(f"Status: {state.status}")
    
    if state.status == SourceStatus.SUSPENDED and state.interaction:
        print(f"Interaction Type: {state.interaction.type}")
        if state.interaction.type == InteractionType.OAUTH_START:
             print("PASS: Correct OAuth interaction generated.")
        else:
             print("FAIL: Incorrect interaction.")
    else:
        print("FAIL: Source should be suspended.")

if __name__ == "__main__":
    asyncio.run(test_api_key_interaction())
    asyncio.run(test_oauth_interaction())
