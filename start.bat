@echo off
title The Smart Online Ticket Booking System
echo ======================================================
echo  The Smart Online Ticket Booking System
echo ======================================================
echo.
echo [1/2] Checking SQLite database...
if not exist "database\smart_tickets.db" (
    echo Initializing database schema and seed data...
    node database\init-db.js
)

echo.
echo [2/2] Starting Node.js backend server...
echo Serving frontend and dynamic REST APIs...
echo.
echo Access the live application at:
echo http://localhost:5000
echo.
node backend\server.js
pause
