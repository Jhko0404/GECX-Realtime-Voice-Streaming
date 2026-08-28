import os
from pydantic_settings import BaseSettings
import google.auth
import google.auth.transport.requests

class Settings(BaseSettings):
    PROJECT_ID: str = "your-gcp-project-id"
    LOCATION: str = "us"
    APP_ID: str = "your-gecx-app-id"
    DEPLOYMENT_ID: str = "default"
    REGION: str = "us-central1"
    SERVICE_NAME: str = "gecx-streaming-bff"
    GATEWAY_ID: str = "gecx-agent-gateway"
    TICKET_SECRET_KEY: str = "gecx-secret-super-secure-jwt-signing-key-32bytes-min"
    PORT: int = 8080
    LOG_LEVEL: str = "DEBUG"
    MOCK_GECX_ENDPOINT: str = ""  # If set, redirects upstream to mock server (e.g. ws://127.0.0.1:8765)

    @property
    def gecx_app_resource_path(self) -> str:
        return f"projects/{self.PROJECT_ID}/locations/{self.LOCATION}/apps/{self.APP_ID}"

    @property
    def gecx_deployment_resource_path(self) -> str:
        return f"{self.gecx_app_resource_path}/deployments/{self.DEPLOYMENT_ID}"

    @property
    def gecx_websocket_url(self) -> str:
        if self.MOCK_GECX_ENDPOINT:
            return self.MOCK_GECX_ENDPOINT
        return f"wss://ces.googleapis.com/ws/google.cloud.ces.v1.SessionService/BidiRunSession/locations/{self.LOCATION}"

    def get_gcp_access_token(self) -> str:
        """Retrieves a fresh GCP OAuth 2.0 access token via Application Default Credentials."""
        if self.MOCK_GECX_ENDPOINT:
            return "mock-access-token-local"
        try:
            credentials, _ = google.auth.default(
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
            request = google.auth.transport.requests.Request()
            credentials.refresh(request)
            return credentials.token or ""
        except Exception as e:
            # Fallback for local testing if ADC is not configured
            return os.environ.get("GCP_ACCESS_TOKEN", "")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
