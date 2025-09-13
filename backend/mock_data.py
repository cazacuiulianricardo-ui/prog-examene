# Mock data to be used if the database connection fails

MOCK_USERS = [
    {"id": 1, "name": "Secretariat User", "email": "sec@usm.ro", "role": "SEC"},
    {"id": 2, "name": "Group Leader User", "email": "sg@student.usv.ro", "role": "SG"},
    {"id": 3, "name": "Teacher User", "email": "cd@usm.ro", "role": "CD"},
    {"id": 4, "name": "Admin User", "email": "admin@app.local", "role": "ADM"},
]

MOCK_EXAMS = [
    {
        "id": 101, 
        "discipline": "Software Engineering", 
        "status": "approved", 
        "date": "2025-06-20T10:00:00",
        "room": "E301"
    },
    {
        "id": 102, 
        "discipline": "Databases", 
        "status": "pending_approval", 
        "date": "2025-06-22T14:00:00",
        "room": None
    },
]
