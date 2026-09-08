package com.valor.security;
import com.valor.entity.User;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
@Service public class JwtService {
 private final SecretKey key; private final long expirationMinutes;
 public JwtService(@Value("${valor.jwt.secret}") String secret,@Value("${valor.jwt.expiration-minutes}") long expirationMinutes){this.key=Keys.hmacShaKeyFor(Arrays.copyOf(secret.getBytes(StandardCharsets.UTF_8),32));this.expirationMinutes=expirationMinutes;}
 public String issue(User user){Instant now=Instant.now();return Jwts.builder().subject(user.getId().toString()).claim("role",user.getRole().name()).claim("email",user.getEmail()).issuedAt(Date.from(now)).expiration(Date.from(now.plus(Duration.ofMinutes(expirationMinutes)))).signWith(key).compact();}
 public UUID subject(String token){return UUID.fromString(Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload().getSubject());}
 public long expirationSeconds(){return Duration.ofMinutes(expirationMinutes).toSeconds();}
}
