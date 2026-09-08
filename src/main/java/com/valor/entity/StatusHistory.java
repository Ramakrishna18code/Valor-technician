package com.valor.entity;
import com.valor.enums.ServiceRequestStatus;import jakarta.persistence.*;import lombok.*;
@Entity @Getter @Setter @NoArgsConstructor public class StatusHistory extends BaseEntity {
 @ManyToOne(optional=false,fetch=FetchType.LAZY) private ServiceRequest serviceRequest;
 @ManyToOne(fetch=FetchType.LAZY) private User changedBy;
 @Enumerated(EnumType.STRING) @Column(nullable=false) private ServiceRequestStatus fromStatus;
 @Enumerated(EnumType.STRING) @Column(nullable=false) private ServiceRequestStatus toStatus;
 @Column(length=1000) private String note;
}
