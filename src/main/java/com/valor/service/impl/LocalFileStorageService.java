package com.valor.service.impl;
import com.valor.service.FileStorageService;import org.springframework.beans.factory.annotation.Value;import org.springframework.stereotype.Service;import org.springframework.web.multipart.MultipartFile;import java.io.*;import java.nio.file.*;import java.util.*;
@Service public class LocalFileStorageService implements FileStorageService {
 private final Path root;public LocalFileStorageService(@Value("${valor.storage.local-path}") String root){this.root=Paths.get(root).toAbsolutePath().normalize();}
 public String store(MultipartFile file,String namespace)throws IOException{if(file.isEmpty())throw new IllegalArgumentException("File cannot be empty.");String safe=UUID.randomUUID()+"-"+Optional.ofNullable(file.getOriginalFilename()).orElse("upload").replaceAll("[^a-zA-Z0-9._-]","_");Path target=root.resolve(namespace).resolve(safe).normalize();if(!target.startsWith(root))throw new SecurityException("Invalid storage path.");Files.createDirectories(target.getParent());try(InputStream in=file.getInputStream()){Files.copy(in,target,StandardCopyOption.REPLACE_EXISTING);}return root.relativize(target).toString().replace('\\','/');}
 public InputStream read(String key)throws IOException{Path target=root.resolve(key).normalize();if(!target.startsWith(root))throw new SecurityException("Invalid storage path.");return Files.newInputStream(target);}
}
