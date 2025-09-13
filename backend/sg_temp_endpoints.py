from flask import Blueprint, jsonify, g
from database import get_db_connection
from auth import sg_required

sg_temp_bp = Blueprint('sg_temp_endpoints', __name__)

@sg_temp_bp.route('/api/sg/exams', methods=['GET'])
@sg_required
def get_sg_exams():
    user_id = g.current_user.get('id')
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # First, get the student_group of the current user (who is a group leader)
        cursor.execute("SELECT student_group FROM users WHERE id = %s", (user_id,))
        user_group_record = cursor.fetchone()
        if not user_group_record or not user_group_record[0]:
            return jsonify({'message': 'User is not assigned to a student group'}), 404
        
        student_group = user_group_record[0]

        # Now, fetch exams assigned to that group
        query = """
            SELECT e.id, d.name as discipline_name, u.full_name as teacher_name, e.status, e.exam_type
            FROM exams e
            JOIN disciplines d ON e.discipline_id = d.id
            JOIN users u ON d.teacher_id = u.id
            WHERE e.student_group = %s
            ORDER BY d.name;
        """
        cursor.execute(query, (student_group,))
        exams = cursor.fetchall()
        
        columns = [desc[0] for desc in cursor.description]
        result = [dict(zip(columns, exam)) for exam in exams]

        return jsonify(result), 200

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"[ERROR] in get_sg_exams: {e}")
        return jsonify({'error': 'An internal error occurred'}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()
