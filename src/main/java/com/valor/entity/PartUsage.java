package com.valor.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity @Getter @Setter @NoArgsConstructor
public class PartUsage extends BaseEntity {
  @ManyToOne(optional = false, fetch = FetchType.LAZY) private ServiceVisit serviceVisit;
  @Column(nullable = false) private String partName;
  @Column(nullable = false) private int quantity;
  private BigDecimal unitCost;
}
