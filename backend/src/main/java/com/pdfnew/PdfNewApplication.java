package com.pdfnew;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@ConfigurationPropertiesScan
public class PdfNewApplication {

    public static void main(String[] args) {
        // Headless rendering for PDF-to-image on servers without a display
        System.setProperty("java.awt.headless", "true");
        SpringApplication.run(PdfNewApplication.class, args);
    }
}
