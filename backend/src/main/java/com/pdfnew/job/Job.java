package com.pdfnew.job;

import java.nio.file.Path;
import java.time.Instant;
import java.util.Map;

/**
 * One processing request. Its id is long and random, so it doubles as the secret that
 * grants access to the result (no accounts needed). Held in memory; files live on disk.
 */
public final class Job {

    public enum Status { QUEUED, PROCESSING, DONE, FAILED }

    private final String id;
    private final String toolId;
    private final Path dir;
    private final Instant createdAt;
    private final Instant expiresAt;

    private volatile Status status = Status.QUEUED;
    private volatile String error;
    private volatile Path resultFile;
    private volatile String resultName;
    private volatile long resultSize;
    private volatile Map<String, Object> stats = Map.of();
    private volatile Instant finishedAt;

    Job(String id, String toolId, Path dir, Instant createdAt, Instant expiresAt) {
        this.id = id;
        this.toolId = toolId;
        this.dir = dir;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    void processing() {
        status = Status.PROCESSING;
    }

    void done(Path file, String name, long size, Map<String, Object> stats) {
        this.resultFile = file;
        this.resultName = name;
        this.resultSize = size;
        this.stats = stats;
        this.finishedAt = Instant.now();
        this.status = Status.DONE;
    }

    void failed(String message) {
        this.error = message;
        this.finishedAt = Instant.now();
        this.status = Status.FAILED;
    }

    public String id() { return id; }
    public String toolId() { return toolId; }
    public Path dir() { return dir; }
    public Path inputDir() { return dir.resolve("in"); }
    public Path outputDir() { return dir.resolve("out"); }
    public Instant createdAt() { return createdAt; }
    public Instant expiresAt() { return expiresAt; }
    public Status status() { return status; }
    public String error() { return error; }
    public Path resultFile() { return resultFile; }
    public String resultName() { return resultName; }
    public long resultSize() { return resultSize; }
    public Map<String, Object> stats() { return stats; }
    public Instant finishedAt() { return finishedAt; }

    public boolean expired(Instant now) {
        return now.isAfter(expiresAt);
    }
}
