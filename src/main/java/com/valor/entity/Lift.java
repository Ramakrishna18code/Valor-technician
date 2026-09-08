package com.valor.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity @Getter @Setter @NoArgsConstructor
@Table(uniqueConstraints = @UniqueConstraint(columnNames = "liftNumber"))
public class Lift extends BaseEntity {
  @ManyToOne(optional = false, fetch = FetchType.LAZY) private User customer;
  @Column(nullable = false, length = 64) private String liftNumber;
  @Column(nullable = false, length = 140) private String buildingName;
  @Column(nullable = false, length = 500) private String address;
  @Column(length = 100) private String manufacturer;
  @Column(length = 100) private String model;
}
