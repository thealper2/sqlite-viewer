import logging
import requests
from typing import Optional


class AIIntegration:
    """
    Handles integration with Ollama for SQL generation.
    """

    def __init__(self, base_url: str = None, model: str = None):
        """
        Initialize the AI integration.

        Args:
            base_url (str): Base URL for Ollama API
            model (str): Model to use for SQL generation
        """
        self.base_url = base_url or "http://localhost:11434"
        self.model = model or "llama2"

    def generate_sql(self, prompt: str, schema: Optional[str] = None) -> Optional[str]:
        """
        Generate SQL from natural language using Ollama.

        Args:
            prompt (str): Natural language prompt describing the desired SQL
            schema (Optional[str]): Optional database schema to provide context

        Returns:
            Optional[str]: Generated SQL query or None if failed
        """
        full_prompt = self._build_prompt(prompt, schema)

        try:
            response = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": full_prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3  # Lower temperature for more deterministic output
                    },
                },
                timeout=30,
            )

            if response.status_code == 200:
                result = response.json()
                return self._extract_sql(result.get("response", ""))
            else:
                logging.error(
                    f"Ollama API error: {response.status_code} - {response.text}"
                )
                return None

        except requests.exceptions.RequestException as e:
            logging.error(f"Request to Ollama failed: {e}")
            return None

    def _build_prompt(self, prompt: str, schema: Optional[str]) -> str:
        """
        Build the full prompt for SQL generation.
        """
        system_message = (
            "You are an export SQL developer. Your task is to generate SQLite-compatible SQL queries "
            "based on natural language descriptions. Always respond with only the SQL query, nothing else."
        )

        if schema:
            return (
                f"{system_message}\n\n"
                f"Database schema:\n{schema}\n\n"
                f"User request: {prompt}\n\n"
                "SQL Query:"
            )

        return f"{system_message}\n\nUser request: {prompt}\n\nSQL Query:"

    def _extract_sql(self, response: str) -> str:
        """
        Extract the SQL query from the AI response.
        """
        # Remove markdown code blocks if present
        if "```sql" in response:
            response = response.split("```sql")[1].split("```")[0]
        elif "```" in response:
            response = response.split("```")[1].split("```")[0]

        # Remove any explanatory text
        lines = response.split("\n")
        sql_lines = [
            line for line in lines if not line.strip().startswith("--") and line.strip()
        ]
        return "\n".join(sql_lines).strip()
