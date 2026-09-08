package com.valor.entity;

import com.valor.enums.AttachmentType;
import jakarta.persistence.*;
import lombok.*;

@Entity @Getter @Setter @NoArgsConstructor
public class Attachment extends BaseEntity {
  @ManyToOne(fetch = FetchType.LAZY) private ServiceRequest serviceRequest;
  @ManyToOne(fetch = FetchType.LAZY) private ServiceVisit serviceVisit;
  @Enumerated(EnumType.STRING) @Column(nullable = false) private AttachmentType type;
  @Column(nullable = false) private String storageKey;
  @Column(nullable = false) private String originalFilename;
  @Column(nullable = false) private String contentType;
  @Column(nullable = false) private long sizeBytes;
}
