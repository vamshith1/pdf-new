package com.pdfnew.web;

import java.time.Instant;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.pdfnew.job.Job;

/** What clients see about a job. Paths on disk are never exposed. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record JobView(
        String id,
        String tool,
        Job.Status status,
        String error,
        Result result,
        Instant createdAt,
        Instant expiresAt) {

    public record Result(String filename, long size, String downloadUrl, Map<String, Object> stats) {
    }

    public static JobView of(Job job) {
        Result result = job.status() == Job.Status.DONE
                ? new Result(job.resultName(), job.resultSize(), "/api/v1/jobs/" + job.id() + "/download", job.stats())
                : null;
        return new JobView(job.id(), job.toolId(), job.status(), job.error(), result, job.createdAt(), job.expiresAt());
    }
}
