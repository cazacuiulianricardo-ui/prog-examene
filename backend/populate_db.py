import os
import requests
import uuid
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash
from database import get_db_connection

load_dotenv()

TEACHERS_URL = "https://orar.usv.ro/orar/vizualizare/data/cadre.php?json"
ROOMS_URL = "https://orar.usv.ro/orar/vizualizare/data/sali.php?json"
TARGET_FACULTY = "Facultatea de Inginerie Electrică şi Ştiinţa Calculatoarelor"

def fetch_data(url):
    """Fetches JSON data from a given URL."""
    try:
        response = requests.get(url)
        response.raise_for_status()  # Raise an exception for bad status codes
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data from {url}: {e}")
        return None

def populate_teachers(conn):
    """Populates the users table with teachers from the specified faculty."""
    print("Fetching teacher data...")
    teachers_data = fetch_data(TEACHERS_URL)
    if not teachers_data:
        print("Could not fetch teacher data. Aborting teacher population.")
        return

    fiesc_teachers = [t for t in teachers_data if t.get('facultyName') == TARGET_FACULTY and t.get('emailAddress')]
    print(f"Found {len(fiesc_teachers)} teachers from {TARGET_FACULTY}.")

    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM roles WHERE name = 'CADRU_DIDACTIC'")
        role_result = cursor.fetchone()
        if not role_result:
            print("Role 'CADRU_DIDACTIC' not found. Please initialize the database first.")
            return
        teacher_role_id = role_result[0]

        default_password = "changeme"
        password_hash = generate_password_hash(default_password)

        for teacher in fiesc_teachers:
            email = teacher['emailAddress'].strip()
            full_name = f"{teacher['firstName']} {teacher['lastName']}".strip()

            cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
            if cursor.fetchone():
                print(f"User with email {email} already exists. Skipping.")
                continue

            user_id = uuid.uuid4()
            cursor.execute(
                """
                INSERT INTO users (id, full_name, email, password_hash, role_id)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (str(user_id), full_name, email, password_hash, teacher_role_id)
            )
            print(f"Added teacher: {full_name} ({email})")
        
        conn.commit()
        print("Finished populating teachers.")

    except Exception as e:
        conn.rollback()
        print(f"An error occurred during teacher population: {e}")
    finally:
        cursor.close()

def populate_rooms(conn):
    """Populates the rooms table with data from the URL."""
    print("Fetching room data...")
    rooms_data = fetch_data(ROOMS_URL)
    if not rooms_data:
        print("Could not fetch room data. Aborting room population.")
        return

    cursor = conn.cursor()
    try:
        for room in rooms_data:
            if not room.get('name') or room.get('name').isdigit():
                continue
            
            name = room['name'].strip()
            short_name = room.get('shortName', '').strip()
            building = room.get('buildingName', '').strip()
            capacity = int(room.get('capacitate', 0))

            cursor.execute("SELECT id FROM rooms WHERE name = %s AND building_name = %s", (name, building))
            if cursor.fetchone():
                print(f"Room {name} in building {building} already exists. Skipping.")
                continue

            cursor.execute(
                """
                INSERT INTO rooms (name, short_name, building_name, capacity)
                VALUES (%s, %s, %s, %s)
                """,
                (name, short_name, building, capacity)
            )
            print(f"Added room: {name} (Building: {building}, Capacity: {capacity})")

        conn.commit()
        print("Finished populating rooms.")

    except Exception as e:
        conn.rollback()
        print(f"An error occurred during room population: {e}")
    finally:
        cursor.close()

if __name__ == "__main__":
    connection = None
    try:
        connection = get_db_connection()
        print("Database connection successful. Starting population...")
        
        populate_teachers(connection)
        populate_rooms(connection)

        print("\nDatabase population script finished.")

    except Exception as e:
        print(f"A top-level error occurred: {e}")
    finally:
        if connection:
            connection.close()
            print("Database connection closed.")
