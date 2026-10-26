# LaundryHub — Laundry Management System

## 1. Project Overview

LaundryHub is a web-based laundry management application developed to simplify laundry bookings, order processing, billing and payment tracking. It provides an administrative dashboard to monitor orders and manage their progress.

## 2. Objectives

- Digitize laundry order registration and tracking.
- Calculate bills automatically based on selected services and quantities.
- Maintain customer, service, order and payment records.
- Track order status throughout the laundry workflow.
- Display basic operational statistics.

## 3. Technology Stack

- **Frontend:** React, Vite, CSS
- **Backend:** Node.js, Express.js
- **Database:** MySQL
- **Development environment:** Visual Studio Code
- **Version control:** Git (if configured)

## 4. Main Features

- Laundry service catalogue and pricing
- Customer details and order booking
- Automatic price calculation
- Order status management
- Payment status recording
- Order history and status audit trail
- Dashboard statistics and popular services

## 5. System Architecture

The React frontend sends HTTP requests to the Express REST API. The backend validates requests, applies business rules and interacts with the MySQL database. The API returns results to the frontend for display.

## 6. Database Design

The database contains six tables:

1. `customers` — customer information
2. `services` — laundry services and prices
3. `orders` — order details, status and total amount
4. `order_items` — services and quantities associated with orders
5. `order_status_history` — records of order status changes
6. `payments` — recorded payment details

Primary keys and foreign keys maintain relationships between these tables.

## 7. Installation and Execution

1. Install Node.js and MySQL.
2. Execute `database/schema.sql` in MySQL Workbench.
3. Configure the backend `.env` file with local MySQL credentials.
4. In the backend directory, run `npm install` and `npm run dev`.
5. In the frontend directory, run `npm install` and `npm run dev`.
6. Open the local URL displayed by Vite, usually `http://localhost:5173`.

Keep the backend and frontend terminals running simultaneously.

## 8. Testing

The application was tested for:
- Database connectivity
- Service retrieval
- Order creation and price calculation
- Order status updates and status history
- Payment recording
- Dashboard statistics

## 9. Limitations and Future Scope

The current version is a local demonstration prototype. Future improvements include secure authentication and role-based authorization, pickup slot capacity management, customer notifications, QR-based order identification, online payment gateway integration and deployment to a hosted environment.
