import os


class Config:
    """Application configuration settings."""

    # Default database path
    DEFAULT_DB_DIR = os.path.join(os.path.expanduser("~"), "sqlite_viewer_dbs")

    # Allowed file extensions
    ALLOWED_EXTENSIONS = {"db", "sqlite", "sqlite3"}

    # Ollama configuration
    OLLAMA_BASE_URL = "http://localhost:11434"  # Default Ollama URL
    OLLAMA_MODEL = "llama2"  # Default model to use for SQL generation

    @staticmethod
    def init_app(app):
        """Initialize the Flask application with configuration."""
        # Create default directory if it doesn't exist
        os.makedirs(Config.DEFAULT_DB_DIR, exist_ok=True)
