package com.valor.controller;
import com.valor.dto.auth.AuthDtos.*;import com.valor.repository.UserRepository;import com.valor.security.JwtService;import jakarta.validation.Valid;import org.springframework.http.*;import org.springframework.security.crypto.password.PasswordEncoder;import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/v1/auth") public class AuthController {
 private final UserRepository users;private final PasswordEncoder encoder;private final JwtService jwt;
 public AuthController(UserRepository users,PasswordEncoder encoder,JwtService jwt){this.users=users;this.encoder=encoder;this.jwt=jwt;}
 @PostMapping("/login") public AuthResponse login(@Valid @RequestBody LoginRequest request){var user=users.findByEmailIgnoreCase(request.email()).filter(u->u.isEnabled()&&encoder.matches(request.password(),u.getPasswordHash())).orElseThrow(()->new org.springframework.security.authentication.BadCredentialsException("Invalid credentials."));return new AuthResponse(jwt.issue(user),"Bearer",jwt.expirationSeconds(),user.getRole().name(),user.getFullName());}
}
