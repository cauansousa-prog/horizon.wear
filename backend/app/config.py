from pathlib import Path
from functools import lru_cache
from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / '.env', env_file_encoding='utf-8', extra='ignore')
    supabase_url: str = ''
    supabase_anon_key: SecretStr = SecretStr('')
    supabase_service_role_key: SecretStr = SecretStr('')
    cors_origins: list[str] = []
    mercadopago_access_token: SecretStr = SecretStr('')
    mercadopago_public_key: str = ''
    mercadopago_webhook_secret: SecretStr = SecretStr('')
    public_base_url: str = ''
    shipping_flat_brl: float = 0.0

    @field_validator('shipping_flat_brl')
    @classmethod
    def shipping(cls, value):
        import math
        if not math.isfinite(value) or value < 0: raise ValueError('Frete inválido.')
        return round(value, 2)


    @field_validator('supabase_url')
    @classmethod
    def validate_url(cls, value):
        from urllib.parse import urlsplit
        value = value.rstrip('/')
        if value:
            parsed = urlsplit(value)
            if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment:
                raise ValueError('SUPABASE_URL deve ser a URL HTTPS base do projeto.')
        return value

    @field_validator('public_base_url')
    @classmethod
    def validate_public_url(cls, value):
        from urllib.parse import urlsplit
        value=value.rstrip('/')
        if value:
            parsed=urlsplit(value)
            if parsed.scheme!='https' or not parsed.hostname or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment:
                raise ValueError('PUBLIC_BASE_URL deve ser a origem HTTPS pública, sem caminho ou parâmetros.')
        return value

    @property
    def database_configured(self):
        return bool(self.supabase_url and self.supabase_anon_key.get_secret_value())


@lru_cache
def get_settings():
    return Settings()
