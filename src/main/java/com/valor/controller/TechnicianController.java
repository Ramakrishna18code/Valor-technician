package com.valor.controller;
import com.valor.dto.technician.TechnicianDtos.*;import com.valor.entity.User;import com.valor.service.TechnicianService;import jakarta.validation.Valid;import org.springframework.security.access.prepost.PreAuthorize;import org.springframework.security.core.annotation.AuthenticationPrincipal;import org.springframework.web.bind.annotation.*;import java.util.*;
@RestController @RequestMapping({"/api/v1/technician", "/api/technician"}) @PreAuthorize("hasRole('TECHNICIAN')") public class TechnicianController {
 private final TechnicianService service;public TechnicianController(TechnicianService service){this.service=service;}
 @GetMapping("/dashboard") Dashboard dashboard(@AuthenticationPrincipal User technician){return service.dashboard(technician.getId());}
 @GetMapping("/jobs") List<JobSummary> jobs(@AuthenticationPrincipal User technician){return service.jobs(technician.getId());}
 @GetMapping("/jobs/{id}") JobDetail job(@AuthenticationPrincipal User technician,@PathVariable UUID id){return service.job(technician.getId(),id);}
 @PostMapping("/jobs/{id}/accept") JobSummary accept(@AuthenticationPrincipal User technician,@PathVariable UUID id){return service.accept(technician.getId(),id);}
 @RequestMapping(value="/jobs/{id}/status", method={RequestMethod.PATCH,RequestMethod.POST}) JobSummary status(@AuthenticationPrincipal User technician,@PathVariable UUID id,@Valid @RequestBody UpdateStatusRequest request){return service.updateStatus(technician.getId(),id,request);}
 @PutMapping("/jobs/{id}/diagnosis") void diagnosis(@AuthenticationPrincipal User technician,@PathVariable UUID id,@Valid @RequestBody DiagnosisRequest request){service.saveDiagnosis(technician.getId(),id,request);}
 @PostMapping("/jobs/{id}/report") void report(@AuthenticationPrincipal User technician,@PathVariable UUID id,@Valid @RequestBody ReportRequest request){service.submitReport(technician.getId(),id,request);}
}
