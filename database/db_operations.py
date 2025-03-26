import csv
import json
import logging
import sqlite3
from typing import List, Dict, Any, Tuple


class DBOperations:
    """
    Handles all SQLite database operations.
    """

    def __init__(self, db_path: str):
        """
        Initialize with a database path.

        Args:
            db_path (str): Path to the SQLite database file
        """
        self.db_path = db_path
        self.connection = None
        self.connect()

    def connect(self) -> None:
        """
        Establish a connection to the database.
        """
        try:
            self.connection = sqlite3.connect(self.db_path)
            self.connection.row_factory = sqlite3.Row  # Return rows as dictionaries

        except sqlite3.Error as e:
            logging.error(f"Database connection error: {e}")
            raise

    def close(self) -> None:
        """
        Close the database connection.
        """
        if self.connection:
            self.connection.close()

    def execute_query(self, query: str, params: tuple = ()) -> List[Dict[str, Any]]:
        """
        Execute a SQL query and return the results.

        Args:
            query (str): SQL query to execute
            params (tuple): Parameters for the query

        Returns:
            List[Dict[str, Any]]: List of rows as dictionaries
        """
        try:
            cursor = self.connection.cursor()
            cursor.execute(query, params)
            self.connection.commit()

            if query.strip().upper().startswith("SELECT"):
                return [dict(row) for row in cursor.fetchall()]

            return []

        except sqlite3.Error as e:
            logging.error(f"Query execution error: {e}")
            raise

    def get_tables(self) -> List[str]:
        """
        Get list of all tables in the database.
        """
        query = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
        tables = self.execute_query(query)
        return [table["name"] for table in tables]

    def get_table_schema(self, table_name: str) -> str:
        """
        Get the schema for a specific table.

        Args:
            table_name (str): Name of the table

        Returns:
            str: SQL schema definition
        """
        query = "SELECT sql FROM sqlite_master WHERE type='table' AND name=?;"
        result = self.execute_query(query, (table_name,))
        return result[0]["sql"] if result else ""

    def get_table_data(
        self, table_name: str, limit: int = 100, offset: int = 0
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Get data and column info for a specific table.

        Args:
            table_name (str): Name of the table
            limit (int): Maximum number of rows to return
            offset (int): Offset for pagination

        Returns:
            Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]: Tuple of (data rows, column information)
        """
        # Get column information
        cursor = self.connection.cursor()
        cursor.execute(f"PRAGMA table_info({table_name});")
        columns = [dict(row) for row in cursor.fetchall()]

        # Get data
        query = f"SELECT * FROM {table_name} LIMIT ? OFFSET ?;"
        data = self.execute_query(query, (limit, offset))

        return data, columns

    def get_indexes(self) -> List[Dict[str, Any]]:
        """
        Get all indexes in the database.
        """
        query = """
            SELECT name, tbl_name as table_name, sql
            FROM sqlite_master
            WHERE type='index' AMD name NOT LIKE 'sqlite_%';
        """
        return self.execute_query(query)

    def export_to_csv(self, table_name: str, output_path: str) -> None:
        """
        Export a table to CSV file.

        Args.
            table_name (str): Name of the table to export
            output_path (str): Path to save the CSV file
        """
        data, columns = self.get_table_data(table_name, limit=0)
        fieldnames = [col["name"] for col in columns]

        with open(output_path, "w", newline="", encoding="utf-8") as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(data)

    def export_to_json(self, table_name: str, output_path: str) -> None:
        """
        Export a table to JSON file.

        Args:
            table_name (str): Name of the table to export
            output_path (str): Path to save the JSON file
        """
        data, _ = self.get_table_data(table_name, limit=0)

        with open(output_path, "w", encoding="utf-8") as jsonfile:
            json.dump(data, jsonfile, indent=2)

    def create_table(self, table_name: str, columns: List[Dict[str, str]]) -> None:
        """
        Create a new table.

        Args:
            table_name (str): Name of the new table
            columns (List[Dict[str, str]]): List of column definitions (each with 'name' and 'type')
        """
        columns_def = ", ".join([f"{col['name']} {col['type']}" for col in columns])
        query = f"CREATE TABLE {table_name} ({columns_def});"
        self.execute_query(query)

    def add_column(self, table_name: str, column_name: str, column_type: str) -> None:
        """
        Add a column to an existing table.

        Args:
            table_name (str): Name of the table
            column_name (str): Name of the new column
            column_type (str): Data type of the new column
        """
        query = f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type};"
        self.execute_query(query)

    def create_index(
        self, index_name: str, table_name: str, columns: List[str], unique: bool = False
    ) -> None:
        """
        Create an index on a table.

        Args:
            index_name (str): Name of the index
            table_name (str): Name of the table
            columns (List[str]): List of columns to index
            unique (bool): Whether to create a unique index
        """
        unique_str = "UNIQUE" if unique else ""
        columns_str = ", ".join(columns)
        query = (
            f"CREATE {unique_str} INDEX {index_name} ON {table_name} ({columns_str});"
        )
        self.execute_query(query)

    def insert_row(self, table_name: str, data: Dict[str, Any]) -> None:
        """
        Insert a new row into a table.

        Args:
            table_name (str): Name of the table
            data (Dict[str, Any]): Dictionary of column-value pairs
        """
        columns = ", ".join(data.keys())
        placeholders = ", ".join(["?"] * len(data))
        query = f"INSERT INTO {table_name} ({columns}) VALUES ({placeholders});"
        self.execute_query(query, tuple(data.values()))

    def update_row(
        self, table_name: str, data: Dict[str, Any], condition: str, params: tuple = ()
    ) -> None:
        """
        Update rows in a table.

        Args:
            table_name (str): Name of the table
            data (Dict[str, Any]): Dictionary of column-value pairs to update
            condition (str): WHERE condition for the update
            params (tuple): Parameters for the condition
        """
        set_clause = ", ".join([f"{key} = ?" for key in data.keys()])
        query = f"UPDATE {table_name} SET {set_clause} WHERE {condition};"
        self.execute_query(query, tuple(data.values()) + params)

    def delete_rows(self, table_name: str, condition: str, params: tuple = ()) -> None:
        """
        Delete rows from a table.

        Args:
            table_name (str): Name of the table
            condition (str): WHERE condition for the deletion
            params (tuple): Parameters for the condition
        """
        query = f"DELETE FROM {table_name} WHERE {condition};"
        self.execute_query(query, params)

    def drop_table(self, table_name: str) -> None:
        """
        Drop a table from the database.
        """
        query = f"DROP TABLE {table_name};"
        self.execute_query(query)

    def drop_index(self, index_name: str) -> None:
        """
        Drop an index from the database.
        """
        query = f"DROP INDEX {index_name};"
        self.execute_query(query)
