"""
Teacher (CD) role endpoints for the exam scheduling system.
These endpoints will be imported into the main app.py file.
"""

from flask import jsonify, request, g
from database import get_db_connection
from auth import token_required, cd_required
# Import DB_AVAILABLE from app.py when this module is imported
DB_AVAILABLE = None

# --- CD Role Endpoints ---

@cd_required
def get_teacher_exams():
    # DEBUG log
    print(f"[DEBUG] get_teacher_exams called by user ID={g.current_user.get('id')} role={g.current_user.get('role')}")
    """Get exams for a teacher (either as main or secondary teacher)"""
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500
        
    teacher_id = g.current_user.get('id')
    if not teacher_id:
        return jsonify({"error": "Teacher ID not found"}), 400
        
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT 
                e.id,
                d.name as discipline_name,
                e.exam_type,
                e.student_group,
                e.status,
                e.exam_date,
                e.start_hour,
                e.duration,
                r.name as room_name,
                u1.full_name as main_teacher,
                u2.full_name as second_teacher,
                CASE 
                    WHEN e.main_teacher_id = %s THEN 'MAIN'
                    WHEN e.second_teacher_id = %s THEN 'SECOND'
                    ELSE 'UNKNOWN'
                END as teacher_role
            FROM exams e
            JOIN disciplines d ON e.discipline_id = d.id
            LEFT JOIN rooms r ON e.room_id = r.id
            JOIN users u1 ON e.main_teacher_id = u1.id
            JOIN users u2 ON e.second_teacher_id = u2.id
            WHERE e.main_teacher_id = %s OR e.second_teacher_id = %s
            ORDER BY e.status, e.exam_date, e.start_hour
        """
        cursor.execute(query, (teacher_id, teacher_id, teacher_id, teacher_id))
        exams = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        exams_dict = [dict(zip(columns, row)) for row in exams]
        
        for exam in exams_dict:
            if exam.get('exam_date'):
                try:
                    exam['exam_date'] = exam['exam_date'].isoformat()
                except ValueError:
                    exam['exam_date'] = None
        
        return jsonify(exams_dict), 200
    except Exception as e:
        print(f"Error fetching exams for teacher: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()

@cd_required
def review_exam_proposal(exam_id):
    # DEBUG log
    print(f"[DEBUG] review_exam_proposal called by user ID={g.current_user.get('id')} role={g.current_user.get('role')} for exam_id={exam_id}")
    """Teacher reviews an exam proposal (accept, reject, propose alternate, or cancel)"""
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500
        
    teacher_id = g.current_user.get('id')
    data = request.get_json()
    action = data.get('action')
    
    if not action:
        return jsonify({"error": "Action is required"}), 400
        
    if action not in ['ACCEPT', 'REJECT', 'ALTERNATE', 'CANCEL']:
        return jsonify({"error": "Invalid action. Must be 'ACCEPT', 'REJECT', 'ALTERNATE', or 'CANCEL'"}), 400
        
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if exam exists and teacher is assigned to it
        cursor.execute(
            """SELECT status FROM exams 
            WHERE id = %s AND (main_teacher_id = %s OR second_teacher_id = %s)""",
            (exam_id, teacher_id, teacher_id)
        )
        exam = cursor.fetchone()
        if not exam:
            return jsonify({"error": "Exam not found or you are not assigned to this exam"}), 404
            
        # Check if exam is in a state that can be reviewed
        status = exam[0]
        if status != 'PROPOSED':
            return jsonify({"error": f"Cannot review exam in {status} status"}), 400
            
        new_status = ''
        if action == 'ACCEPT':
            new_status = 'ACCEPTED'
        elif action == 'REJECT':
            new_status = 'REJECTED'
        elif action == 'CANCEL':
            new_status = 'CANCELLED'
        elif action == 'ALTERNATE':
            # For alternate proposal, additional data is required
            alt_date = data.get('alternate_date')
            alt_hour = data.get('alternate_hour')
            
            if not all([alt_date, alt_hour]):
                return jsonify({"error": "Alternate date and hour are required for ALTERNATE action"}), 400
                
            # Validate alternate hour
            if not (8 <= int(alt_hour) <= 18):
                return jsonify({"error": "Alternate hour must be between 8 and 18"}), 400
                
            # Update with alternate proposal
            cursor.execute(
                """
                UPDATE exams 
                SET status = 'REJECTED', exam_date = %s, start_hour = %s, updated_at = CURRENT_TIMESTAMP 
                WHERE id = %s
                """,
                (alt_date, alt_hour, exam_id)
            )
            conn.commit()
            
            return jsonify({
                "message": "Alternate exam schedule proposed",
                "exam_id": exam_id,
                "alternate_date": alt_date,
                "alternate_hour": alt_hour
            }), 200
        
        # For other actions, just update the status
        if action != 'ALTERNATE':
            cursor.execute(
                """
                UPDATE exams 
                SET status = %s, updated_at = CURRENT_TIMESTAMP 
                WHERE id = %s
                """,
                (new_status, exam_id)
            )
            conn.commit()
        
        return jsonify({
            "message": f"Exam {action.lower()}ed successfully",
            "exam_id": exam_id,
            "new_status": new_status
        }), 200
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error reviewing exam proposal: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()

@cd_required
def confirm_exam(exam_id):
    # DEBUG log
    print(f"[DEBUG] confirm_exam called by user ID={g.current_user.get('id')} role={g.current_user.get('role')} for exam_id={exam_id}")
    """Teacher confirms an accepted exam"""
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500
        
    teacher_id = g.current_user.get('id')
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if exam exists and teacher is assigned to it
        cursor.execute(
            """SELECT status FROM exams 
            WHERE id = %s AND (main_teacher_id = %s OR second_teacher_id = %s)""",
            (exam_id, teacher_id, teacher_id)
        )
        exam = cursor.fetchone()
        if not exam:
            return jsonify({"error": "Exam not found or you are not assigned to this exam"}), 404
            
        # Check if exam is in a state that can be confirmed
        status = exam[0]
        if status != 'ACCEPTED':
            return jsonify({"error": f"Cannot confirm exam in {status} status"}), 400
            
        # Update the status to CONFIRMED
        cursor.execute(
            """
            UPDATE exams 
            SET status = 'CONFIRMED', updated_at = CURRENT_TIMESTAMP 
            WHERE id = %s
            """,
            (exam_id,)
        )
        conn.commit()
        
        return jsonify({
            "message": "Exam confirmed successfully",
            "exam_id": exam_id
        }), 200
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error confirming exam: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()
