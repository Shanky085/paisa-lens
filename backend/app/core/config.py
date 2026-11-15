from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "PaisaLens API"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./paisa_lens.db"
    frontend_origin: str = "http://localhost:3000"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
