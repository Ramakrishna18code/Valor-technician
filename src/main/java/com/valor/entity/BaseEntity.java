package com.valor.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
import java.util.UUID;

@MappedSuperclass @Getter @Setter
public abstract class BaseEntity {
  @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
  @Column(nullable = false, updatable = false) private Instant createdAt;
  @Column(nullable = false) private Instant updatedAt;
  @Version private long version;
  @PrePersist void created() { createdAt = updatedAt = Instant.now(); }
  @PreUpdate void updated() { updatedAt = Instant.now(); }
}
