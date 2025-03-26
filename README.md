# SQLite Viewer

A comprehensive SQLite database management tool built with Python and Flask, featuring AI-powered SQL generation via Ollama.

## :dart: Features

- **Database Management**:
  - Open existing SQLite databases
  - Create new databases
  - View all tables and indexes at a glance
- **Table Operations**:
  - Create and drop tables
  - Add columns to existing tables
  - View table schemas and data
- **Data Manipulation**:
  - Add, edit, and delete rows
  - Paginated table viewing
  - Export data to CSV or JSON
- **Index Management**:
  - Create and drop indexes
  - Support for unique indexes
- **AI Integration**:
  - Generate SQL queries from natural language
  - Context-aware with table schemas
  - Powered by Ollama (supports various LLM models)
- **User Interface**:
  - Clean, modern white-based interface
  - SQL syntax highlighting
  - Responsive design for all devices
  - Comprehensive error handling

## :hammer: Requirements

- Python 3.8+
- Flask
- SQLite3
- Ollama (for AI features - optional)

## :hammer_and_wrench: Installation

1. Clone the repository:

```bash
git clone https://github.com/thealper2/sqlite-viewer.git
cd sqlite-viewer
```

2. Create and activate a virtual environment:

```bash
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. (Optional) Set up Ollama:

- Download and install Ollama from ollama.ai
- Run Ollama in the background:

```bash
ollama serve
```

- Pull a model (e.g., llama3):

```bash
ollama pull llama3
```

## :joystick: Usage

Start the Flask application:

```bash
python app.py
```

1. Open your browser and navigate to:

```shell
http://localhost:5000
```

2. Use the interface to:

- Open or create a database
- Manage tables and indexes
- Edit data
- Generate SQL with AI

## :clipboard: Configuration

Edit `config.py` to customize:

- Default database directory
- Allowed file extensions
- Ollama settings (base URL and default model)

## :handshake: Contributing

If you wish to contribute, please follow these steps:

1. Fork this repository.
2. Create a new branch (git checkout -b feature/AmazingFeature).
3. Commit your changes (git commit -m 'Add some AmazingFeature').
4. Push your branch (git push origin feature/AmazingFeature).
5. Open a Pull Request.

## :scroll: License

This project is licensed under the MIT License - see the LICENSE file for details.