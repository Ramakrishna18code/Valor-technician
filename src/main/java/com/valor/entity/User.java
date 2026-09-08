package com.valor.entity;

import com.valor.enums.Role;
import jakarta.persistence.*;
import lombok.*;

@Entity @Table(name = "users", uniqueConstraints = @UniqueConstraint(columnNames = "email"))
@Getter @Setter @NoArgsConstructor
public class User extends BaseEntity {
  @Column(nullable = false, length = 120) private String fullName;
  @Column(nullable = false, length = 190) private String email;
  @Column(nullable = false) private String passwordHash;
  @Column(length = 25) private String phone;
  @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private Role role;
  @Column(nullable = false) private boolean enabled = true;
  @Column(length = 80) private String employeeCode;
}
