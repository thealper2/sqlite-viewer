document.addEventListener('DOMContentLoaded', function () {
    // Initialize Bootstrap tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Event listeners for database operations
    document.getElementById('openDbBtn').addEventListener('click', openDatabase);
    document.getElementById('createDbBtn').addEventListener('click', createDatabase);
    document.getElementById('executeQuery').addEventListener('click', executeQuery);
    document.getElementById('generateQueryBtn').addEventListener('click', showGenerateSqlModal);
    document.getElementById('generateSqlBtn').addEventListener('click', generateSql);
    document.getElementById('addColumnBtn').addEventListener('click', addColumnToForm);
    document.getElementById('createTableBtn').addEventListener('click', createTable);
    document.getElementById('addIndexColumnBtn').addEventListener('click', addIndexColumnToForm);
    document.getElementById('createIndexBtn').addEventListener('click', createIndex);

    // Load indexes if we have tables
    if (document.getElementById('tablesList').children.length > 0) {
        loadIndexes();
    }

    // Table view event delegation
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('view-table')) {
            const tableName = e.target.dataset.table;
            viewTable(tableName);
        } else if (e.target.classList.contains('drop-table')) {
            const tableName = e.target.dataset.table;
            dropTable(tableName);
        } else if (e.target.classList.contains('drop-index')) {
            const indexName = e.target.dataset.index;
            dropIndex(indexName);
        } else if (e.target.classList.contains('remove-column')) {
            e.target.closest('.column-row').remove();
        } else if (e.target.classList.contains('remove-index-column')) {
            e.target.closest('.index-column-row').remove();
        } else if (e.target.classList.contains('edit-row')) {
            const rowId = e.target.dataset.rowId;
            editRow(rowId);
        } else if (e.target.classList.contains('delete-row')) {
            const rowId = e.target.dataset.rowId;
            deleteRow(rowId);
        } else if (e.target.classList.contains('export-table')) {
            const format = e.target.dataset.format;
            const tableName = e.target.dataset.table;
            exportTable(tableName, format);
        }
    });

    // Handle table selection from sidebar
    document.getElementById('tablesList').addEventListener('click', function (e) {
        const tableItem = e.target.closest('.table-item');
        if (tableItem) {
            const tableName = tableItem.dataset.table;
            viewTable(tableName);
            // Switch to table view tab
            const tableTab = new bootstrap.Tab(document.getElementById('table-tab'));
            tableTab.show();
        }
    });

    // Update index columns when table changes
    document.getElementById('indexTable').addEventListener('change', function () {
        updateIndexColumns(this.value);
    });
});

function openDatabase() {
    const formData = new FormData(document.getElementById('openDbForm'));

    fetch('/open_db', {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }

            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('openDbModal'));
            modal.hide();

            // Update the UI
            updateDatabaseUI(data.db_path, data.tables);
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to open database');
        });
}

function createDatabase() {
    const dbName = document.getElementById('dbName').value.trim();

    fetch('/create_db', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `db_name=${encodeURIComponent(dbName)}`
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }

            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('createDbModal'));
            modal.hide();

            // Update the UI
            updateDatabaseUI(data.db_path, data.tables);
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to create database');
        });
}

function updateDatabaseUI(dbPath, tables) {
    // Update the navbar
    const dbPathElement = document.querySelector('.navbar-text strong');
    if (dbPathElement) {
        dbPathElement.textContent = dbPath;
    }

    // Update tables list
    const tablesList = document.getElementById('tablesList');
    tablesList.innerHTML = '';

    tables.forEach(table => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center table-item';
        li.dataset.table = table;
        li.innerHTML = `
            ${table}
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-primary view-table" data-table="${table}">View</button>
                <button class="btn btn-outline-danger drop-table" data-table="${table}">Drop</button>
            </div>
        `;
        tablesList.appendChild(li);
    });

    // Load indexes
    loadIndexes();

    // Update index table dropdown
    const indexTableSelect = document.getElementById('indexTable');
    indexTableSelect.innerHTML = '';
    tables.forEach(table => {
        const option = document.createElement('option');
        option.value = table;
        option.textContent = table;
        indexTableSelect.appendChild(option);
    });
}

function viewTable(tableName) {
    currentTable = tableName;

    fetch(`/table/${tableName}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }

            currentTableColumns = data.columns;
            currentTableData = data.data;
            currentTableSchema = data.schema;

            renderTableView(data);
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to load table data');
        });
}

function renderTableView(data) {
    const tableViewContent = document.getElementById('tableViewContent');

    // Create table actions
    let actionsHtml = `
        <div class="d-flex justify-content-between mb-3">
            <div>
                <button class="btn btn-sm btn-success me-2" id="addRowBtn">
                    <i class="bi bi-plus-lg"></i> Add Row
                </button>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-secondary export-table" data-table="${currentTable}" data-format="csv">
                        Export CSV
                    </button>
                    <button class="btn btn-sm btn-outline-secondary export-table" data-table="${currentTable}" data-format="json">
                        Export JSON
                    </button>
                </div>
            </div>
            <button class="btn btn-sm btn-outline-primary" id="showSchemaBtn">
                Show Schema
            </button>
        </div>
    `;

    // Create table
    let tableHtml = `
        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead>
                    <tr>
                        ${data.columns.map(col => `<th>${col.name} <small class="text-muted">${col.type}</small></th>`).join('')}
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.data.map((row, rowIndex) => `
                        <tr>
                            ${data.columns.map(col => `<td>${row[col.name] !== null ? row[col.name] : '<span class="text-muted">NULL</span>'}</td>`).join('')}
                            <td>
                                <button class="btn btn-sm btn-outline-primary edit-row" data-row-id="${rowIndex}">Edit</button>
                                <button class="btn btn-sm btn-outline-danger delete-row" data-row-id="${rowIndex}">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    // Add schema viewer
    tableHtml += `
        <div class="card mt-3 d-none" id="schemaCard">
            <div class="card-header">
                Table Schema
                <button type="button" class="btn-close float-end" id="hideSchemaBtn"></button>
            </div>
            <div class="card-body">
                <pre><code class="language-sql">${data.schema}</code></pre>
            </div>
        </div>
    `;

    tableViewContent.innerHTML = actionsHtml + tableHtml;

    // Highlight SQL syntax in schema
    hljs.highlightAll();

    // Add event listeners for the new buttons
    document.getElementById('addRowBtn').addEventListener('click', showAddRowModal);
    document.getElementById('showSchemaBtn').addEventListener('click', function () {
        document.getElementById('schemaCard').classList.remove('d-none');
    });
    document.getElementById('hideSchemaBtn').addEventListener('click', function () {
        document.getElementById('schemaCard').classList.add('d-none');
    });
}

function executeQuery() {
    const query = document.getElementById('sqlQuery').value.trim();

    if (!query) {
        alert('Please enter a SQL query');
        return;
    }

    fetch('/execute_query', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `query=${encodeURIComponent(query)}`
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }

            renderQueryResults(data.results);
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to execute query');
        });
}

function renderQueryResults(results) {
    const resultsTable = document.getElementById('resultsTable');
    const thead = resultsTable.querySelector('thead');
    const tbody = resultsTable.querySelector('tbody');

    // Clear previous results
    thead.innerHTML = '';
    tbody.innerHTML = '';

    if (results.length === 0) {
        thead.innerHTML = '<tr><th>Query executed successfully (no results)</th></tr>';
        return;
    }

    // Create headers from the first result's keys
    const headers = Object.keys(results[0]);
    thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;

    // Add rows
    tbody.innerHTML = results.map(row =>
        `<tr>${headers.map(h => `<td>${row[h] !== null ? row[h] : '<span class="text-muted">NULL</span>'}</td>`).join('')}</tr>`
    ).join('');
}

function showGenerateSqlModal() {
    const modal = new bootstrap.Modal(document.getElementById('generateSqlModal'));
    modal.show();
}

function generateSql() {
    const prompt = document.getElementById('prompt').value.trim();
    const tableName = document.getElementById('tableForPrompt').value;

    if (!prompt) {
        alert('Please describe what you want to query');
        return;
    }

    fetch('/generate_sql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `prompt=${encodeURIComponent(prompt)}&table_name=${encodeURIComponent(tableName || '')}`
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }

            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('generateSqlModal'));
            modal.hide();

            // Set the generated query
            document.getElementById('sqlQuery').value = data.query;

            // Switch to query tab
            const queryTab = new bootstrap.Tab(document.getElementById('query-tab'));
            queryTab.show();
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to generate SQL');
        });
}

function addColumnToForm() {
    const container = document.getElementById('columnsContainer');
    const newRow = document.createElement('div');
    newRow.className = 'row mb-2 column-row';
    newRow.innerHTML = `
        <div class="col-md-5">
            <input type="text" class="form-control column-name" placeholder="Name" required>
        </div>
        <div class="col-md-5">
            <select class="form-select column-type">
                <option value="INTEGER">INTEGER</option>
                <option value="TEXT">TEXT</option>
                <option value="REAL">REAL</option>
                <option value="BLOB">BLOB</option>
                <option value="NUMERIC">NUMERIC</option>
            </select>
        </div>
        <div class="col-md-2">
            <button type="button" class="btn btn-danger btn-sm remove-column">×</button>
        </div>
    `;
    container.appendChild(newRow);
}

function createTable() {
    const tableName = document.getElementById('tableName').value.trim();
    const columnRows = document.querySelectorAll('.column-row');

    if (!tableName) {
        alert('Table name is required');
        return;
    }

    if (columnRows.length === 0) {
        alert('At least one column is required');
        return;
    }

    const columns = Array.from(columnRows).map(row => {
        return {
            name: row.querySelector('.column-name').value.trim(),
            type: row.querySelector('.column-type').value
        };
    });

    // Validate column names
    for (const col of columns) {
        if (!col.name) {
            alert('All columns must have a name');
            return;
        }
    }

    fetch('/structure', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `action=create_table&table_name=${encodeURIComponent(tableName)}&columns=${encodeURIComponent(JSON.stringify(columns))}`
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }

            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('createTableModal'));
            modal.hide();

            // Reset the form
            document.getElementById('createTableForm').reset();
            document.getElementById('columnsContainer').innerHTML = `
            <div class="row mb-2 column-row">
                <div class="col-md-5">
                    <input type="text" class="form-control column-name" placeholder="Name" required>
                </div>
                <div class="col-md-5">
                    <select class="form-select column-type">
                        <option value="INTEGER">INTEGER</option>
                        <option value="TEXT">TEXT</option>
                        <option value="REAL">REAL</option>
                        <option value="BLOB">BLOB</option>
                        <option value="NUMERIC">NUMERIC</option>
                    </select>
                </div>
                <div class="col-md-2">
                    <button type="button" class="btn btn-danger btn-sm remove-column">×</button>
                </div>
            </div>
        `;

            // Update the UI
            updateDatabaseUI(null, data.tables);
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to create table');
        });
}

function dropTable(tableName) {
    if (!confirm(`Are you sure you want to drop table "${tableName}"? This cannot be undone.`)) {
        return;
    }

    fetch('/structure', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `action=drop_table&table_name=${encodeURIComponent(tableName)}`
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }

            // Update the UI
            updateDatabaseUI(null, data.tables);

            // Clear table view if we're viewing this table
            if (currentTable === tableName) {
                document.getElementById('tableViewContent').innerHTML = '<div class="alert alert-info">Select a table to view its data</div>';
                currentTable = null;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to drop table');
        });
}

function loadIndexes() {
    fetch('/structure', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'action=get_indexes'
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error(data.error);
                return;
            }

            const indexesList = document.getElementById('indexesList');
            indexesList.innerHTML = '';

            if (data.indexes && data.indexes.length > 0) {
                data.indexes.forEach(index => {
                    const li = document.createElement('li');
                    li.className = 'list-group-item d-flex justify-content-between align-items-center';
                    li.innerHTML = `
                    <div>
                        <strong>${index.name}</strong> on ${index.table_name}
                        <div class="text-muted small">${index.sql}</div>
                    </div>
                    <button class="btn btn-outline-danger btn-sm drop-index" data-index="${index.name}">Drop</button>
                `;
                    indexesList.appendChild(li);
                });
            } else {
                indexesList.innerHTML = '<li class="list-group-item text-muted">No indexes found</li>';
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

function addIndexColumnToForm() {
    const container = document.getElementById('indexColumnsContainer');
    const newRow = document.createElement('div');
    newRow.className = 'row mb-2 index-column-row';
    newRow.innerHTML = `
        <div class="col-md-10">
            <select class="form-select index-column-name">
                <!-- Columns will be populated via JS -->
            </select>
        </div>
        <div class="col-md-2">
            <button type="button" class="btn btn-danger btn-sm remove-index-column">×</button>
        </div>
    `;
    container.appendChild(newRow);

    // Update the columns in this new select
    const tableName = document.getElementById('indexTable').value;
    if (tableName) {
        updateIndexColumns(tableName, newRow.querySelector('.index-column-name'));
    }
}

function updateIndexColumns(tableName, selectElement = null) {
    // If no specific select element provided, update all of them
    const selects = selectElement ?
        [selectElement] :
        document.querySelectorAll('.index-column-name');

    if (!tableName) {
        selects.forEach(select => {
            select.innerHTML = '<option value="">-- Select a table first --</option>';
        });
        return;
    }

    // Find the columns for this table
    const tableItem = document.querySelector(`.table-item[data-table="${tableName}"]`);
    if (!tableItem) return;

    // In a real app, we would fetch the columns from the server
    // For this demo, we'll just use the table name as a placeholder
    selects.forEach(select => {
        select.innerHTML = `
            <option value="id">id</option>
            <option value="name">name</option>
            <option value="created_at">created_at</option>
        `;
    });
}

function createIndex() {
    const indexName = document.getElementById('indexName').value.trim();
    const tableName = document.getElementById('indexTable').value;
    const unique = document.getElementById('uniqueIndex').checked;
    const columnRows = document.querySelectorAll('.index-column-row');

    if (!indexName) {
        alert('Index name is required');
        return;
    }

    if (!tableName) {
        alert('Table is required');
        return;
    }

    if (columnRows.length === 0) {
        alert('At least one column is required');
        return;
    }

    const columns = Array.from(columnRows).map(row => {
        return row.querySelector('.index-column-name').value;
    });

    // Validate columns
    for (const col of columns) {
        if (!col) {
            alert('All columns must be selected');
            return;
        }
    }

    fetch('/structure', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `action=create_index&index_name=${encodeURIComponent(indexName)}&table_name=${encodeURIComponent(tableName)}&columns=${encodeURIComponent(JSON.stringify(columns))}&unique=${unique}`
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }

            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('createIndexModal'));
            modal.hide();

            // Reset the form
            document.getElementById('createIndexForm').reset();
            document.getElementById('indexColumnsContainer').innerHTML = `
            <div class="row mb-2 index-column-row">
                <div class="col-md-10">
                    <select class="form-select index-column-name">
                        <!-- Columns will be populated via JS -->
                    </select>
                </div>
                <div class="col-md-2">
                    <button type="button" class="btn btn-danger btn-sm remove-index-column">×</button>
                </div>
            </div>
        `;

            // Update the indexes list
            loadIndexes();
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to create index');
        });
}

function dropIndex(indexName) {
    if (!confirm(`Are you sure you want to drop index "${indexName}"? This cannot be undone.`)) {
        return;
    }

    fetch('/structure', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `action=drop_index&index_name=${encodeURIComponent(indexName)}`
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }

            // Update the indexes list
            loadIndexes();
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to drop index');
        });
}

function showAddRowModal() {
    if (!currentTable) return;

    const form = document.getElementById('addRowForm');
    form.innerHTML = '';

    currentTableColumns.forEach(col => {
        if (col.pk === 1 && col.type.toUpperCase() === 'INTEGER') {
            // Skip auto-increment primary keys
            return;
        }

        const div = document.createElement('div');
        div.className = 'mb-3';
        div.innerHTML = `
            <label for="add-${col.name}" class="form-label">${col.name} <small class="text-muted">${col.type}</small></label>
            <input type="${getInputTypeForColumn(col.type)}" class="form-control" id="add-${col.name}" name="${col.name}">
        `;
        form.appendChild(div);
    });

    const modal = new bootstrap.Modal(document.getElementById('addRowModal'));
    modal.show();
}

function getInputTypeForColumn(columnType) {
    const type = columnType.toUpperCase();
    if (type.includes('INT')) return 'number';
    if (type.includes('REAL') || type.includes('FLOAT') || type.includes('DOUBLE')) return 'number';
    if (type.includes('DATE') || type.includes('TIME')) return 'datetime-local';
    if (type.includes('BOOL')) return 'checkbox';
    return 'text';
}

function editRow(rowIndex) {
    if (!currentTable || !currentTableData[rowIndex]) return;

    const row = currentTableData[rowIndex];
    const form = document.getElementById('editRowForm');
    form.innerHTML = '';

    // Create a hidden input to store the primary key condition
    let pkCondition = '';

    currentTableColumns.forEach(col => {
        const div = document.createElement('div');
        div.className = 'mb-3';

        // For primary keys, we'll use them in the WHERE condition but make them read-only
        if (col.pk === 1) {
            div.innerHTML = `
                <label for="edit-${col.name}" class="form-label">${col.name} <small class="text-muted">${col.type} (PRIMARY KEY)</small></label>
                <input type="${getInputTypeForColumn(col.type)}" class="form-control" id="edit-${col.name}" 
                       name="${col.name}" value="${row[col.name]}" readonly>
            `;
            pkCondition = `${col.name} = ${row[col.name]}`;
        } else {
            const value = row[col.name] !== null ? row[col.name] : '';
            div.innerHTML = `
                <label for="edit-${col.name}" class="form-label">${col.name} <small class="text-muted">${col.type}</small></label>
                <input type="${getInputTypeForColumn(col.type)}" class="form-control" id="edit-${col.name}" 
                       name="${col.name}" value="${value}">
            `;
        }

        form.appendChild(div);
    });

    // Store the condition as a data attribute
    form.dataset.condition = pkCondition;

    const modal = new bootstrap.Modal(document.getElementById('editRowModal'));
    modal.show();
}

function deleteRow(rowIndex) {
    if (!currentTable || !currentTableData[rowIndex]) return;

    if (!confirm('Are you sure you want to delete this row? This cannot be undone.')) {
        return;
    }

    // Find primary key column and value
    let condition = '';
    const params = [];

    currentTableColumns.forEach(col => {
        if (col.pk === 1) {
            condition = `${col.name} = ?`;
            params.push(currentTableData[rowIndex][col.name]);
        }
    });

    if (!condition) {
        alert('Cannot delete row - no primary key found');
        return;
    }

    fetch('/data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `action=delete&table_name=${encodeURIComponent(currentTable)}&condition=${encodeURIComponent(condition)}&params=${encodeURIComponent(JSON.stringify(params))}`
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }

            // Refresh the table view
            viewTable(currentTable);
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to delete row');
        });
}

function exportTable(tableName, format) {
    window.location.href = `/export/${format}/${tableName}`;
}