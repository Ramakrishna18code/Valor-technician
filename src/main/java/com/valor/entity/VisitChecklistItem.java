package com.valor.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity @Getter @Setter @NoArgsConstructor
public class VisitChecklistItem extends BaseEntity {
  @ManyToOne(optional = false, fetch = FetchType.LAZY) private ServiceVisit serviceVisit;
  @Column(nullable = false) private String label;
  @Column(nullable = false) private boolean completed;
  @Column(length = 500) private String note;
}
