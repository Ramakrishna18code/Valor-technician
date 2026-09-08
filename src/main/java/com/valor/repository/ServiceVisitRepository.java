package com.valor.repository;
import com.valor.entity.ServiceVisit;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface ServiceVisitRepository extends JpaRepository<ServiceVisit, UUID> { Optional<ServiceVisit> findByServiceRequestId(UUID requestId); }
