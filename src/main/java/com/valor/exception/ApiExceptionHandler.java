package com.valor.exception;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.*;
@RestControllerAdvice public class ApiExceptionHandler {
 @ExceptionHandler(NotFoundException.class) ResponseEntity<?> notFound(NotFoundException e){return response(HttpStatus.NOT_FOUND,e.getMessage());}
 @ExceptionHandler(IllegalStateException.class) ResponseEntity<?> conflict(IllegalStateException e){return response(HttpStatus.CONFLICT,e.getMessage());}
 @ExceptionHandler(Exception.class) ResponseEntity<?> other(Exception e){return response(HttpStatus.INTERNAL_SERVER_ERROR,"An unexpected error occurred.");}
 private ResponseEntity<Map<String,Object>> response(HttpStatus status,String message){return ResponseEntity.status(status).body(Map.of("timestamp",Instant.now().toString(),"status",status.value(),"message",message));}
}
