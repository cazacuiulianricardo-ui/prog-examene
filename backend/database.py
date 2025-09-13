import os
import pg8000.dbapi
from urllib.parse import urlparse

def get_db_connection():
    """Establishes a connection to the PostgreSQL database."""
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        raise ValueError("DATABASE_URL environment variable is not set.")

    # pg8000 doesn't parse the URL, so we do it manually
    result = urlparse(db_url)
    user = result.username
    password = result.password
    database = result.path[1:]
    hostname = result.hostname
    port = result.port

    conn = pg8000.dbapi.connect(
        user=user,
        password=password,
        host=hostname,
        port=port,
        database=database
    )
    return conn
