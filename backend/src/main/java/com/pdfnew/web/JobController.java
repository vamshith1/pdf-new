package com.pdfnew.web;

import org.springframework.core.io.FileSystemResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.pdfnew.job.Job;
import com.pdfnew.job.JobService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/v1/jobs")
@Tag(name = "Jobs", description = "Check progress, download and delete results")
public class JobController {

    private final JobService jobs;

    public JobController(JobService jobs) {
        this.jobs = jobs;
    }

    @GetMapping("/{id}")
    @Operation(summary = "Job status")
    public JobView status(@PathVariable String id) {
        return JobView.of(find(id));
    }

    @GetMapping("/{id}/download")
    @Operation(summary = "Download the result")
    public ResponseEntity<FileSystemResource> download(@PathVariable String id) {
        Job job = find(id);
        if (job.status() != Job.Status.DONE) {
            throw new NotFoundException("This file isn't ready yet.");
        }
        MediaType type = MediaTypeFactory.getMediaType(job.resultName()).orElse(MediaType.APPLICATION_OCTET_STREAM);
        return ResponseEntity.ok()
                .contentType(type)
                .contentLength(job.resultSize())
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(job.resultName(), java.nio.charset.StandardCharsets.UTF_8)
                                .build().toString())
                .body(new FileSystemResource(job.resultFile()));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete the job and its files now")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        jobs.remove(id);
        return ResponseEntity.noContent().build();
    }

    private Job find(String id) {
        return jobs.find(id).orElseThrow(() -> new NotFoundException("This file has expired or doesn't exist."));
    }
}
