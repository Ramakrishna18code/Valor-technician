package com.valor.repository;
import com.valor.entity.TechnicianAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface TechnicianAssignmentRepository extends JpaRepository<TechnicianAssignment, UUID> { Optional<TechnicianAssignment> findByServiceRequestIdAndTechnicianId(UUID requestId, UUID technicianId); }
