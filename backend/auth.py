import os
from functools import wraps
import jwt
import logging # <--- ADDED THIS LINE
from flask import request, jsonify, g, current_app
from database import get_db_connection

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        logging.debug(f"Incoming request headers: {request.headers}")
        if 'authorization' in request.headers:
            auth_header = request.headers['authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
                #logging.debug(f"Extracted token: {token}")
            else:
                logging.debug(f"Authorization header present but does not start with 'Bearer ': {auth_header}")
        else:
            logging.debug("Authorization header is missing from request.")

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        user_id = None
        email = None
        token_role = None
        
        # Attempt 1: Decode with app's SECRET_KEY (for admin users)
        try:
            secret_key = current_app.config['SECRET_KEY']
            data = jwt.decode(token, secret_key, algorithms=['HS256'])
            user_id = data.get('user_id')  # Admin token uses 'user_id'
            token_role = data.get('role')
            email = data.get('email')
            if user_id:
                # Successfully decoded admin token
                pass
            else:
                # If we don't have a user_id, this might not be an admin token
                raise jwt.PyJWTError("Not an admin token")
        except jwt.PyJWTError:
            # If it fails, it might be a Supabase token. Pass to the next try block.
            try:
                jwt_secret = os.environ.get('SUPABASE_JWT_SECRET')
                if not jwt_secret:
                    raise ValueError("SUPABASE_JWT_SECRET is not set in the environment.")
                
                data = jwt.decode(token, jwt_secret, algorithms=['HS256'], audience='authenticated')

                # Robustly extract user details from Supabase token
                user_meta = data.get('user_metadata', {})
                user_id = data.get('sub')
                email = data.get('email')
                token_role = user_meta.get('role')
                full_name = user_meta.get('full_name') or user_meta.get('name')

                # Provide a fallback for full_name if it's not in the token
                if not full_name and email:
                    full_name = email.split('@')[0].replace('.', ' ').title()
                    
            except jwt.ExpiredSignatureError:
                return jsonify({'message': 'Token has expired!'}), 401
            except (jwt.InvalidTokenError, jwt.PyJWTError):
                return jsonify({'message': 'Token is invalid!'}), 401
            except ValueError as e:
                print(f"JWT Validation error: {e}")
                return jsonify({'message': 'Server configuration error.'}), 500
        
        if not user_id:
            return jsonify({'message': 'Invalid token: missing user ID'}), 401
            
        # Always fetch the current role from the database to ensure we have the most up-to-date role
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT role, full_name, email, student_group, year_of_study FROM users WHERE id = %s", (user_id,))
            db_user = cursor.fetchone()
            logging.debug(f"token_required: Fetched db_user for user_id {user_id}: {db_user}")
            if db_user:
                # Determine if this is a sync request where we want to create the user if missing
                is_sync_request = request.path == '/api/auth/sync' and request.method == 'POST'
                
                if db_user:
                    # Use the role from the database, which is the most up-to-date
                    db_role, full_name, db_email, student_group, year_of_study = db_user
                    
                    g.current_user = {
                        'id': user_id,
                        'role': db_role,  # Use role from database, not token
                        'email': email or db_email,
                        'full_name': full_name,
                        'student_group': student_group,
                        'year_of_study': year_of_study
                    }
                    
                    # Log the role for debugging
                    print(f"[DEBUG] User {user_id} authenticated with role: {db_role} (token had: {token_role})")
                    
                    return f(*args, **kwargs)
                elif is_sync_request:
                    # Special case for sync endpoint - allow even if user not in DB
                    # We'll create the user in the sync endpoint
                    print(f"[INFO] User {user_id} not found but allowing sync request")
                    
                    g.current_user = {
                        'id': user_id,
                        'role': token_role or 'STUDENT',  # Default to STUDENT if no role
                        'email': email,
                        'full_name': full_name
                    }
                    
                    return f(*args, **kwargs)
                else:
                    # User not found in database
                    print(f"[ERROR] User {user_id} not found in database")
                    return jsonify({'message': 'User not found in database'}), 401
                    
                g.current_user = {
                    'id': user_id,
                    'role': db_role,  # Use role from database, not token
                    'email': email or db_email,
                    'full_name': full_name
                }
                
                # Log the role for debugging
                print(f"[DEBUG] User {user_id} authenticated with role: {db_role} (token had: {token_role})")
                
                return f(*args, **kwargs)
            elif is_sync_request:
                # Special case for sync endpoint - allow even if user not in DB
                # We'll create the user in the sync endpoint
                print(f"[INFO] User {user_id} not found but allowing sync request")
                
                g.current_user = {
                    'id': user_id,
                    'role': token_role or 'STUDENT',  # Default to STUDENT if no role
                    'email': email,
                    'full_name': full_name
                }
                
                return f(*args, **kwargs)
            else:
                # User not found in database
                print(f"[ERROR] User {user_id} not found in database")
                return jsonify({'message': 'User not found in database'}), 401
                
        except Exception as e:
            print(f"[ERROR] Database error in token_required: {e}")
            return jsonify({'message': 'Server error during authentication'}), 500
        finally:
            if 'conn' in locals() and conn:
                cursor.close()
                conn.close()

    return decorated


def admin_required(f):
    @wraps(f)
    @token_required
    def decorated(*args, **kwargs):
        if g.current_user.get('role') != 'ADMIN':
            return jsonify({'message': 'Requires admin access!'}), 403
        return f(*args, **kwargs)
    return decorated

def sec_required(f):
    @wraps(f)
    @token_required
    def decorated_function(*args, **kwargs):
        user_role = g.current_user.get('role')
        if user_role not in ['SEC', 'ADMIN']:
            return jsonify({'message': 'SEC or ADMIN role required'}), 403
        return f(*args, **kwargs)
    return decorated_function

def sg_required(f):
    @wraps(f)
    @token_required
    def decorated_function(*args, **kwargs):
        user_role = g.current_user.get('role')
        if user_role not in ['SEF_GRUPA', 'SG', 'ADMIN']:
            return jsonify({'message': 'SEF_GRUPA or ADMIN role required'}), 403
        return f(*args, **kwargs)
    return decorated_function

def cd_required(f):
    @wraps(f)
    @token_required
    def decorated_function(*args, **kwargs):
        user_role = g.current_user.get('role')
        if user_role not in ['CD', 'CADRU_DIDACTIC', 'ADMIN']:
            return jsonify({'message': 'Teacher (CD/CADRU_DIDACTIC) or ADMIN role required'}), 403
        return f(*args, **kwargs)
    return decorated_function
