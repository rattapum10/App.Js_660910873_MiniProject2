\# SmartTransit



SmartTransit is a web-based transportation booking application.



\## Features



\- User registration and login

\- JWT-based authentication

\- Browse available trips

\- Create and view bookings

\- Cancel bookings

\- SQLite database for users, trips, and bookings



\## Requirements



\- Node.js 22.13 or later with built-in `node:sqlite` support

\- npm



\## Local setup



1\. Open a terminal in the `SmartTransit` directory.

2\. Install backend dependencies:



&#x20;  ```powershell

&#x20;  cd backend

&#x20;  npm install

&#x20;  ```



3\. Create a `.env` file in the `SmartTransit` directory. Configure the required `JWT\_SECRET` with a securely generated random secret of at least 64 characters.

4\. Start the application:



&#x20;  ```powershell

&#x20;  npm start

&#x20;  ```



5\. Open `http://localhost:3000` in your browser.



\## Database



The application uses SQLite. The database is initialized by `database/db.js`, which creates the required tables and inserts default trips when they are missing.



\*\*Important:\*\* Back up the database before making changes. Do not commit `.env` files, database files, or credentials to version control.



\## Deployment notes



The current application uses SQLite and stores data on the server's filesystem. Before deploying to a hosting provider with an ephemeral filesystem, migrate to a persistent database or verify that durable storage is available. Otherwise, bookings and account data may be lost when the service restarts or is redeployed.



\## Security



\- Keep `JWT\_SECRET` private.

\- Use HTTPS in production.

\- Configure allowed CORS origins for the production domain.

\- Use persistent storage and regular backups for production data.
