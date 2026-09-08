package com.valor.dto.technician;
import com.valor.enums.*;
import jakarta.validation.constraints.*;
import com.fasterxml.jackson.annotation.JsonAlias;
import java.time.Instant;
import java.util.*;
public final class TechnicianDtos { private TechnicianDtos() {}
 public record Dashboard(long assigned, long pending, long inProgress, long completed, long emergency) {}
 public record JobSummary(UUID id,String ticketNumber,String customerName,String buildingName,String liftNumber,String issueType,Priority priority,ServiceRequestStatus status,Instant scheduledAt) {}
 public record JobDetail(UUID id,String ticketNumber,ServiceRequestStatus status,Priority priority,String customerName,String customerPhone,String buildingName,String liftNumber,String address,String issueType,String description,Instant scheduledAt) {}
 public record UpdateStatusRequest(@NotNull ServiceRequestStatus status,@JsonAlias("notes") @Size(max=1000) String note) {}
 public record DiagnosisRequest(@NotBlank @Size(max=4000) String diagnosis) {}
 public record ReportRequest(@NotBlank @Size(max=4000) String report, String signatureStorageKey) {}
}
