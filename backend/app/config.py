from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # LLM
    llm_provider: str = "openai"
    llm_model: str = "gpt-4o"
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    anthropic_api_key: str = ""

    # Sandbox / Docker
    sandbox_image: str = "cloud-agent-sandbox:latest"
    sandbox_network_disabled: bool = True
    sandbox_memory_limit: str = "2g"
    sandbox_cpu_quota: int = 50000
    sandbox_pids_limit: int = 256
    sandbox_max_exec_timeout: int = 60
    sandbox_workspace_base: str = ""  # resolved to absolute in lifespan

    # Agent
    agent_max_tool_iterations: int = 50
    agent_max_output_length: int = 50000

    # WebSocket
    ws_max_message_size: int = 1_048_576  # 1MB

    # DB
    database_url: str = "sqlite+aiosqlite:///./data/cloud_agent.db"

    # Auth (MVP no-auth, placeholder)
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"

    max_session_lifetime_hours: int = 24
    session_idle_timeout_minutes: int = 60

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
