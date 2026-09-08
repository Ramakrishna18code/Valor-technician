package com.valor.repository;
import com.valor.entity.ServiceRequest;
import com.valor.enums.ServiceRequestStatus;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;
public interface ServiceRequestRepository extends JpaRepository<ServiceRequest, UUID> {
 @Query("select r from ServiceRequest r join TechnicianAssignment a on a.serviceRequest=r where a.technician.id=:technicianId and r.status in :statuses order by r.createdAt desc")
 List<ServiceRequest> findAssignedTo(@Param("technicianId") UUID technicianId, @Param("statuses") Collection<ServiceRequestStatus> statuses);
 Optional<ServiceRequest> findByTicketNumber(String ticketNumber);
}
