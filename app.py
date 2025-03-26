import os
import json
import logging
from flask import Flask, render_template, request, jsonify, send_from_directory
from typing import Optional
from werkzeug.utils import secure_filename

from config import Config
from database.db_operations import DBOperations
from database.ai_integration import AIIntegration

app = Flask(__name__)
app.config.from_object(Config)
Config.init_app(app)

# Global variable to store current database (for simplicity in this demo)
current_db: Optional[DBOperations] = None
ai_integration = AIIntegration(Config.OLLAMA_BASE_URL, Config.OLLAMA_MODEL)


@app.route("/")
def index():
    """Render the main interface."""
    return render_template(
        "index.html",
        db_path=getattr(current_db, "db_path", None) if current_db else None,
        tables=current_db.get_tables() if current_db else [],
    )


@app.route("/open_db", methods=["POST"])
def open_db():
    """Open an existing database file."""
    global current_db

    if "db_file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    db_file = request.files["db_file"]
    if db_file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    if not allowed_file(db_file.filename):
        return jsonify({"error": "Invalid file type"}), 400

    try:
        # Save the file temporarily
        filename = secure_filename(db_file.filename)
        save_path = os.path.join(Config.DEFAULT_DB_DIR, filename)
        db_file.save(save_path)

        # Initialize the database operations
        current_db = DBOperations(save_path)

        return jsonify(
            {"success": True, "db_path": save_path, "tables": current_db.get_tables()}
        )
    except Exception as e:
        logging.error(f"Error opening database: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/create_db", methods=["POST"])
def create_db():
    """Create a new database file."""
    global current_db

    db_name = request.form.get("db_name", "").strip()
    if not db_name:
        return jsonify({"error": "Database name is required"}), 400

    try:
        # Ensure the name has a valid extension
        if not any(db_name.lower().endswith(ext) for ext in Config.ALLOWED_EXTENSIONS):
            db_name += ".db"

        save_path = os.path.join(Config.DEFAULT_DB_DIR, db_name)

        # Create an empty database by connecting to it
        current_db = DBOperations(save_path)

        return jsonify(
            {"success": True, "db_path": save_path, "tables": current_db.get_tables()}
        )
    except Exception as e:
        logging.error(f"Error creating database: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/table/<table_name>")
def view_table(table_name):
    """View data and schema for a specific table."""
    if not current_db:
        return jsonify({"error": "No database open"}), 400

    try:
        limit = int(request.args.get("limit", 100))
        offset = int(request.args.get("offset", 0))

        data, columns = current_db.get_table_data(table_name, limit, offset)
        schema = current_db.get_table_schema(table_name)

        return jsonify(
            {
                "success": True,
                "table_name": table_name,
                "data": data,
                "columns": columns,
                "schema": schema,
            }
        )
    except Exception as e:
        logging.error(f"Error viewing table {table_name}: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/execute_query", methods=["POST"])
def execute_query():
    """Execute a SQL query and return results."""
    if not current_db:
        return jsonify({"error": "No database open"}), 400

    query = request.form.get("query", "").strip()
    if not query:
        return jsonify({"error": "Query is required"}), 400

    try:
        results = current_db.execute_query(query)
        return jsonify({"success": True, "results": results})
    except Exception as e:
        logging.error(f"Error executing query: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/generate_sql", methods=["POST"])
def generate_sql():
    """Generate SQL from natural language using AI."""
    if not current_db:
        return jsonify({"error": "No database open"}), 400

    prompt = request.form.get("prompt", "").strip()
    table_name = request.form.get("table_name", "").strip()

    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400

    try:
        schema = None
        if table_name:
            schema = current_db.get_table_schema(table_name)

        sql_query = ai_integration.generate_sql(prompt, schema)

        if not sql_query:
            return jsonify({"error": "Failed to generate SQL"}), 500

        return jsonify({"success": True, "query": sql_query})
    except Exception as e:
        logging.error(f"Error generating SQL: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/export/<format>/<table_name>")
def export_table(format, table_name):
    """Export a table to CSV or JSON."""
    if not current_db:
        return jsonify({"error": "No database open"}), 400

    try:
        export_dir = os.path.join(Config.DEFAULT_DB_DIR, "exports")
        os.makedirs(export_dir, exist_ok=True)

        output_filename = f"{table_name}.{format.lower()}"
        output_path = os.path.join(export_dir, output_filename)

        if format.lower() == "csv":
            current_db.export_to_csv(table_name, output_path)
        elif format.lower() == "json":
            current_db.export_to_json(table_name, output_path)
        else:
            return jsonify({"error": "Invalid export format"}), 400

        return send_from_directory(
            directory=export_dir, path=output_filename, as_attachment=True
        )
    except Exception as e:
        logging.error(f"Error exporting table {table_name}: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/structure", methods=["POST"])
def modify_structure():
    """Modify database structure (create/drop tables, columns, indexes)."""
    if not current_db:
        return jsonify({"error": "No database open"}), 400

    action = request.form.get("action")

    try:
        if action == "create_table":
            table_name = request.form.get("table_name")
            columns = json.loads(request.form.get("columns", "[]"))
            current_db.create_table(table_name, columns)

        elif action == "drop_table":
            table_name = request.form.get("table_name")
            current_db.drop_table(table_name)

        elif action == "add_column":
            table_name = request.form.get("table_name")
            column_name = request.form.get("column_name")
            column_type = request.form.get("column_type")
            current_db.add_column(table_name, column_name, column_type)

        elif action == "create_index":
            index_name = request.form.get("index_name")
            table_name = request.form.get("table_name")
            columns = json.loads(request.form.get("columns", "[]"))
            unique = request.form.get("unique", "false").lower() == "true"
            current_db.create_index(index_name, table_name, columns, unique)

        elif action == "drop_index":
            index_name = request.form.get("index_name")
            current_db.drop_index(index_name)

        else:
            return jsonify({"error": "Invalid action"}), 400

        return jsonify(
            {
                "success": True,
                "tables": current_db.get_tables(),
                "indexes": current_db.get_indexes(),
            }
        )
    except Exception as e:
        logging.error(f"Error modifying structure: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/data", methods=["POST"])
def modify_data():
    """Modify table data (insert, update, delete rows)."""
    if not current_db:
        return jsonify({"error": "No database open"}), 400

    action = request.form.get("action")
    table_name = request.form.get("table_name")

    try:
        if action == "insert":
            data = json.loads(request.form.get("data", "{}"))
            current_db.insert_row(table_name, data)

        elif action == "update":
            data = json.loads(request.form.get("data", "{}"))
            condition = request.form.get("condition")
            params = json.loads(request.form.get("params", "[]"))
            current_db.update_row(table_name, data, condition, tuple(params))

        elif action == "delete":
            condition = request.form.get("condition")
            params = json.loads(request.form.get("params", "[]"))
            current_db.delete_row(table_name, condition, tuple(params))

        else:
            return jsonify({"error": "Invalid action"}), 400

        return jsonify({"success": True})
    except Exception as e:
        logging.error(f"Error modifying data: {e}")
        return jsonify({"error": str(e)}), 500


def allowed_file(filename):
    """Check if the file has an allowed extension."""
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in Config.ALLOWED_EXTENSIONS
    )


if __name__ == "__main__":
    app.run(debug=True)
