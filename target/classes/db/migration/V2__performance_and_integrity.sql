CREATE INDEX idx_service_request_customer_status ON service_request (customer_id, status);
CREATE INDEX idx_service_request_status_created ON service_request (status, created_at);
CREATE INDEX idx_assignment_technician_request ON technician_assignment (technician_id, service_request_id);
CREATE INDEX idx_notification_recipient_read ON notification (recipient_id, read_at);
CREATE INDEX idx_status_history_request_created ON status_history (service_request_id, created_at);

ALTER TABLE attachment
  ADD CONSTRAINT chk_attachment_owner CHECK (service_request_id IS NOT NULL OR service_visit_id IS NOT NULL);

ALTER TABLE part_usage
  ADD CONSTRAINT chk_part_quantity CHECK (quantity > 0);