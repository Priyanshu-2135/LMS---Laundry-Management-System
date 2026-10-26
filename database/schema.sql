
CREATE DATABASE IF NOT EXISTS laundry_db;
USE laundry_db;

CREATE TABLE IF NOT EXISTS customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
    service_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    price DECIMAL(10,2) NOT NULL,
    unit VARCHAR(30) NOT NULL DEFAULT 'kg',
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    pickup_date DATE,
    notes TEXT,
    status ENUM(
        'Received','Washing','Ironing',
        'Ready','Delivered','Cancelled'
    ) NOT NULL DEFAULT 'Received',
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_status ENUM('Pending','Paid') NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

CREATE TABLE IF NOT EXISTS order_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    service_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (service_id) REFERENCES services(service_id),
    CHECK (quantity > 0)
);

CREATE TABLE IF NOT EXISTS order_status_history (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    status VARCHAR(30) NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

CREATE TABLE IF NOT EXISTS payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    method VARCHAR(30) NOT NULL DEFAULT 'Cash',
    status VARCHAR(20) NOT NULL DEFAULT 'Paid',
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

INSERT INTO services (name, description, price, unit)
SELECT 'Wash & Fold', 'Regular washing and folding', 80, 'kg'
WHERE NOT EXISTS (
    SELECT 1 FROM services WHERE name = 'Wash & Fold'
);

INSERT INTO services (name, description, price, unit)
SELECT 'Wash & Iron', 'Wash, dry and iron', 120, 'kg'
WHERE NOT EXISTS (
    SELECT 1 FROM services WHERE name = 'Wash & Iron'
);

INSERT INTO services (name, description, price, unit)
SELECT 'Dry Cleaning', 'Special fabric care', 200, 'item'
WHERE NOT EXISTS (
    SELECT 1 FROM services WHERE name = 'Dry Cleaning'
);

INSERT INTO services (name, description, price, unit)
SELECT 'Iron Only', 'Ironing without washing', 40, 'item'
WHERE NOT EXISTS (
    SELECT 1 FROM services WHERE name = 'Iron Only'
);

USE laundry_db;

SELECT * FROM customers;
SELECT * FROM orders;
SELECT * FROM order_items;
SELECT * FROM order_status_history;

SELECT *
FROM order_status_history
WHERE order_id = 1
ORDER BY changed_at;

SELECT * FROM payments;
SELECT order_id, total_amount, status, payment_status
FROM orders;
