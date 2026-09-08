package com.valor.entity;

import com.valor.enums.*;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Getter @Setter @NoArgsConstructor
public class ServiceRequest extends BaseEntity {
  @Column(nullable = false, unique = true, length = 40) private String ticketNumber;
  @ManyToOne(optional = false, fetch = FetchType.LAZY) private User customer;
  @ManyToOne(optional = false, fetch = FetchType.LAZY) private Lift lift;
  @Enumerated(EnumType.STRING) @Column(nullable = false) private ServiceRequestStatus status = ServiceRequestStatus.OPEN;
  @Enumerated(EnumType.STRING) @Column(nullable = false) private Priority priority = Priority.NORMAL;
  @Column(nullable = false, length = 120) private String issueType;
  @Column(length = 3000) private String description;
  private Instant preferredVisitAt;
  private Instant completedAt;
}
