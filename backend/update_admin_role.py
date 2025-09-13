import os
import pg8000.dbapi
from dotenv import load_dotenv
from pathlib import Path
import re

def get_db_connection():
    dotenv_path = Path(__file__).resolve().parent / '.env'
    load_dotenv(dotenv_path=dotenv_path)
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL not found in .env file.")
    match = re.match(r"postgresql://(.*?):(.*?)@(.*?):(.*?)/(.*)", database_url)
    if not match:
        raise ValueError("Invalid DATABASE_URL format.")
    user, password, host, port, database = match.groups()
    return pg8000.dbapi.connect(
        user=user, password=password, host=host, port=int(port), database=database
    )

def update_admin_role():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    admin_email = os.getenv('ADMIN_EMAIL', 'admin@local.com')
    
    try:
        # Update admin user to have SEC role
        cursor.execute(
            "UPDATE users SET role = 'SEC' WHERE email = %s",
            (admin_email,)
        )
        
        conn.commit()
        
        # Verify the change
        cursor.execute("SELECT id, full_name, email, role FROM users WHERE email = %s", (admin_email,))
        user = cursor.fetchone()
        
        if user:
            print(f"Updated user {user[1]} ({user[2]}) to role {user[3]}")
        else:
            print(f"User with email {admin_email} not found")
            
    except Exception as e:
        conn.rollback()
        print(f"Error updating admin role: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    update_admin_role()
