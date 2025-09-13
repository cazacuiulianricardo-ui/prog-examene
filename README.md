# FIESC Exam Scheduler

This is a full-stack application for managing exam schedules at FIESC.

## Project Structure

-   `/frontend`: Contains the React application.
-   `/backend`: Contains the Flask API and database logic.

## Setup Instructions

### 1. PostgreSQL Installation and Configuration

1.  **Download and Install PostgreSQL:**
    *   Go to the [PostgreSQL download page](https://www.postgresql.org/download/) and download the installer for your operating system.
    *   During installation, you will be prompted to set a password for the default `postgres` user. **Remember this password.** For this project, we will assume the password is `student123` as you provided, but you should use a strong password in production.
    *   The installer will also install pgAdmin, a graphical interface for managing your databases.

2.  **Create the Database:**
    *   Open pgAdmin.
    *   Connect to your PostgreSQL server using the password you set during installation.
    *   In the object browser on the left, right-click on `Databases` and select `Create` -> `Database...`.
    *   Enter `exam` as the database name and click `Save`.

### 2. Backend Setup

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

2.  **Create a virtual environment:**
    ```bash
    python -m venv venv
    ```

3.  **Activate the virtual environment:**
    *   On Windows:
        ```bash
        .\venv\Scripts\activate
        ```
    *   On macOS/Linux:
        ```bash
        source venv/bin/activate
        ```

4.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

5.  **Configure Environment Variables:**
    *   The `backend` directory contains a `.env` file. Open it and update the `DATABASE_URL` with your PostgreSQL credentials. The format is:
        `postgresql://<user>:<password>@<host>:<port>/<database>`
    *   It should look like this with the details you provided:
        `postgresql://postgres:student123@localhost:5432/exam`

6.  **Initialize the Database:**
    *   Run the `init_db.py` script to create the necessary tables:
        ```bash
        python init_db.py
        ```

7.  **Run the Flask server:**
    ```bash
    flask run
    ```
    The backend will be running at `http://127.0.0.1:5000`.

### 3. Frontend Setup

1.  **Navigate to the frontend directory:**
    ```bash
    cd frontend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the React application:**
    ```bash
    npm start
    ```
    The frontend will open in your browser at `http://localhost:3000`.

### 4. Supabase Configuration

1.  **Google OAuth Provider:**
    *   Log in to your [Supabase dashboard](https://supabase.com/).
    *   Go to `Authentication` -> `Providers`.
    *   Enable the `Google` provider and follow the instructions to add your Google OAuth credentials (Client ID and Client Secret). You can get these from the [Google Cloud Console](https://console.cloud.google.com/).
    *   Make sure to add `http://localhost:3000` to the list of authorized redirect URIs in your Google Cloud OAuth consent screen configuration.

