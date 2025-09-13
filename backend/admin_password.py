import psycopg2
from flask import jsonify, request, g
from werkzeug.security import generate_password_hash

# Flag to indicate if the database is available
DB_AVAILABLE = False

def get_db_connection():
    # This function should be imported from your main app.py
    from app import get_db_connection
    return get_db_connection()

def change_admin_password():
    """
    Change the password for the admin user (admin@local.com)
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
        cursor.execute("SELECT role FROM users WHERE id = %s", (user_id,))
        user_role = cursor.fetchone()
        if not user_role or user_role[0] != 'ADMIN':
            return jsonify({"error": "Unauthorized access"}), 403
        
        # Get request data
        data = request.get_json()
        if not data or not data.get('current_password') or not data.get('new_password'):
            return jsonify({"error": "Missing required fields"}), 400
        
        current_password = data.get('current_password')
        new_password = data.get('new_password')
        
        # Verify current password for admin@local.com
        cursor.execute("SELECT id, password_hash FROM users WHERE email = 'admin@local.com'")
        admin_user = cursor.fetchone()
        if not admin_user:
            return jsonify({"error": "Admin user not found"}), 404
        
        admin_id, password_hash = admin_user
        
        # Verify current password
        from werkzeug.security import check_password_hash
        if not check_password_hash(password_hash, current_password):
            return jsonify({"error": "Current password is incorrect"}), 401
        
        # Update password
        new_password_hash = generate_password_hash(new_password)
        cursor.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_password_hash, admin_id))
        conn.commit()
        
        return jsonify({"message": "Password updated successfully"}), 200
        
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error changing admin password: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "An internal error occurred"}), 500
    finally:
        if conn:
            cursor.close()
            conn.close()
