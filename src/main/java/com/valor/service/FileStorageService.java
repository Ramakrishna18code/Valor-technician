package com.valor.service;
import org.springframework.web.multipart.MultipartFile;import java.io.*;
public interface FileStorageService { String store(MultipartFile file,String namespace) throws IOException; InputStream read(String storageKey) throws IOException; }
