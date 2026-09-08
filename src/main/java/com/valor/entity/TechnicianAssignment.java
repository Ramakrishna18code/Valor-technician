package com.valor.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Getter @Setter @NoArgsConstructor
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"serviceRequest_id", "technician_id"}))
public class TechnicianAssignment extends BaseEntity {
  @ManyToOne(optional = false, fetch = FetchType.LAZY) private ServiceRequest serviceRequest;
  @ManyToOne(optional = false, fetch = FetchType.LAZY) private User technician;
  @ManyToOne(fetch = FetchType.LAZY) private User assignedBy;
  @Column(nullable = false) private Instant assignedAt = Instant.now();
  private Instant acceptedAt;
  private Instant arrivedAt;
}
