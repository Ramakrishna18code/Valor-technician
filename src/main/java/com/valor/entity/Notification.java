package com.valor.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Getter @Setter @NoArgsConstructor
public class Notification extends BaseEntity {
  @ManyToOne(optional = false, fetch = FetchType.LAZY) private User recipient;
  @Column(nullable = false) private String title;
  @Column(nullable = false, length = 1500) private String body;
  private Instant readAt;
  @Column(length = 100) private String referenceType;
  @Column(length = 100) private String referenceId;
}
