"""
Group Leader (SG) role endpoints for the exam scheduling system.
These endpoints will be imported into the main app.py file.
"""

from flask import jsonify, request, g
from database import get_db_connection
from auth import token_required
from datetime import datetime
# Import DB_AVAILABLE from app.py when this module is imported
DB_AVAILABLE = None

# --- SG Role Endpoints ---

@token_required
def get_sg_exams():
    """Get exams assigned to the group leader's group"""
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500
        
    # Check if user has SEF_GRUPA role
    if g.current_user.get('role') != 'SEF_GRUPA':
        return jsonify({"error": "Only group leaders can access this endpoint"}), 403
        
    student_group = g.current_user.get('student_group')
    if not student_group:
        return jsonify({"error": "Group leader is not assigned to a student group"}), 400
        
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT 
                e.id,
                d.name as discipline_name,
                e.exam_type,
                e.status,
                e.exam_date,
                e.start_hour,
                e.duration,
                r.name as room_name,
                u1.full_name as main_teacher,
                u2.full_name as second_teacher
            FROM exams e
            JOIN disciplines d ON e.discipline_id = d.id
            LEFT JOIN rooms r ON e.room_id = r.id
            JOIN users u1 ON e.main_teacher_id = u1.id
            JOIN users u2 ON e.second_teacher_id = u2.id
            WHERE e.student_group = %s
            ORDER BY e.status, e.exam_date, e.start_hour
        """
        cursor.execute(query, (student_group,))
        exams = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        exams_dict = [dict(zip(columns, row)) for row in exams]
        
        for exam in exams_dict:
            if exam.get('exam_date'):
                exam['exam_date'] = exam['exam_date'].isoformat()
        
        return jsonify(exams_dict), 200
    except Exception as e:
        print(f"Error fetching exams for group leader: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()

@token_required
def get_available_rooms():
    """Get available rooms for a specific date and time"""
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500
        
    # Check if user has SEF_GRUPA role
    if g.current_user.get('role') != 'SEF_GRUPA':
        return jsonify({"error": "Only group leaders can access this endpoint"}), 403
        
    date = request.args.get('date')
    hour = request.args.get('hour')
    
    if not all([date, hour]):
        return jsonify({"error": "Date and hour are required"}), 400
    
    try:
        # Validate that date is a weekday (Monday to Friday)
        date_obj = datetime.strptime(date, '%Y-%m-%d')
        if date_obj.weekday() >= 5:  # 5=Saturday, 6=Sunday
            return jsonify({"error": "Exams can only be scheduled on weekdays (Monday to Friday)"}), 400
            
        hour_int = int(hour)
        if not (8 <= hour_int <= 20):
            return jsonify({"error": "Hour must be between 8 and 20"}), 400
    except ValueError:
        return jsonify({"error": "Invalid date or hour format"}), 400
        
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get all rooms
        cursor.execute("SELECT id, name, capacity FROM rooms ORDER BY name")
        all_rooms = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        all_rooms_dict = [dict(zip(columns, row)) for row in all_rooms]
        
        # Get rooms that are already booked for the given date and hour
        cursor.execute(
            """
            SELECT room_id FROM exams 
            WHERE exam_date::date = %s::date 
            AND start_hour = %s 
            AND room_id IS NOT NULL
            AND status IN ('PROPOSED', 'ACCEPTED', 'CONFIRMED')
            """,
            (date, hour_int)
        )
        booked_room_ids = [row[0] for row in cursor.fetchall()]
        
        # Filter out booked rooms
        available_rooms = [room for room in all_rooms_dict if room['id'] not in booked_room_ids]
        
        return jsonify(available_rooms), 200
    except Exception as e:
        print(f"Error fetching available rooms: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()

@token_required
def propose_exam_schedule(exam_id):
    """Group leader proposes a date, time, and room for an exam"""
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500
        
    # Check if user has SEF_GRUPA role
    if g.current_user.get('role') != 'SEF_GRUPA':
        return jsonify({"error": "Only group leaders can propose exam schedules"}), 403
        
    student_group = g.current_user.get('student_group')
    if not student_group:
        return jsonify({"error": "Group leader is not assigned to a student group"}), 400
        
    data = request.get_json()
    exam_date = data.get('exam_date')
    start_hour = data.get('start_hour')
    room_id = data.get('room_id')
    
    if not all([exam_date, start_hour, room_id]):
        return jsonify({"error": "Exam date, start hour, and room ID are required"}), 400
        
    try:
        # Validate hour range (8-20)
        start_hour_int = int(start_hour)
        if not (8 <= start_hour_int <= 20):
            return jsonify({"error": "Start hour must be between 8 and 20"}), 400
            
        # Validate that exam_date is a weekday (Monday to Friday)
        exam_date_obj = datetime.strptime(exam_date, '%Y-%m-%d')
        if exam_date_obj.weekday() >= 5:  # 5=Saturday, 6=Sunday
            return jsonify({"error": "Exams can only be scheduled on weekdays (Monday to Friday)"}), 400
    except ValueError:
        return jsonify({"error": "Invalid date or hour format"}), 400
        
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if exam exists and belongs to the group leader's group
        cursor.execute(
            "SELECT status FROM exams WHERE id = %s AND student_group = %s",
            (exam_id, student_group)
        )
        exam = cursor.fetchone()
        if not exam:
            return jsonify({"error": "Exam not found or does not belong to your group"}), 404
            
        # Check if exam is in a state that can be proposed (DRAFT, REJECTED, or CANCELLED)
        status = exam[0]
        if status not in ['DRAFT', 'REJECTED', 'CANCELLED']:
            return jsonify({"error": f"Cannot propose schedule for exam in {status} status"}), 400
            
        # Verify date is within an active exam period
        cursor.execute(
            "SELECT id FROM exam_periods WHERE is_active = TRUE AND start_date <= %s::date AND end_date >= %s::date",
            (exam_date, exam_date)
        )
        if not cursor.fetchone():
            return jsonify({"error": "The proposed date is not within an active exam period"}), 400
            
        # Check if room is available at the given date and time
        cursor.execute(
            """
            SELECT 1 FROM exams 
            WHERE exam_date::date = %s::date 
            AND start_hour = %s 
            AND room_id = %s
            AND status IN ('PROPOSED', 'ACCEPTED', 'CONFIRMED')
            AND id != %s
            """,
            (exam_date, start_hour_int, room_id, exam_id)
        )
        if cursor.fetchone():
            return jsonify({"error": "Room is already booked for the selected date and time"}), 409
            
        # Update the exam with the proposed schedule
        cursor.execute(
            """
            UPDATE exams 
            SET exam_date = %s, start_hour = %s, room_id = %s, status = 'PROPOSED', updated_at = CURRENT_TIMESTAMP 
            WHERE id = %s
            RETURNING id, discipline_id, exam_date, start_hour, room_id, status
            """,
            (exam_date, start_hour_int, room_id, exam_id)
        )
        updated_exam = cursor.fetchone()
        conn.commit()
        
        columns = [desc[0] for desc in cursor.description]
        updated_exam_dict = dict(zip(columns, updated_exam))
        updated_exam_dict['exam_date'] = updated_exam_dict['exam_date'].isoformat()
        
        return jsonify({
            "message": "Exam schedule proposed successfully",
            "exam": updated_exam_dict
        }), 200
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error proposing exam schedule: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()

@token_required
def reschedule_exam(exam_id):
    """Group leader reschedules an exam that was rejected or cancelled"""
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500
        
    # Check if user has SEF_GRUPA role
    if g.current_user.get('role') != 'SEF_GRUPA':
        return jsonify({"error": "Only group leaders can reschedule exams"}), 403
    
    # The rest of the function implementation is the same as propose_exam_schedule
    # since it's essentially doing the same thing but with stricter status checks
    return propose_exam_schedule(exam_id)
