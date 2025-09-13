"""
Secretariat (SEC) role endpoints for the exam scheduling system.
These endpoints will be imported into the main app.py file.
"""

from flask import jsonify, request, g
from database import get_db_connection
from auth import token_required
import pandas as pd
from io import BytesIO
import datetime
# Import DB_AVAILABLE from app.py when this module is imported
DB_AVAILABLE = None

# --- SEC Role Endpoints ---

@token_required
def create_exam():
    """SEC creates an exam and assigns it to a group leader's student group"""
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500
        
    # Check if user has SEC or ADM role
    if g.current_user.get('role') not in ['SEC', 'ADM']:
        return jsonify({"error": "Only SEC or ADM can create exams"}), 403
        
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['discipline_id', 'student_group', 'exam_type', 'main_teacher_id', 'second_teacher_id', 'room_id']
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400
            
    # Validate exam type
    if data['exam_type'] not in ['EXAM', 'PROJECT']:
        return jsonify({"error": "Exam type must be 'EXAM' or 'PROJECT'"}), 400
        
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if discipline exists
        cursor.execute("SELECT id FROM disciplines WHERE id = %s", (data['discipline_id'],))
        if not cursor.fetchone():
            return jsonify({"error": "Discipline not found"}), 404
            
        # Check if teachers exist
        for teacher_field in ['main_teacher_id', 'second_teacher_id']:
            cursor.execute("SELECT id FROM users WHERE id = %s AND role = 'CADRU_DIDACTIC'", (data[teacher_field],))
            if not cursor.fetchone():
                return jsonify({"error": f"Teacher with ID {data[teacher_field]} not found or is not a teacher"}), 404
                
        # Check if room exists
        cursor.execute("SELECT id FROM rooms WHERE id = %s", (data['room_id'],))
        if not cursor.fetchone():
            return jsonify({"error": f"Room with ID {data['room_id']} not found"}), 404
                
        # Check if an exam for this discipline and group already exists
        cursor.execute(
            """SELECT id FROM exams 
            WHERE discipline_id = %s AND student_group = %s""",
            (data['discipline_id'], data['student_group'])
        )
        if cursor.fetchone():
            return jsonify({"error": "An exam for this discipline and student group already exists"}), 409
            
        # Insert the new exam
        cursor.execute(
            """
            INSERT INTO exams (
                discipline_id, student_group, exam_type, 
                main_teacher_id, second_teacher_id, status,
                created_by, created_at, room_id
            )
            VALUES (%s, %s, %s, %s, %s, 'DRAFT', %s, CURRENT_TIMESTAMP, %s)
            RETURNING id
            """,
            (
                data['discipline_id'], data['student_group'], data['exam_type'],
                data['main_teacher_id'], data['second_teacher_id'], g.current_user.get('id'),
                data['room_id']
            )
        )
        new_exam_id = cursor.fetchone()[0]
        conn.commit()
        
        return jsonify({
            "message": "Exam created successfully",
            "exam_id": new_exam_id
        }), 201
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error creating exam: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()

@token_required
def get_all_exams():
    """SEC gets all exams in the system"""
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500
        
    # Check if user has SEC or ADM role
    if g.current_user.get('role') not in ['SEC', 'ADM']:
        return jsonify({"error": "Only SEC or ADM can view all exams"}), 403
        
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
                u1.full_name as main_teacher_name,
                u2.full_name as second_teacher_name,
                e.created_at,
                e.updated_at
            FROM exams e
            JOIN disciplines d ON e.discipline_id = d.id
            LEFT JOIN rooms r ON e.room_id = r.id
            JOIN users u1 ON e.main_teacher_id = u1.id
            JOIN users u2 ON e.second_teacher_id = u2.id
            ORDER BY e.status, e.exam_date, e.start_hour
        """
        cursor.execute(query)
        exams = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        exams_dict = [dict(zip(columns, row)) for row in exams]
        
        for exam in exams_dict:
            if exam.get('exam_date'):
                exam['exam_date'] = exam['exam_date'].isoformat()
            if exam.get('created_at'):
                exam['created_at'] = exam['created_at'].isoformat()
            if exam.get('updated_at') and exam['updated_at'] is not None:
                exam['updated_at'] = exam['updated_at'].isoformat()
        
        return jsonify(exams_dict), 200
    except Exception as e:
        print(f"Error fetching all exams: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()

@token_required
def export_exams_excel():
    """SEC exports confirmed exams to Excel"""
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500
        
    # Check if user has SEC or ADM role
    if g.current_user.get('role') not in ['SEC', 'ADM']:
        return jsonify({"error": "Only SEC or ADM can export exams"}), 403
        
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
                r.name as room_name,
                u1.full_name as main_teacher,
                u2.full_name as second_teacher
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
        
        # Create DataFrame
        df = pd.DataFrame(exams, columns=columns)
        
        # Format date and time columns separately
        if 'exam_date' in df.columns and not df.empty:
            df['exam_date'] = df['exam_date'].apply(lambda x: x.strftime('%Y-%m-%d') if x else '')
            
        # Format time as HH.00
        if 'start_hour' in df.columns and not df.empty:
            df['start_hour'] = df['start_hour'].apply(lambda x: f"{x}.00" if x else '')
            
        # Rename columns for better readability
        column_mapping = {
            'discipline_name': 'Disciplina',
            'exam_type': 'Tip',
            'student_group': 'Grupă',
            'exam_date': 'Data',
            'start_hour': 'Oră',
            'room_name': 'Sală',
            'main_teacher': 'Profesor 1',
            'second_teacher': 'Profesor 2'
        }
        df.rename(columns=column_mapping, inplace=True)
        
        # Create Excel file
        output = BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            # Add title sheet with export information
            workbook = writer.book
            title_sheet = workbook.add_worksheet('Info')
            
            # Add formatting
            header_format = workbook.add_format({
                'bold': True,
                'font_color': 'white',
                'bg_color': '#4472C4',
                'border': 1,
                'align': 'center',
                'valign': 'vcenter'
            })
            
            title_format = workbook.add_format({
                'bold': True,
                'font_size': 16,
                'align': 'center',
                'valign': 'vcenter'
            })
            
            info_format = workbook.add_format({
                'align': 'left',
                'valign': 'vcenter'
            })
            
            # Add title and export information
            title_sheet.merge_range('A1:D1', 'FIESC Programare examene', title_format)
            title_sheet.write('A3', 'Dată export:', info_format)
            title_sheet.write('B3', datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'), info_format)
            title_sheet.write('A4', 'Total examene:', info_format)
            title_sheet.write('B4', len(df), info_format)
            title_sheet.write('A5', 'Generat de:', info_format)
            title_sheet.write('B5', g.current_user.get('email', 'Unknown'), info_format)
            
            # Set column widths for info sheet
            title_sheet.set_column('A:A', 15)
            title_sheet.set_column('B:B', 25)
            
            # Write the main data
            df.to_excel(writer, sheet_name='Exams', index=False, startrow=1)
            
            # Get the worksheet and apply formatting
            worksheet = writer.sheets['Exams']
            
            # Write a title for the exams sheet
            worksheet.merge_range('A1:K1', 'Programare examene', title_format)
            
            # Write headers with formatting
            for col_num, value in enumerate(df.columns.values):
                worksheet.write(1, col_num, value, header_format)
            
            # Auto-adjust columns' width
            for i, col in enumerate(df.columns):
                # Find the maximum length of the column
                max_len = max(
                    df[col].astype(str).map(len).max(),  # max length of column data
                    len(str(col))  # length of column name
                ) + 2  # adding a little extra space
                worksheet.set_column(i, i, max_len)
        
        output.seek(0)
        
        # Return Excel file
        filename = f"exams_export_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        return output.getvalue(), 200, {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': f'attachment; filename={filename}'
        }
    except Exception as e:
        print(f"Error exporting exams to Excel: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()

@token_required
def manage_exam_periods():
    """SEC creates or updates exam periods"""
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500
        
    # Check if user has SEC or ADM role
    if g.current_user.get('role') not in ['SEC', 'ADM']:
        return jsonify({"error": "Only SEC or ADM can manage exam periods"}), 403
        
    data = request.get_json()
    action = data.get('action')
    
    if not action:
        return jsonify({"error": "Action is required"}), 400
        
    if action not in ['CREATE', 'UPDATE', 'DELETE']:
        return jsonify({"error": "Invalid action. Must be 'CREATE', 'UPDATE', or 'DELETE'"}), 400
        
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if action == 'CREATE':
            # Validate required fields
            required_fields = ['name', 'start_date', 'end_date']
            for field in required_fields:
                if field not in data:
                    return jsonify({"error": f"Missing required field: {field}"}), 400
                    
            # Validate dates
            start_date = datetime.datetime.fromisoformat(data['start_date']).date()
            end_date = datetime.datetime.fromisoformat(data['end_date']).date()
            
            if start_date > end_date:
                return jsonify({"error": "Start date must be before end date"}), 400
                
            # Check for overlapping periods
            cursor.execute(
                """
                SELECT id FROM exam_periods 
                WHERE (start_date <= %s AND end_date >= %s)
                OR (start_date <= %s AND end_date >= %s)
                OR (start_date >= %s AND end_date <= %s)
                """,
                (end_date, start_date, end_date, start_date, start_date, end_date)
            )
            if cursor.fetchone():
                return jsonify({"error": "Exam period overlaps with an existing period"}), 409
                
            # Insert new period
            cursor.execute(
                """
                INSERT INTO exam_periods (name, start_date, end_date, created_by)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (data['name'], start_date, end_date, g.current_user.get('id'))
            )
            new_period_id = cursor.fetchone()[0]
            conn.commit()
            
            return jsonify({
                "message": "Exam period created successfully",
                "period_id": new_period_id
            }), 201
            
        elif action == 'UPDATE':
            # Validate required fields
            if 'id' not in data:
                return jsonify({"error": "Period ID is required for update"}), 400
                
            # Check if period exists
            cursor.execute("SELECT id FROM exam_periods WHERE id = %s", (data['id'],))
            if not cursor.fetchone():
                return jsonify({"error": "Exam period not found"}), 404
                
            # Build update query
            update_fields = []
            params = []
            
            if 'name' in data:
                update_fields.append("name = %s")
                params.append(data['name'])
                
            if 'start_date' in data:
                update_fields.append("start_date = %s")
                params.append(datetime.datetime.fromisoformat(data['start_date']).date())
                
            if 'end_date' in data:
                update_fields.append("end_date = %s")
                params.append(datetime.datetime.fromisoformat(data['end_date']).date())
                
            if not update_fields:
                return jsonify({"error": "No fields to update"}), 400
                
            # Add the ID parameter
            params.append(data['id'])
            
            # Update the period
            cursor.execute(
                f"""
                UPDATE exam_periods 
                SET {', '.join(update_fields)}, updated_at = CURRENT_TIMESTAMP 
                WHERE id = %s
                RETURNING id
                """,
                params
            )
            conn.commit()
            
            return jsonify({
                "message": "Exam period updated successfully",
                "period_id": data['id']
            }), 200
            
        elif action == 'DELETE':
            # Validate required fields
            if 'id' not in data:
                return jsonify({"error": "Period ID is required for deletion"}), 400
                
            # Check if period exists
            cursor.execute("SELECT id FROM exam_periods WHERE id = %s", (data['id'],))
            if not cursor.fetchone():
                return jsonify({"error": "Exam period not found"}), 404
                
            # Check if there are exams scheduled during this period
            cursor.execute(
                """
                SELECT COUNT(*) FROM exams e
                JOIN exam_periods p ON e.exam_date BETWEEN p.start_date AND p.end_date
                WHERE p.id = %s
                """,
                (data['id'],)
            )
            if cursor.fetchone()[0] > 0:
                return jsonify({"error": "Cannot delete exam period with scheduled exams"}), 409
                
            # Delete the period
            cursor.execute("DELETE FROM exam_periods WHERE id = %s", (data['id'],))
            conn.commit()
            
            return jsonify({
                "message": "Exam period deleted successfully"
            }), 200
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error managing exam periods: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()

@token_required
def get_exam_periods():
    """Get all exam periods"""
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500
        
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            """
            SELECT id, name, start_date, end_date, created_at, updated_at
            FROM exam_periods
            ORDER BY start_date DESC
            """
        )
        periods = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        periods_dict = [dict(zip(columns, row)) for row in periods]
        
        for period in periods_dict:
            if period.get('start_date'):
                period['start_date'] = period['start_date'].isoformat()
            if period.get('end_date'):
                period['end_date'] = period['end_date'].isoformat()
            if period.get('created_at'):
                period['created_at'] = period['created_at'].isoformat()
            if period.get('updated_at') and period['updated_at'] is not None:
                period['updated_at'] = period['updated_at'].isoformat()
        
        return jsonify(periods_dict), 200
    except Exception as e:
        print(f"Error fetching exam periods: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()

@token_required
def get_sec_disciplines():
    """Return list of all disciplines (id, name, year_of_study, specialization)"""
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500

    # Only SEC or ADM can access
    if g.current_user.get('role') not in ['SEC', 'ADM']:
        return jsonify({"error": "Only SEC or ADM can view disciplines"}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, year_of_study, specialization FROM disciplines ORDER BY name")
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        disciplines = [dict(zip(columns, row)) for row in rows]
        return jsonify(disciplines), 200
    except Exception as e:
        print(f"Error fetching disciplines for SEC: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()

@token_required
def get_sec_teachers():
    """Return list of all teachers (id, full_name, email)"""
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500

    if g.current_user.get('role') not in ['SEC', 'ADM']:
        return jsonify({"error": "Only SEC or ADM can view teachers"}), 403

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, full_name, email FROM users WHERE role = 'CADRU_DIDACTIC' ORDER BY full_name")
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        teachers = [dict(zip(columns, row)) for row in rows]
        return jsonify(teachers), 200
    except Exception as e:
        print(f"Error fetching teachers for SEC: {e}")
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()
