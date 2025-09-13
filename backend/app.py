import os
import datetime
import jwt
from flask import Flask, jsonify, request, g
from flask_cors import CORS
from dotenv import load_dotenv
from werkzeug.security import check_password_hash
from database import get_db_connection
from mock_data import MOCK_EXAMS, MOCK_USERS
from auth import token_required, admin_required, sec_required

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000", "supports_credentials": True}})
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your_default_secret_key')

# --- Database Check ---
def is_db_connected():
    try:
        conn = get_db_connection()
        conn.close()
        return True
    except Exception as e:
        print(f"Database connection failed: {e}")
        return False

DB_AVAILABLE = is_db_connected()
if not DB_AVAILABLE:
    print("WARNING: Database connection failed. Using mock data.")

# --- API Endpoints ---

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'message': 'Could not verify'}), 401, {'WWW-Authenticate': 'Basic realm="Login required!"'}

    username = data.get('username')
    password = data.get('password')

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, password_hash, role FROM users WHERE email = %s", (username,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if not user:
        return jsonify({'message': 'User not found'}), 401

    user_id, password_hash, role_name = user

    if role_name != 'ADMIN':
        return jsonify({'message': 'Login endpoint is for admins only'}), 403

    if password_hash and check_password_hash(password_hash, password):
        token = jwt.encode({
            'user_id': str(user_id),
            'role': role_name,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm="HS256")
        return jsonify({'token': token})

    return jsonify({'message': 'Invalid credentials'}), 401, {'WWW-Authenticate': 'Basic realm="Login required!"'}

@app.route('/api/auth/sync', methods=['POST'])
@token_required
def sync_user():
    user_id = g.current_user.get('id')
    email = g.current_user.get('email')
    full_name_from_token = (g.current_user.get('full_name') or '').strip()

    if not user_id or not email:
        return jsonify({"error": "Incomplete user information in token"}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT id, role, full_name, email, student_group, year_of_study FROM users WHERE id = %s", (user_id,))
        user_record = cursor.fetchone()

        if user_record:
            columns = [desc[0] for desc in cursor.description]
            user_data = dict(zip(columns, user_record))
            return jsonify(user_data), 200
        else:
            # User not in DB, create them
            # Special case for robertsoco0@gmail.com
            if email == 'robertsoco0@gmail.com':
                role_name = 'CADRU_DIDACTIC'
                print(f"Special case: {email} assigned role {role_name}")
            # Regular domain checks
            elif email.endswith('@student.usv.ro'):
                role_name = 'STUDENT'
            elif email.endswith('@usv.ro'):
                role_name = 'CADRU_DIDACTIC'
            else:
                print(f"Email domain not allowed: {email}")
                return jsonify({"error": "Cannot determine role for this email domain"}), 403

            full_name = full_name_from_token if full_name_from_token else email.split('@')[0].replace('.', ' ').title()

            cursor.execute(
                "INSERT INTO users (id, full_name, email, role) VALUES (%s, %s, %s, %s) RETURNING id, role, full_name, email, student_group, year_of_study",
                (user_id, full_name, email, role_name)
            )
            new_user_record = cursor.fetchone()
            conn.commit()
            
            columns = [desc[0] for desc in cursor.description]
            user_data = dict(zip(columns, new_user_record))
            return jsonify(user_data), 201

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error in sync_user: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()

@app.route('/api/user/details', methods=['PUT'])
@token_required
def update_user_details():
    user_id = g.current_user.get('id')
    data = request.get_json()
    student_group = data.get('student_group')
    year_of_study = data.get('year_of_study')

    # Validation
    if year_of_study is not None:
        try:
            year_of_study_int = int(year_of_study)
            if not (1 <= year_of_study_int <= 6):
                return jsonify({'message': 'Year of study must be between 1 and 6'}), 400
        except (ValueError, TypeError):
            return jsonify({'message': 'Invalid year of study format'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Check user role
        cursor.execute("SELECT role FROM users WHERE id = %s", (user_id,))
        role_res = cursor.fetchone()
        if not role_res or role_res[0] not in ['STUDENT', 'SEF_GRUPA']:
            return jsonify({'message': 'Permission denied'}), 403

        # Build update query dynamically
        query_parts = []
        params = []
        if 'student_group' in data:
            query_parts.append("student_group = %s")
            sg_value = data.get('student_group')
            params.append(sg_value if sg_value not in [None, '', 'null'] else None)

        if 'year_of_study' in data:
            yos_raw = data.get('year_of_study')
            if yos_raw in [None, '', 'null']:
                query_parts.append("year_of_study = %s")
                params.append(None)
            else:
                try:
                    yos_int = int(yos_raw)
                    if not 1 <= yos_int <= 6:
                        return jsonify({'message': 'Year of study must be between 1 and 6'}), 400
                    query_parts.append("year_of_study = %s")
                    params.append(yos_int)
                except (ValueError, TypeError):
                    return jsonify({'message': 'Invalid year of study format'}), 400

        if not query_parts:
            return jsonify({'message': 'No details provided to update'}), 400

        params.append(user_id)
        
        query = f"UPDATE users SET {', '.join(query_parts)} WHERE id = %s RETURNING id, full_name, email, student_group, year_of_study"
        
        cursor.execute(query, tuple(params))
        updated_user = cursor.fetchone()
        conn.commit()

        if not updated_user:
            return jsonify({'message': 'User not found or update failed'}), 404

        columns = [desc[0] for desc in cursor.description]
        updated_data = dict(zip(columns, updated_user))

        return jsonify({
            'message': 'User details updated successfully',
            'user': updated_data
        }), 200

    except Exception as e:
        conn.rollback()
        print(f"Error updating user details: {e}")
        return jsonify({'error': 'An internal error occurred'}), 500
    finally:
        cursor.close()
        conn.close()



@app.route('/api/users/<string:user_id>', methods=['PUT'])
@admin_required
def admin_update_user(user_id):
    data = request.get_json()
    print(f"[DEBUG] admin_update_user: Received data: {data}") # Debug log
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Check if user exists
        cursor.execute("SELECT id FROM users WHERE id = %s", (user_id,))
        if not cursor.fetchone():
            return jsonify({'message': 'User not found'}), 404

        query_parts = []
        params = []

        # Standard fields
        if 'full_name' in data:
            query_parts.append("full_name = %s")
            params.append(data['full_name'])
        if 'email' in data:
            query_parts.append("email = %s")
            params.append(data['email'])
        if 'role' in data:
            query_parts.append("role = %s")
            params.append(data['role'])

        # Student-specific fields: allow update if new_role is student/SG, OR if existing user is student/SG
        new_role = data.get('role')
        is_student_update = False
        if new_role in ['STUDENT', 'SEF_GRUPA']:
            is_student_update = True
        else:
            # If role is not being changed, check existing role
            cursor.execute("SELECT role FROM users WHERE id = %s", (user_id,))
            current_role = cursor.fetchone()
            if current_role and current_role[0] in ['STUDENT', 'SEF_GRUPA']:
                is_student_update = True
        if is_student_update:
            if 'student_group' in data:
                query_parts.append("student_group = %s")
                params.append(data.get('student_group'))
            
            # Handle year_of_study carefully: empty string should be NULL
            if 'year_of_study' in data:
                year_of_study = data['year_of_study']
                if year_of_study and str(year_of_study).strip():
                    try:
                        year_of_study_int = int(year_of_study)
                        if not (1 <= year_of_study_int <= 6):
                            return jsonify({'message': 'Year of study must be between 1 and 6'}), 400
                        query_parts.append("year_of_study = %s")
                        params.append(year_of_study_int)
                    except (ValueError, TypeError):
                        return jsonify({'message': 'Invalid year of study format'}), 400
                else:
                    # Treat empty/null year as NULL in the database
                    query_parts.append("year_of_study = %s")
                    params.append(None)

        if not query_parts:
            print(f"[DEBUG] admin_update_user: No query parts generated for data: {data}") # Debug log
            return jsonify({'message': 'No fields to update'}), 400

        params.append(user_id)
        query = f"UPDATE users SET {', '.join(query_parts)} WHERE id = %s"
        print(f"[DEBUG] admin_update_user: SQL Query: {query}") # Debug log
        print(f"[DEBUG] admin_update_user: SQL Params: {params}") # Debug log
        
        cursor.execute(query, tuple(params))
        conn.commit()

        return jsonify({'message': f'User {user_id} updated successfully'}), 200

    except Exception as e:
        conn.rollback()
        print(f"[ERROR] in admin_update_user: {e}")
        return jsonify({'error': 'An internal server error occurred while updating the user.'}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/')
def home():
    return "FIESC Exam Scheduler Backend is running!"

# Example: Get exams (fetches from DB or mock data)
@app.route('/api/exams', methods=['POST'])
@token_required
def create_exam_proxy():
    """Proxy endpoint to handle POST requests to /api/exams and redirect to /api/sec/exams"""
    return create_exam()

@app.route('/api/exams', methods=['GET'])
@token_required
def get_exams():
    if not DB_AVAILABLE:
        return jsonify(MOCK_EXAMS)

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM exams')
    exams = cursor.fetchall()
    # Convert list of tuples to list of dicts for JSON serialization
    columns = [desc[0] for desc in cursor.description]
    exams_dict = [dict(zip(columns, row)) for row in exams]
    cursor.close()
    conn.close()
    return jsonify(exams_dict)

# --- SG Role Endpoints ---

# Import the SG endpoints from the separate file
import sg_endpoints
from sg_endpoints import get_sg_exams, get_available_rooms, propose_exam_schedule, reschedule_exam

# Import the SEC endpoints
import sec_endpoints
from sec_endpoints import create_exam, get_all_exams, export_exams_excel

# Set DB_AVAILABLE in the sg_endpoints module
sg_endpoints.DB_AVAILABLE = DB_AVAILABLE

@app.route('/api/sg/exams', methods=['GET'])
@token_required
def route_get_sg_exams():
    return get_sg_exams()

@app.route('/api/sg/available-rooms', methods=['GET'])
@token_required
def route_get_available_rooms():
    return get_available_rooms()

@app.route('/api/sg/exams/<int:exam_id>/propose', methods=['PUT'])
@token_required
def route_propose_exam_schedule(exam_id):
    return propose_exam_schedule(exam_id)

@app.route('/api/sg/exams/<int:exam_id>/reschedule', methods=['PUT'])
@token_required
def route_reschedule_exam(exam_id):
    return reschedule_exam(exam_id)

@app.route('/api/sg/disciplines', methods=['GET'])
@token_required
def get_sg_disciplines():
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500

    user_id = g.current_user.get('id')
    if not user_id:
        return jsonify({"error": "User not found in token"}), 401

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
            SELECT
                d.id, d.name, e.status as exam_status, e.exam_date
            FROM
                disciplines d
            JOIN
                discipline_teachers dt ON d.id = dt.discipline_id
            LEFT JOIN
                exams e ON d.id = e.discipline_id
            WHERE
                dt.teacher_id = %s
            ORDER BY d.name;
        """
        cursor.execute(query, (user_id,))
        disciplines = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        disciplines_dict = [dict(zip(columns, row)) for row in disciplines]
        for d in disciplines_dict:
            if d.get('exam_date'):
                d['exam_date'] = d['exam_date'].isoformat()
        return jsonify(disciplines_dict), 200
    except Exception as e:
        print(f"Error fetching SG disciplines: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()


@app.route('/api/sg/propose-exam', methods=['POST'])
@token_required
def propose_exam_date():
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500

    user_id = g.current_user.get('id')
    data = request.get_json()
    discipline_id = data.get('discipline_id')
    exam_date = data.get('exam_date')

    if not all([discipline_id, exam_date]):
        return jsonify({"error": "Discipline ID and exam date are required"}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 1. Verify teacher is assigned to the discipline
        cursor.execute("SELECT 1 FROM discipline_teachers WHERE discipline_id = %s AND teacher_id = %s", (discipline_id, user_id))
        is_assigned = cursor.fetchone()
        if not is_assigned:
            return jsonify({"error": "You are not authorized to propose a date for this discipline"}), 403

        # Check if an exam is already proposed/scheduled for this discipline
        cursor.execute("SELECT id FROM exams WHERE discipline_id = %s AND status IN ('PROPOSTA', 'APROVATA')", (discipline_id,))
        if cursor.fetchone():
            return jsonify({"error": "An exam has already been proposed or scheduled for this discipline."}), 409 # Conflict

        # 4. Insert new exam proposal
        cursor.execute(
            "INSERT INTO exams (discipline_id, exam_date) VALUES (%s, %s) RETURNING id, discipline_id, exam_date, status",
            (discipline_id, exam_date)
        )
        new_exam_proposal = cursor.fetchone()
        conn.commit()

        columns = [desc[0] for desc in cursor.description]
        new_exam_dict = dict(zip(columns, new_exam_proposal))
        new_exam_dict['exam_date'] = new_exam_dict['exam_date'].isoformat()

        return jsonify(new_exam_dict), 201

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error proposing exam date: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()


# --- CD Role Endpoints ---

# Import the CD endpoints from the separate file
import cd_endpoints
from cd_endpoints import get_teacher_exams, review_exam_proposal, confirm_exam

# Set DB_AVAILABLE in the cd_endpoints module
cd_endpoints.DB_AVAILABLE = DB_AVAILABLE

@app.route('/api/cd/exams', methods=['GET'])
@token_required
def route_get_teacher_exams():
    print("\n*** TEACHER EXAMS ENDPOINT ACCESSED ***\n")
    return get_teacher_exams()

@app.route('/api/cd/exams/<int:exam_id>/review', methods=['PUT'])
@token_required
def route_review_exam_proposal(exam_id):
    return review_exam_proposal(exam_id)

@app.route('/api/cd/exams/<int:exam_id>/confirm', methods=['PUT'])
@token_required
def route_confirm_exam(exam_id):
    return confirm_exam(exam_id)


# --- STUDENT Role Endpoints ---

# Import the student endpoints from the separate file
import student_endpoints
from student_endpoints import get_student_exams, get_student_info, update_student_info

# Set DB_AVAILABLE in the student_endpoints module
student_endpoints.DB_AVAILABLE = DB_AVAILABLE

# Import the admin endpoints from the separate file
import admin_endpoints
from admin_endpoints import get_all_exams as admin_get_all_exams, delete_exam

# Import admin password change endpoint
import admin_password
from admin_password import change_admin_password

# Set DB_AVAILABLE in the admin_password module
admin_password.DB_AVAILABLE = DB_AVAILABLE

# Set DB_AVAILABLE in the admin_endpoints module
admin_endpoints.DB_AVAILABLE = DB_AVAILABLE

@app.route('/api/student/info', methods=['GET'])
@token_required
def route_get_student_info():
    print("\n*** STUDENT INFO GET ENDPOINT ACCESSED ***\n")
    return student_endpoints.get_student_info()

@app.route('/api/student/info', methods=['PUT'])
@token_required
def route_update_student_info():
    print("\n*** STUDENT INFO UPDATE ENDPOINT ACCESSED ***\n")
    return student_endpoints.update_student_info()

@app.route('/api/student/exams', methods=['GET'])
@token_required
def route_get_student_exams():
    print("\n*** STUDENT EXAMS ENDPOINT ACCESSED ***\n")
    return student_endpoints.get_student_exams()


# --- ADMIN Role Endpoints ---

@app.route('/api/admin/exams', methods=['GET'])
@token_required
def route_get_admin_exams():
    print("\n*** ADMIN EXAMS ENDPOINT ACCESSED ***\n")
    return admin_endpoints.get_all_exams()

@app.route('/api/admin/exams/<int:exam_id>', methods=['DELETE'])
@token_required
def route_delete_exam(exam_id):
    print(f"\n*** ADMIN DELETE EXAM ENDPOINT ACCESSED FOR EXAM ID: {exam_id} ***\n")
    return admin_endpoints.delete_exam(exam_id)

@app.route('/api/admin/change-password', methods=['POST'])
@admin_required
def route_change_admin_password():
    return change_admin_password()

# --- SEC Role Endpoints ---

# ... (rest of the code remains the same)
# Import the SEC endpoints from the separate file
import sec_endpoints
from sec_endpoints import create_exam, get_all_exams, export_exams_excel, manage_exam_periods, get_exam_periods as sec_get_exam_periods, get_sec_disciplines, get_sec_teachers

# Import PDF export functionality
import pdf_export
from pdf_export import export_exams_pdf

# Set DB_AVAILABLE in the pdf_export module
pdf_export.DB_AVAILABLE = DB_AVAILABLE
# Set DB_AVAILABLE in the sec_endpoints module
sec_endpoints.DB_AVAILABLE = DB_AVAILABLE

@app.route('/api/sec/exams', methods=['POST'])
@token_required
def route_create_exam_post():
    return create_exam()

@app.route('/api/sec/exams', methods=['GET'])
@token_required
def route_get_all_exams():
    return get_all_exams()

@app.route('/api/sec/exams/export', methods=['GET'])
@sec_required
def route_export_exams_excel():
    return export_exams_excel()

@app.route('/api/sec/exams/export-pdf', methods=['GET'])
@sec_required
def route_export_exams_pdf():
    return export_exams_pdf()

@app.route('/api/sec/exam-periods', methods=['POST'])
@token_required
def route_manage_exam_periods():
    return manage_exam_periods()

@app.route('/api/sec/exam-periods', methods=['GET'])
@token_required
def route_get_exam_periods():
    return sec_get_exam_periods()

@app.route('/api/sec/approved-exams', methods=['GET'])
@token_required
def get_approved_exams():
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
            SELECT 
                e.id as exam_id,
                d.name as discipline_name,
                u.full_name as teacher_name,
                e.exam_date,
                d.year_of_study,
                d.specialization
            FROM exams e
            JOIN disciplines d ON e.discipline_id = d.id
            JOIN users u ON e.main_teacher_id = u.id
            WHERE e.status = 'CONFIRMED'
            ORDER BY e.exam_date, d.year_of_study, d.specialization;
        """
        cursor.execute(query)
        approved_exams = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        exams_dict = [dict(zip(columns, row)) for row in approved_exams]
        for exam in exams_dict:
            if exam.get('exam_date'):
                exam['exam_date'] = exam['exam_date'].isoformat()
        return jsonify(exams_dict), 200
    except Exception as e:
        print(f"Error fetching approved exams for SEC: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()


@app.route('/api/sec/finalize-schedule', methods=['POST'])
@token_required
def finalize_schedule():
    # This is a placeholder for now. 
    # In a real app, this might trigger emails, lock the schedule, etc.
    return jsonify({"message": "Schedule has been marked as final."}), 200

@app.route('/api/sec/assign-discipline', methods=['POST'])
@token_required
def assign_discipline():
    """Endpoint for SEC to assign a discipline to a group and create an exam"""
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500
        
    # Check if user has SEC role
    if g.current_user.get('role') != 'SEC':
        return jsonify({"error": "Only SEC role can assign disciplines"}), 403
        
    data = request.get_json()
    discipline_id = data.get('discipline_id')
    student_group = data.get('student_group')
    exam_type = data.get('exam_type')
    main_teacher_id = data.get('main_teacher_id')
    second_teacher_id = data.get('second_teacher_id')
    
    if not all([discipline_id, student_group, exam_type, main_teacher_id, second_teacher_id]):
        return jsonify({"error": "Missing required fields"}), 400
        
    if exam_type not in ['EXAM', 'PROJECT']:
        return jsonify({"error": "Invalid exam type. Must be 'EXAM' or 'PROJECT'"}), 400
        
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verify discipline exists
        cursor.execute("SELECT id FROM disciplines WHERE id = %s", (discipline_id,))
        if not cursor.fetchone():
            return jsonify({"error": "Discipline not found"}), 404
            
        # Verify teachers exist and have CADRU_DIDACTIC role
        cursor.execute("SELECT id FROM users WHERE id = %s AND role = 'CADRU_DIDACTIC'", (main_teacher_id,))
        if not cursor.fetchone():
            return jsonify({"error": "Main teacher not found or not a teacher"}), 404
            
        cursor.execute("SELECT id FROM users WHERE id = %s AND role = 'CADRU_DIDACTIC'", (second_teacher_id,))
        if not cursor.fetchone():
            return jsonify({"error": "Second teacher not found or not a teacher"}), 404
            
        # Verify student group has a group leader
        cursor.execute("SELECT id FROM users WHERE student_group = %s AND role = 'SEF_GRUPA'", (student_group,))
        if not cursor.fetchone():
            return jsonify({"error": "No group leader found for this student group"}), 404
            
        # Check if an exam already exists for this discipline and group
        cursor.execute(
            "SELECT id FROM exams WHERE discipline_id = %s AND student_group = %s",
            (discipline_id, student_group)
        )
        if cursor.fetchone():
            return jsonify({"error": "An exam already exists for this discipline and group"}), 409
            
        # Create the exam
        cursor.execute(
            """INSERT INTO exams 
            (discipline_id, exam_type, student_group, main_teacher_id, second_teacher_id, status, created_by) 
            VALUES (%s, %s, %s, %s, %s, 'DRAFT', %s) RETURNING id""",
            (discipline_id, exam_type, student_group, main_teacher_id, second_teacher_id, g.current_user.get('id'))
        )
        exam_id = cursor.fetchone()[0]
        conn.commit()
        
        return jsonify({
            "message": "Discipline assigned and exam created successfully",
            "exam_id": exam_id
        }), 201
        
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error assigning discipline: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()

@app.route('/api/sec/group-leaders', methods=['GET'])
@token_required
def get_group_leaders():
    """Get all group leaders for SEC to assign disciplines"""
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500
        
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            """SELECT id, full_name, email, student_group, year_of_study 
            FROM users WHERE role = 'SEF_GRUPA' ORDER BY student_group"""
        )
        group_leaders = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        group_leaders_dict = [dict(zip(columns, row)) for row in group_leaders]
        
        return jsonify(group_leaders_dict), 200
    except Exception as e:
        print(f"Error fetching group leaders: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()

@app.route('/api/sec/export-schedule', methods=['GET'])
@token_required
def export_schedule():
    """Export the full exam schedule to Excel for SEC"""
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500
        
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT 
                d.name as discipline_name,
                e.exam_type,
                e.student_group,
                e.exam_date,
                e.start_hour,
                e.duration,
                r.name as room_name,
                u1.full_name as main_teacher,
                u2.full_name as second_teacher,
                e.status
            FROM exams e
            JOIN disciplines d ON e.discipline_id = d.id
            LEFT JOIN rooms r ON e.room_id = r.id
            JOIN users u1 ON e.main_teacher_id = u1.id
            JOIN users u2 ON e.second_teacher_id = u2.id
            WHERE e.status = 'CONFIRMED'
            ORDER BY e.exam_date, e.start_hour
        """
        cursor.execute(query)
        exams = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        exams_dict = [dict(zip(columns, row)) for row in exams]
        
        for exam in exams_dict:
            if exam.get('exam_date'):
                exam['exam_date'] = exam['exam_date'].isoformat()
        
        return jsonify(exams_dict), 200
    except Exception as e:
        print(f"Error exporting schedule: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()


@app.route('/api/sec/disciplines', methods=['GET'])
@token_required
def route_sec_disciplines():
    return get_sec_disciplines()

@app.route('/api/sec/teachers', methods=['GET'])
@token_required
def route_sec_teachers():
    return get_sec_teachers()

# --- Admin Role Endpoints ---
@app.route('/api/admin/users', methods=['GET'])
@token_required
def get_all_users():
    # In a real app, you'd add a check here to ensure g.current_user.role == 'ADM'
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
            SELECT u.id, u.full_name, u.email, r.name as role_name
            FROM users u
            JOIN roles r ON u.role_id = r.id
            ORDER BY u.full_name;
        """
        cursor.execute(query)
        users = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        users_dict = [dict(zip(columns, row)) for row in users]
        return jsonify(users_dict), 200
    except Exception as e:
        print(f"Error fetching all users: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()

@app.route('/api/admin/roles', methods=['GET'])
@token_required
def get_all_roles():
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name FROM roles ORDER BY name")
        roles = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        roles_dict = [dict(zip(columns, row)) for row in roles]
        return jsonify(roles_dict), 200
    except Exception as e:
        print(f"Error fetching roles: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()




@app.route('/api/disciplines/upload', methods=['POST'])
@token_required
def upload_disciplines_endpoint():
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Get role_id for 'SG' (Group Leader)
        cursor.execute("SELECT id FROM roles WHERE name = 'SG'")
        sg_role_row = cursor.fetchone()
        if not sg_role_row:
            return jsonify({"error": "Default role 'SG' not found."}), 500
        sg_role_id = sg_role_row[0]

        disciplines_added = 0
        users_added = 0

        for item in data:
            discipline_name = item.get('Discipline Name')
            teacher_name = item.get('Teacher Name')
            teacher_email = item.get('Teacher Email')

            if not all([discipline_name, teacher_name, teacher_email]):
                continue

            # Find or create the teacher (user)
            cursor.execute("SELECT id FROM users WHERE email = %s", (teacher_email,))
            user_row = cursor.fetchone()
            
            if user_row:
                teacher_id = user_row[0]
            else:
                cursor.execute(
                    "INSERT INTO users (full_name, email, role_id) VALUES (%s, %s, %s) RETURNING id",
                    (teacher_name, teacher_email, sg_role_id)
                )
                teacher_id = cursor.fetchone()[0]
                users_added += 1

            # Check if discipline already exists
            cursor.execute("SELECT id FROM disciplines WHERE name = %s", (discipline_name,))
            if not cursor.fetchone():
                cursor.execute(
                    "INSERT INTO disciplines (name, teacher_id) VALUES (%s, %s)",
                    (discipline_name, teacher_id)
                )
                disciplines_added += 1
        
        conn.commit()
        
        return jsonify({
            "message": "Upload successful.",
            "disciplines_added": disciplines_added,
            "users_added": users_added
        }), 201

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error during discipline upload: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()


@app.route('/api/exam-periods', methods=['GET'])
@token_required
def get_exam_periods():
    if not DB_AVAILABLE:
        return jsonify([]), 200

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, start_date, end_date, is_active FROM exam_periods ORDER BY start_date DESC")
        periods = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        periods_dict = [dict(zip(columns, row)) for row in periods]
        # Convert date objects to strings for JSON serialization
        for p in periods_dict:
            p['start_date'] = p['start_date'].isoformat()
            p['end_date'] = p['end_date'].isoformat()
        return jsonify(periods_dict), 200
    except Exception as e:
        print(f"Error fetching exam periods: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()


@app.route('/api/exam-periods', methods=['POST'])
@token_required
def add_exam_period():
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500

    data = request.get_json()
    start_date = data.get('start_date')
    end_date = data.get('end_date')

    if not start_date or not end_date:
        return jsonify({"error": "Start date and end date are required"}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO exam_periods (start_date, end_date) VALUES (%s, %s) RETURNING id, start_date, end_date, is_active",
            (start_date, end_date)
        )
        new_period = cursor.fetchone()
        conn.commit()
        columns = [desc[0] for desc in cursor.description]
        new_period_dict = dict(zip(columns, new_period))
        new_period_dict['start_date'] = new_period_dict['start_date'].isoformat()
        new_period_dict['end_date'] = new_period_dict['end_date'].isoformat()
        return jsonify(new_period_dict), 201
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error adding exam period: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()


@app.route('/api/exam-periods/<int:period_id>', methods=['PUT'])
@token_required
def update_exam_period(period_id):
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500

    data = request.get_json()
    is_active = data.get('is_active')

    if is_active is None:
        return jsonify({"error": "'is_active' field is required"}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE exam_periods SET is_active = %s WHERE id = %s",
            (is_active, period_id)
        )
        conn.commit()
        if cursor.rowcount == 0:
             return jsonify({"error": "Exam period not found"}), 404
        return jsonify({"message": "Exam period updated successfully"}), 200
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error updating exam period: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()


# Room Management Endpoints
@app.route('/api/rooms', methods=['GET'])
@sec_required
def get_rooms():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, name, short_name, building_name, capacity FROM rooms ORDER BY building_name, name")
        rooms = cursor.fetchall()
        return jsonify([{
            'id': r[0],
            'name': r[1],
            'short_name': r[2],
            'building_name': r[3],
            'capacity': r[4]
        } for r in rooms])
    except Exception as e:
        print(f"Error fetching rooms: {e}")
        return jsonify({'error': 'An internal error occurred'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/rooms', methods=['POST'])
@admin_required
def add_room():
    data = request.get_json()
    name = data.get('name')
    capacity = data.get('capacity')

    if not name or capacity is None:
        return jsonify({'error': 'Name and capacity are required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """INSERT INTO rooms (name, short_name, building_name, capacity) VALUES (%s, %s, %s, %s) RETURNING id""",
            (name, data.get('short_name'), data.get('building_name'), capacity)
        )
        new_id = cursor.fetchone()[0]
        conn.commit()
        return jsonify({'message': 'Room added successfully', 'id': new_id}), 201
    except Exception as e:
        conn.rollback()
        print(f"Error adding room: {e}")
        return jsonify({'error': 'An internal error occurred'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/rooms/<int:room_id>', methods=['PUT'])
@admin_required
def update_room(room_id):
    data = request.get_json()
    name = data.get('name')
    capacity = data.get('capacity')

    if not name or capacity is None:
        return jsonify({'error': 'Name and capacity are required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """UPDATE rooms SET name = %s, short_name = %s, building_name = %s, capacity = %s WHERE id = %s""",
            (name, data.get('short_name'), data.get('building_name'), capacity, room_id)
        )
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({'error': 'Room not found'}), 404
        return jsonify({'message': 'Room updated successfully'})
    except Exception as e:
        conn.rollback()
        print(f"Error updating room: {e}")
        return jsonify({'error': 'An internal error occurred'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/rooms/<int:room_id>', methods=['DELETE'])
@admin_required
def delete_room(room_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM rooms WHERE id = %s", (room_id,))
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({'error': 'Room not found'}), 404
        return jsonify({'message': 'Room deleted successfully'})
    except Exception as e:
        conn.rollback()
        print(f"Error deleting room: {e}")
        return jsonify({'error': 'An error occurred while deleting the room'}), 500
    finally:
        conn.close()

# ----------------- DISCIPLINE MANAGEMENT (Admin) -----------------

@app.route('/api/users', methods=['GET'])
@admin_required
def get_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, full_name, email, role, student_group, year_of_study FROM users ORDER BY full_name")
    users = cursor.fetchall()
    columns = [desc[0] for desc in cursor.description]
    users_dict = [dict(zip(columns, row)) for row in users]
    cursor.close()
    conn.close()
    return jsonify(users_dict)

@app.route('/api/admin/roles', methods=['GET'])
@admin_required
def get_roles():
    # This can be hardcoded or fetched from an enum/table if they become dynamic
    roles = ['STUDENT', 'SEF_GRUPA', 'CADRU_DIDACTIC', 'ADMIN']
    return jsonify(roles)

@app.route('/api/teachers', methods=['GET'])
@token_required
def get_teachers():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, full_name FROM users WHERE role = 'CADRU_DIDACTIC' ORDER BY full_name")
        teachers_raw = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        teachers_list = [dict(zip(columns, row)) for row in teachers_raw]
        return jsonify(teachers_list)
    except Exception as e:
        print(f"Error fetching teachers: {e}")
        return jsonify({'error': 'An internal error occurred'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/student-groups', methods=['GET'])
@token_required
def get_student_groups():
    """Get all unique student groups from the users table"""
    # Check if user has SEC or ADM role
    if g.current_user.get('role') not in ['SEC', 'ADM']:
        return jsonify({"error": "Only SEC or ADM can access student groups"}), 403
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Get all unique student groups that are not null or empty
        cursor.execute("""
            SELECT DISTINCT student_group 
            FROM users 
            WHERE student_group IS NOT NULL AND student_group != '' 
            ORDER BY student_group
        """)
        groups_raw = cursor.fetchall()
        # Convert to list of strings
        groups_list = [group[0] for group in groups_raw]
        return jsonify(groups_list)
    except Exception as e:
        print(f"Error fetching student groups: {e}")
        return jsonify({'error': 'An internal error occurred'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/disciplines', methods=['GET'])
@admin_required
def get_disciplines():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Use a subquery with JSON_AGG to get all teachers for each discipline
        query = """
            SELECT
                d.id,
                d.name,
                COALESCE(
                    (SELECT JSON_AGG(json_build_object('id', u.id, 'full_name', u.full_name))
                     FROM discipline_teachers dt
                     JOIN users u ON dt.teacher_id = u.id
                     WHERE dt.discipline_id = d.id),
                    '[]'::json
                ) as teachers
            FROM disciplines d
            ORDER BY d.name;
        """
        cursor.execute(query)
        disciplines_raw = cursor.fetchall()

        columns = [desc[0] for desc in cursor.description]
        disciplines_list = []
        for row in disciplines_raw:
            d = dict(zip(columns, row))
            # pg8000 returns json as a string, so we parse it
            if isinstance(d.get('teachers'), str):
                d['teachers'] = json.loads(d['teachers'])
            disciplines_list.append(d)

        return jsonify(disciplines_list)
    except Exception as e:
        print(f"Error fetching disciplines: {e}")
        return jsonify({'error': 'An internal error occurred'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/disciplines', methods=['POST'])
@admin_required
def add_discipline():
    data = request.get_json()
    name = data.get('name')
    teacher_ids = data.get('teacher_ids', []) # Expect a list of teacher IDs

    if not name:
        return jsonify({'message': 'Discipline name is required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Insert the new discipline and get its ID
        cursor.execute(
            "INSERT INTO disciplines (name) VALUES (%s) RETURNING id",
            (name,)
        )
        discipline_id = cursor.fetchone()[0]

        # Link teachers to the new discipline
        if teacher_ids:
            for teacher_id in teacher_ids:
                cursor.execute(
                    "INSERT INTO discipline_teachers (discipline_id, teacher_id) VALUES (%s, %s)",
                    (discipline_id, teacher_id)
                )
        
        conn.commit()
        return jsonify({'message': 'Discipline added successfully', 'id': discipline_id}), 201
    except Exception as e:
        conn.rollback()
        print(f"Error adding discipline: {e}")
        return jsonify({'message': f'Database error: {e}'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/disciplines/<int:discipline_id>', methods=['PUT'])
@admin_required
def update_discipline(discipline_id):
    data = request.get_json()
    name = data.get('name')
    teacher_ids = data.get('teacher_ids', []) # Expect a list of teacher IDs

    if not name:
        return jsonify({'message': 'Discipline name is required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Update the discipline's name
        cursor.execute(
            "UPDATE disciplines SET name = %s WHERE id = %s",
            (name, discipline_id)
        )
        
        if cursor.rowcount == 0:
            return jsonify({'message': 'Discipline not found'}), 404

        # Update the teacher associations
        # 1. Delete existing associations
        cursor.execute("DELETE FROM discipline_teachers WHERE discipline_id = %s", (discipline_id,))
        
        # 2. Add new associations
        if teacher_ids:
            for teacher_id in teacher_ids:
                cursor.execute(
                    "INSERT INTO discipline_teachers (discipline_id, teacher_id) VALUES (%s, %s)",
                    (discipline_id, teacher_id)
                )

        conn.commit()
        return jsonify({'message': 'Discipline updated successfully'})
    except Exception as e:
        conn.rollback()
        print(f"Error updating discipline: {e}")
        return jsonify({'message': f'Database error: {e}'}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/disciplines/<int:discipline_id>', methods=['DELETE'])
@admin_required
def delete_discipline(discipline_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM disciplines WHERE id = %s", (discipline_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({'message': f'Database error: {e}'}), 500
    finally:
        conn.close()

    if cursor.rowcount == 0:
        return jsonify({'message': 'Discipline not found'}), 404

    return jsonify({'message': 'Discipline deleted successfully'})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
