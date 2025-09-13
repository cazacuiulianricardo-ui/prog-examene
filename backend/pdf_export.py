import io
import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from flask import send_file, jsonify, g
from datetime import datetime
# Import ReportLab's built-in font support
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.ttfonts import TTFont

# Flag to indicate if the database is available
DB_AVAILABLE = False

# Register fonts that support Romanian characters
# Use ReportLab's built-in Unicode support
try:
    # Register a CID font with Unicode support
    pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'))
    
    # If we have access to the system fonts directory, try to register Arial which usually has good Unicode support
    system_font_paths = [
        # Windows font paths
        'C:/Windows/Fonts/arial.ttf',
        'C:/Windows/Fonts/arialbd.ttf',
        # Linux font paths
        '/usr/share/fonts/truetype/msttcorefonts/Arial.ttf',
        '/usr/share/fonts/truetype/msttcorefonts/Arial_Bold.ttf',
    ]
    
    for font_path in system_font_paths:
        if os.path.exists(font_path):
            if 'arialbd' in font_path.lower() or 'bold' in font_path.lower():
                pdfmetrics.registerFont(TTFont('Arial-Bold', font_path))
            else:
                pdfmetrics.registerFont(TTFont('Arial', font_path))
    
    UNICODE_FONT_AVAILABLE = True
except Exception as e:
    print(f"Warning: Could not register Unicode fonts: {e}")
    # Fallback to default fonts
    UNICODE_FONT_AVAILABLE = False

def get_db_connection():
    # This function should be imported from your main app.py
    try:
        from app import get_db_connection
        return get_db_connection()
    except Exception as e:
        print(f"Error importing get_db_connection: {e}")
        raise

def export_exams_pdf():
    """
    Export confirmed exams as PDF
    """
    if not DB_AVAILABLE:
        return jsonify({"error": "Database not available"}), 500

    user_id = g.current_user.get('id')
    if not user_id:
        return jsonify({"error": "User not found in token"}), 401

    # Check if user has SEC role
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verify user is SEC or ADMIN
        cursor.execute("SELECT role FROM users WHERE id = %s", (user_id,))
        user_role = cursor.fetchone()
        if not user_role or user_role[0] not in ['SEC', 'ADMIN']:
            return jsonify({"error": "Unauthorized access"}), 403
        
        # Fetch confirmed exams with detailed information
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
            LEFT JOIN users u2 ON e.second_teacher_id = u2.id
            WHERE e.status = 'CONFIRMED'
            ORDER BY e.exam_date, e.start_hour
        """
        
        cursor.execute(query)
        exams = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        
        if not exams:
            return jsonify({"error": "No confirmed exams found"}), 404
            
        # Create PDF using ReportLab
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(A4))
        
        # Define styles with Unicode font support
        styles = getSampleStyleSheet()
        title_style = styles['Heading1']
        title_style.alignment = 1  # Center alignment
        
        # Use Unicode-compatible font if available
        if UNICODE_FONT_AVAILABLE:
            # Try to use Arial if available (good Unicode support on Windows)
            if os.path.exists('C:/Windows/Fonts/arialbd.ttf'):
                title_style.fontName = 'Arial-Bold'
                for style_name in styles.byName:
                    styles[style_name].fontName = 'Arial'
            else:
                # Use STSong-Light as fallback (built-in CID font with Unicode support)
                title_style.fontName = 'STSong-Light'
                for style_name in styles.byName:
                    styles[style_name].fontName = 'STSong-Light'
        
        # Create title
        title = Paragraph("Examene", title_style)
        
        # Create subtitle with current date
        date_style = ParagraphStyle(
            'DateStyle', 
            parent=styles['Normal'],
            alignment=1,
            spaceAfter=20
        )
        current_date = datetime.now().strftime("%Y-%m-%d")
        subtitle = Paragraph(f"Generat la data {current_date}", date_style)
        
        # Define table headers
        headers = ['Disciplina', 'Tip', 'Grupă', 'Data', 'Oră', 'Sala', 'Profesor 1', 'Profesor 2']
        
        # Prepare data for table
        data = [headers]
        for exam in exams:
            # Convert tuple to dictionary for easier access
            exam_dict = dict(zip(columns, exam))
            
            # Format date
            date_str = ''
            if exam_dict['exam_date']:
                date_str = exam_dict['exam_date'].strftime('%Y-%m-%d')
                
            # Format time as HH.00
            time_str = ''
            if exam_dict['start_hour']:
                time_str = f"{exam_dict['start_hour']}.00"
            
            row = [
                exam_dict['discipline_name'],
                exam_dict['exam_type'],
                exam_dict['student_group'],
                date_str,
                time_str,
                exam_dict['room_name'] or '',
                exam_dict['main_teacher'] or '',
                exam_dict['second_teacher'] or ''
            ]
            data.append(row)
        
        # Create table
        table = Table(data, repeatRows=1)
        
        # Style the table
        # Use Unicode-compatible fonts if available
        header_font = 'Helvetica-Bold'
        body_font = 'Helvetica'
        
        if UNICODE_FONT_AVAILABLE:
            # Try to use Arial if available (good Unicode support on Windows)
            if os.path.exists('C:/Windows/Fonts/arialbd.ttf'):
                header_font = 'Arial-Bold'
                body_font = 'Arial'
            else:
                # Use STSong-Light as fallback (built-in CID font with Unicode support)
                header_font = 'STSong-Light'
                body_font = 'STSong-Light'
        
        table_style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), header_font),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 1), (-1, -1), body_font),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ])
        
        # Add zebra striping
        for i in range(1, len(data), 2):
            table_style.add('BACKGROUND', (0, i), (-1, i), colors.lightgrey)
            
        table.setStyle(table_style)
        
        # Build PDF
        elements = [title, subtitle, table]
        doc.build(elements)
        
        # Prepare response
        buffer.seek(0)
        
        return send_file(
            buffer,
            download_name=f"programare_{current_date}.pdf",
            as_attachment=True,
            mimetype='application/pdf'
        )
        
    except Exception as e:
        print(f"Error exporting exams to PDF: {e}")
        import traceback
        traceback.print_exc()
        # More detailed error message for debugging
        error_msg = str(e)
        return jsonify({"error": f"An internal error occurred: {error_msg}"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()
