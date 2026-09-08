package com.valor.repository;
import com.valor.entity.User;
import com.valor.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface UserRepository extends JpaRepository<User, UUID> { Optional<User> findByEmailIgnoreCase(String email); List<User> findByRoleAndEnabledTrue(Role role); }
