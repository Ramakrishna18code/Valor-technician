package com.valor.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Getter @Setter @NoArgsConstructor
public class ServiceVisit extends BaseEntity {
  @OneToOne(optional = false, fetch = FetchType.LAZY) private ServiceRequest serviceRequest;
  @ManyToOne(optional = false, fetch = FetchType.LAZY) private User technician;
  private Instant startedAt;
  private Instant endedAt;
  @Column(length = 4000) private String diagnosis;
  @Column(length = 4000) private String serviceReport;
  @Lob private String customerSignaturePath;
}
