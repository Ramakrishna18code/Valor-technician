package com.valor.dto.auth;
import jakarta.validation.constraints.*;
public final class AuthDtos { private AuthDtos() {}
 public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}
 public record AuthResponse(String accessToken, String tokenType, long expiresInSeconds, String role, String name) {}
}
