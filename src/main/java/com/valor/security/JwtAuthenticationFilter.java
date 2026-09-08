package com.valor.security;
import com.valor.repository.UserRepository;
import io.jsonwebtoken.JwtException;import jakarta.servlet.*;import jakarta.servlet.http.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;import java.util.*;
@Component public class JwtAuthenticationFilter extends OncePerRequestFilter {
 private final JwtService jwt; private final UserRepository users;
 public JwtAuthenticationFilter(JwtService jwt,UserRepository users){this.jwt=jwt;this.users=users;}
 @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws ServletException,IOException{
  String h=request.getHeader("Authorization"); if(h!=null&&h.startsWith("Bearer ")&&SecurityContextHolder.getContext().getAuthentication()==null)try{var u=users.findById(jwt.subject(h.substring(7))).filter(x->x.isEnabled());if(u.isPresent()){var a=new UsernamePasswordAuthenticationToken(u.get(),null,List.of(new SimpleGrantedAuthority("ROLE_"+u.get().getRole().name())));SecurityContextHolder.getContext().setAuthentication(a);}}catch(JwtException|IllegalArgumentException ignored){} chain.doFilter(request,response);
 }
}
