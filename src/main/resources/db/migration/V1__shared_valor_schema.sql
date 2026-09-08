CREATE TABLE users (
  id BINARY(16) PRIMARY KEY, created_at TIMESTAMP(6) NOT NULL, updated_at TIMESTAMP(6) NOT NULL, version BIGINT NOT NULL,
  full_name VARCHAR(120) NOT NULL, email VARCHAR(190) NOT NULL, password_hash VARCHAR(255) NOT NULL, phone VARCHAR(25),
  role VARCHAR(20) NOT NULL, enabled BOOLEAN NOT NULL, employee_code VARCHAR(80), UNIQUE KEY uk_users_email (email)
);
CREATE TABLE lift (
  id BINARY(16) PRIMARY KEY, created_at TIMESTAMP(6) NOT NULL, updated_at TIMESTAMP(6) NOT NULL, version BIGINT NOT NULL,
  customer_id BINARY(16) NOT NULL, lift_number VARCHAR(64) NOT NULL, building_name VARCHAR(140) NOT NULL, address VARCHAR(500) NOT NULL,
  manufacturer VARCHAR(100), model VARCHAR(100), UNIQUE KEY uk_lift_number (lift_number), CONSTRAINT fk_lift_customer FOREIGN KEY (customer_id) REFERENCES users(id)
);
CREATE TABLE service_request (
  id BINARY(16) PRIMARY KEY, created_at TIMESTAMP(6) NOT NULL, updated_at TIMESTAMP(6) NOT NULL, version BIGINT NOT NULL,
  ticket_number VARCHAR(40) NOT NULL, customer_id BINARY(16) NOT NULL, lift_id BINARY(16) NOT NULL, status VARCHAR(32) NOT NULL,
  priority VARCHAR(20) NOT NULL, issue_type VARCHAR(120) NOT NULL, description VARCHAR(3000), preferred_visit_at TIMESTAMP(6), completed_at TIMESTAMP(6),
  UNIQUE KEY uk_ticket_number (ticket_number), CONSTRAINT fk_request_customer FOREIGN KEY (customer_id) REFERENCES users(id), CONSTRAINT fk_request_lift FOREIGN KEY (lift_id) REFERENCES lift(id)
);
CREATE TABLE technician_assignment (
  id BINARY(16) PRIMARY KEY, created_at TIMESTAMP(6) NOT NULL, updated_at TIMESTAMP(6) NOT NULL, version BIGINT NOT NULL,
  service_request_id BINARY(16) NOT NULL, technician_id BINARY(16) NOT NULL, assigned_by_id BINARY(16), assigned_at TIMESTAMP(6) NOT NULL, accepted_at TIMESTAMP(6), arrived_at TIMESTAMP(6),
  UNIQUE KEY uk_request_technician (service_request_id, technician_id), CONSTRAINT fk_assignment_request FOREIGN KEY (service_request_id) REFERENCES service_request(id), CONSTRAINT fk_assignment_tech FOREIGN KEY (technician_id) REFERENCES users(id), CONSTRAINT fk_assignment_admin FOREIGN KEY (assigned_by_id) REFERENCES users(id)
);
CREATE TABLE service_visit (
  id BINARY(16) PRIMARY KEY, created_at TIMESTAMP(6) NOT NULL, updated_at TIMESTAMP(6) NOT NULL, version BIGINT NOT NULL,
  service_request_id BINARY(16) NOT NULL, technician_id BINARY(16) NOT NULL, started_at TIMESTAMP(6), ended_at TIMESTAMP(6), diagnosis VARCHAR(4000), service_report VARCHAR(4000), customer_signature_path LONGTEXT,
  UNIQUE KEY uk_visit_request (service_request_id), CONSTRAINT fk_visit_request FOREIGN KEY (service_request_id) REFERENCES service_request(id), CONSTRAINT fk_visit_tech FOREIGN KEY (technician_id) REFERENCES users(id)
);
CREATE TABLE visit_checklist_item (id BINARY(16) PRIMARY KEY, created_at TIMESTAMP(6) NOT NULL, updated_at TIMESTAMP(6) NOT NULL, version BIGINT NOT NULL, service_visit_id BINARY(16) NOT NULL, label VARCHAR(255) NOT NULL, completed BOOLEAN NOT NULL, note VARCHAR(500), CONSTRAINT fk_checklist_visit FOREIGN KEY (service_visit_id) REFERENCES service_visit(id));
CREATE TABLE part_usage (id BINARY(16) PRIMARY KEY, created_at TIMESTAMP(6) NOT NULL, updated_at TIMESTAMP(6) NOT NULL, version BIGINT NOT NULL, service_visit_id BINARY(16) NOT NULL, part_name VARCHAR(255) NOT NULL, quantity INT NOT NULL, unit_cost DECIMAL(38,2), CONSTRAINT fk_part_visit FOREIGN KEY (service_visit_id) REFERENCES service_visit(id));
CREATE TABLE attachment (id BINARY(16) PRIMARY KEY, created_at TIMESTAMP(6) NOT NULL, updated_at TIMESTAMP(6) NOT NULL, version BIGINT NOT NULL, service_request_id BINARY(16), service_visit_id BINARY(16), type VARCHAR(32) NOT NULL, storage_key VARCHAR(255) NOT NULL, original_filename VARCHAR(255) NOT NULL, content_type VARCHAR(255) NOT NULL, size_bytes BIGINT NOT NULL, CONSTRAINT fk_attachment_request FOREIGN KEY (service_request_id) REFERENCES service_request(id), CONSTRAINT fk_attachment_visit FOREIGN KEY (service_visit_id) REFERENCES service_visit(id));
CREATE TABLE notification (id BINARY(16) PRIMARY KEY, created_at TIMESTAMP(6) NOT NULL, updated_at TIMESTAMP(6) NOT NULL, version BIGINT NOT NULL, recipient_id BINARY(16) NOT NULL, title VARCHAR(255) NOT NULL, body VARCHAR(1500) NOT NULL, read_at TIMESTAMP(6), reference_type VARCHAR(100), reference_id VARCHAR(100), CONSTRAINT fk_notification_recipient FOREIGN KEY (recipient_id) REFERENCES users(id));
CREATE TABLE status_history (id BINARY(16) PRIMARY KEY, created_at TIMESTAMP(6) NOT NULL, updated_at TIMESTAMP(6) NOT NULL, version BIGINT NOT NULL, service_request_id BINARY(16) NOT NULL, changed_by_id BINARY(16), from_status VARCHAR(32) NOT NULL, to_status VARCHAR(32) NOT NULL, note VARCHAR(1000), CONSTRAINT fk_history_request FOREIGN KEY (service_request_id) REFERENCES service_request(id), CONSTRAINT fk_history_user FOREIGN KEY (changed_by_id) REFERENCES users(id));
