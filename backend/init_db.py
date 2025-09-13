import os
import pg8000.dbapi
from dotenv import load_dotenv
from pathlib import Path
import re
import requests
from werkzeug.security import generate_password_hash
import uuid

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

def populate_initial_data(conn):
    cursor = conn.cursor()
    print("Adding default admin user...")
    admin_email = os.getenv('ADMIN_EMAIL', 'admin@local.com')
    admin_password = os.getenv('ADMIN_PASSWORD', 'admin')
    hashed_password = generate_password_hash(admin_password)
    admin_id = str(uuid.uuid4())
    cursor.execute("SELECT id FROM users WHERE email = %s", (admin_email,))
    if cursor.fetchone() is None:
        cursor.execute(
            "INSERT INTO users (id, full_name, email, password_hash, role) VALUES (%s, %s, %s, %s, %s)",
            (admin_id, 'Admin User', admin_email, hashed_password, 'ADMIN')
        )
        print("Default admin user created.")
    else:
        print("Default admin user already exists.")

    try:
        # Part 1: Populate Teachers from FIESC
        print("Fetching teacher data...")
        teachers_url = "https://orar.usv.ro/orar/vizualizare/data/cadre.php?json"
        target_faculty = "Facultatea de Inginerie Electrică şi Ştiinţa Calculatoarelor"
        
        response = requests.get(teachers_url, timeout=30)
        response.raise_for_status()
        teachers_data = response.json()
        
        fiesc_teachers = [t for t in teachers_data if t.get('facultyName') == target_faculty and t.get('emailAddress')]
        print(f"Found {len(fiesc_teachers)} teachers from {target_faculty}.")

        for teacher in fiesc_teachers:
            email = teacher['emailAddress'].strip()
            full_name = f"{teacher['lastName']} {teacher['firstName']}".strip()

            cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
            if cursor.fetchone():
                print(f"User with email {email} already exists. Skipping.")
                continue

            teacher_id = str(uuid.uuid4())
            cursor.execute(
                "INSERT INTO users (id, full_name, email, role) VALUES (%s, %s, %s, %s)",
                (teacher_id, full_name, email, 'CADRU_DIDACTIC')
            )
            print(f"Added teacher: {full_name} ({email})")

    except (requests.exceptions.RequestException, ValueError) as e:
        print(f"Could not fetch or parse teacher data: {e}.")
        return # Stop if we can't get teachers

    # Part 2: Populate Disciplines and link to Teachers
    try:
        print("Fetching schedule data for disciplines...")
        schedule_url = "https://orar.usv.ro/orar/vizualizare/data/orarSPG.php?ID=1028&mod=grupa&json"
        response = requests.get(schedule_url, timeout=30)
        response.raise_for_status()
        api_response = response.json()

        if not (isinstance(api_response, list) and len(api_response) > 0 and isinstance(api_response[0], list)):
            print("Schedule API response is not in the expected format.")
        else:
            schedule_entries = api_response[0]
            print(f"Found {len(schedule_entries)} schedule entries.")

            discipline_teacher_map = {}
            for entry in schedule_entries:
                if isinstance(entry, dict):
                    discipline_name = entry.get('topicLongName', '').strip()
                    teacher_name = f"{entry.get('teacherLastName', '').strip()} {entry.get('teacherFirstName', '').strip()}"
                    if discipline_name and teacher_name:
                        if discipline_name not in discipline_teacher_map:
                            discipline_teacher_map[discipline_name] = set()
                        discipline_teacher_map[discipline_name].add(teacher_name)
            
            cursor.execute("SELECT id, full_name FROM users WHERE role = 'CADRU_DIDACTIC'")
            db_teachers = cursor.fetchall()
            teacher_name_to_id_map = {name: str(uid) for uid, name in db_teachers}

            disciplines_added_count = 0
            for discipline_name, teacher_names in discipline_teacher_map.items():
                cursor.execute("SELECT id FROM disciplines WHERE name = %s", (discipline_name,))
                discipline_row = cursor.fetchone()
                if not discipline_row:
                    cursor.execute("INSERT INTO disciplines (name) VALUES (%s) RETURNING id", (discipline_name,))
                    discipline_id = cursor.fetchone()[0]
                    disciplines_added_count += 1
                else:
                    discipline_id = discipline_row[0]
                
                for teacher_name in teacher_names:
                    teacher_id = teacher_name_to_id_map.get(teacher_name)
                    if teacher_id:
                        cursor.execute("SELECT 1 FROM discipline_teachers WHERE discipline_id = %s AND teacher_id = %s", (discipline_id, teacher_id))
                        if cursor.fetchone() is None:
                            cursor.execute("INSERT INTO discipline_teachers (discipline_id, teacher_id) VALUES (%s, %s)", (discipline_id, teacher_id))
            print(f"Added {disciplines_added_count} new disciplines and linked teachers.")

    except (requests.exceptions.RequestException, ValueError) as e:
        print(f"Could not fetch or parse schedule data: {e}.")

    # Part 3: Populate Rooms
    print("Populating rooms...")
    try:
        rooms_url = "https://orar.usv.ro/orar/vizualizare/data/sali.php?json"
        rooms_response = requests.get(rooms_url, timeout=30)
        rooms_response.raise_for_status()
        rooms_data = rooms_response.json()
        rooms_added = 0
        for room in rooms_data:
            if not room.get('name') or not room.get('capacitate') or int(room.get('capacitate', 0)) == 0:
                continue
            cursor.execute("SELECT id FROM rooms WHERE name = %s", (room.get('name'),))
            if cursor.fetchone() is None:
                cursor.execute("INSERT INTO rooms (name, short_name, building_name, capacity) VALUES (%s, %s, %s, %s)", (room.get('name'), room.get('shortName'), room.get('buildingName'), int(room.get('capacitate', 0))))
                rooms_added += 1
        print(f"Added {rooms_added} new rooms.")
    except (requests.exceptions.RequestException, ValueError, KeyError) as e:
        print(f"Could not fetch or parse rooms data: {e}.")

def main():
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        print("Database connection successful.")
        tables = [
            ('users', """
                id VARCHAR(255) PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255),
                role VARCHAR(50) NOT NULL DEFAULT 'STUDENT' CHECK (role IN ('STUDENT', 'CADRU_DIDACTIC', 'ADMIN', 'SEF_GRUPA', 'SEC')),
                student_group VARCHAR(50),
                year_of_study INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            """),
            ('rooms', """
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                short_name VARCHAR(50),
                building_name VARCHAR(100),
                capacity INTEGER NOT NULL
            """),
            ('disciplines', """
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                year_of_study INTEGER,
                specialization VARCHAR(255)
            """),
            ('discipline_teachers', """
                discipline_id INTEGER REFERENCES disciplines(id) ON DELETE CASCADE,
                teacher_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
                PRIMARY KEY (discipline_id, teacher_id)
            """),
            ('exams', """
                id SERIAL PRIMARY KEY,
                discipline_id INTEGER REFERENCES disciplines(id),
                exam_type VARCHAR(50) CHECK (exam_type IN ('EXAM', 'PROJECT')),
                student_group VARCHAR(50),
                main_teacher_id VARCHAR(255) REFERENCES users(id),
                second_teacher_id VARCHAR(255) REFERENCES users(id),
                status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PROPOSED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'RESCHEDULED', 'CONFIRMED')),
                exam_date TIMESTAMP,
                start_hour INTEGER CHECK (start_hour >= 8 AND start_hour <= 18),
                duration INTEGER DEFAULT 120,
                room_id INTEGER REFERENCES rooms(id),
                created_by VARCHAR(255) REFERENCES users(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            """),
            ('exam_periods', """
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                is_active BOOLEAN DEFAULT FALSE
            """)
        ]
        print("Dropping existing tables...")
        for table_name, _ in reversed(tables):
            cursor.execute(f"DROP TABLE IF EXISTS {table_name} CASCADE;")
        print("Creating tables...")
        for table_name, schema in tables:
            cursor.execute(f"CREATE TABLE {table_name} ({schema});")
        conn.commit()
        print("All tables created successfully.")
        populate_initial_data(conn)
        conn.commit()
        print("Database initialization complete.")
    except pg8000.dbapi.Error as e:
        print(f"Database error: {e}")
        if conn: conn.rollback()
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        if conn: conn.rollback()
    finally:
        if conn:
            conn.close()
            print("Database connection closed.")

if __name__ == '__main__':
    main()
