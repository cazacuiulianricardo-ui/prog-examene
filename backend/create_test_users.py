import os
import pg8000.dbapi
from dotenv import load_dotenv
from pathlib import Path
import re
import uuid
from werkzeug.security import generate_password_hash

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

def create_test_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Define test users with different roles
    test_users = [
        {
            "full_name": "SEC User",
            "email": "sec@local.com",
            "password": "password",
            "role": "SEC",
            "student_group": None,
            "year_of_study": None
        },
        {
            "full_name": "Teacher User",
            "email": "teacher@local.com",
            "password": "password",
            "role": "CADRU_DIDACTIC",
            "student_group": None,
            "year_of_study": None
        },
        {
            "full_name": "Group Leader",
            "email": "sg@local.com",
            "password": "password",
            "role": "SEF_GRUPA",
            "student_group": "3A",
            "year_of_study": 3
        },
        {
            "full_name": "Student User",
            "email": "student@local.com",
            "password": "password",
            "role": "STUDENT",
            "student_group": "3A",
            "year_of_study": 3
        }
    ]
    
    try:
        for user in test_users:
            # Check if user already exists
            cursor.execute("SELECT id FROM users WHERE email = %s", (user["email"],))
            if cursor.fetchone() is None:
                user_id = str(uuid.uuid4())
                hashed_password = generate_password_hash(user["password"])
                
                cursor.execute(
                    """
                    INSERT INTO users 
                    (id, full_name, email, password_hash, role, student_group, year_of_study) 
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        user_id, 
                        user["full_name"], 
                        user["email"], 
                        hashed_password, 
                        user["role"],
                        user["student_group"],
                        user["year_of_study"]
                    )
                )
                print(f"Created user: {user['full_name']} ({user['email']}) with role {user['role']}")
            else:
                print(f"User {user['email']} already exists. Skipping.")
        
        conn.commit()
        print("All test users created successfully.")
    except Exception as e:
        conn.rollback()
        print(f"Error creating test users: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    create_test_users()
