import psycopg2
from flask import jsonify, g
from datetime import datetime

# Flag to indicate if the database is available
DB_AVAILABLE = False

def get_db_connection():
    # This function should be imported from your main app.py
    from app import get_db_connection
    return get_db_connection()

def get_all_exams():
    """
    Fetch all exams for admin view with detailed information
    """
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500

    user_id = g.current_user.get('id')
    if not user_id:
        return jsonify({"error": "User not found in token"}), 401

    # Check if user is admin
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verify user is admin
        cursor.execute("SELECT role_name FROM users WHERE id = %s", (user_id,))
        user_role = cursor.fetchone()
        if not user_role or user_role[0] != 'ADM':
            return jsonify({"error": "Unauthorized access"}), 403
        
        # Fetch all exams with related information
        query = """
            SELECT 
                e.id as exam_id,
                e.exam_date,
                e.status,
                e.duration,
                e.room_id,
                d.id as discipline_id,
                d.name as discipline_name,
                d.year_of_study,
                d.specialization,
                r.name as room_name,
                r.capacity as room_capacity,
                u.id as teacher_id,
                u.full_name as teacher_name,
                u.email as teacher_email,
                g.id as group_id,
                g.name as group_name
            FROM 
                exams e
            JOIN 
                disciplines d ON e.discipline_id = d.id
            LEFT JOIN 
                rooms r ON e.room_id = r.id
            LEFT JOIN 
                discipline_teachers dt ON d.id = dt.discipline_id
            LEFT JOIN 
                users u ON dt.teacher_id = u.id
            LEFT JOIN 
                groups g ON d.group_id = g.id
            ORDER BY 
                e.exam_date DESC
        """
        
        cursor.execute(query)
        exams = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        
        # Process the results
        result = []
        current_exam_id = None
        current_exam = None
        
        for row in exams:
            exam_dict = dict(zip(columns, row))
            
            # Format date for JSON serialization
            if exam_dict['exam_date']:
                exam_dict['exam_date'] = exam_dict['exam_date'].isoformat()
            
            # If this is a new exam or the first one
            if current_exam_id != exam_dict['exam_id']:
                # If we already have an exam in progress, add it to results
                if current_exam:
                    result.append(current_exam)
                
                # Start a new exam
                current_exam_id = exam_dict['exam_id']
                current_exam = {
                    'exam_id': exam_dict['exam_id'],
                    'exam_date': exam_dict['exam_date'],
                    'status': exam_dict['status'],
                    'duration': exam_dict['duration'],
                    'discipline_id': exam_dict['discipline_id'],
                    'discipline_name': exam_dict['discipline_name'],
                    'year_of_study': exam_dict['year_of_study'],
                    'specialization': exam_dict['specialization'],
                    'room_id': exam_dict['room_id'],
                    'room_name': exam_dict['room_name'],
                    'room_capacity': exam_dict['room_capacity'],
                    'group_id': exam_dict['group_id'],
                    'group_name': exam_dict['group_name'],
                    'teachers': []
                }
            
            # Add teacher if not None and not already in the list
            if exam_dict['teacher_id']:
                teacher = {
                    'teacher_id': exam_dict['teacher_id'],
                    'teacher_name': exam_dict['teacher_name'],
                    'teacher_email': exam_dict['teacher_email']
                }
                
                # Check if this teacher is already in the list
                teacher_exists = False
                for existing_teacher in current_exam['teachers']:
                    if existing_teacher['teacher_id'] == teacher['teacher_id']:
                        teacher_exists = True
                        break
                
                if not teacher_exists:
                    current_exam['teachers'].append(teacher)
        
        # Add the last exam if there is one
        if current_exam:
            result.append(current_exam)
            
        return jsonify(result), 200
        
    except Exception as e:
        print(f"Error fetching admin exams: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()

def delete_exam(exam_id):
    """
    Delete an exam by ID (admin only)
    """
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500

    user_id = g.current_user.get('id')
    if not user_id:
        return jsonify({"error": "User not found in token"}), 401

    # Check if user is admin
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verify user is admin
        cursor.execute("SELECT role_name FROM users WHERE id = %s", (user_id,))
        user_role = cursor.fetchone()
        if not user_role or user_role[0] != 'ADM':
            return jsonify({"error": "Unauthorized access"}), 403
        
        # Check if exam exists
        cursor.execute("SELECT id FROM exams WHERE id = %s", (exam_id,))
        if not cursor.fetchone():
            return jsonify({"error": "Exam not found"}), 404
        
        # Delete the exam
        cursor.execute("DELETE FROM exams WHERE id = %s", (exam_id,))
        conn.commit()
        
        return jsonify({"message": "Exam deleted successfully"}), 200
        
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error deleting exam: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()
