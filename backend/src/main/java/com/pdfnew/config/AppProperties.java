package com.pdfnew.config;

import java.nio.file.Path;
import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.util.unit.DataSize;

/**
 * All tunables in one place (see application.yml). Defaults suit a small free-tier instance.
 */
@ConfigurationProperties(prefix = "app")
public record AppProperties(
        Storage storage,
        Jobs jobs,
        Limits limits,
        RateLimit rateLimit,
        @DefaultValue List<String> corsOrigins,
        @DefaultValue("false") boolean trustProxy,
        /** Where the exported website lives: classpath:/static/ in the jar, or file:../frontend/out/ in dev. */
        @DefaultValue("classpath:/static/") String siteLocation) {

    public record Storage(
            @DefaultValue("./data/jobs") Path dir,
            @DefaultValue("60m") Duration ttl) {
    }

    public record Jobs(
            @DefaultValue("2") int workers,
            @DefaultValue("20") int queueCapacity) {
    }

    public record Limits(
            @DefaultValue("50MB") DataSize maxFileSize,
            @DefaultValue("100MB") DataSize maxTotalSize,
            @DefaultValue("20") int maxFiles,
            @DefaultValue("100") int maxRenderPages) {
    }

    public record RateLimit(
            @DefaultValue("true") boolean enabled,
            @DefaultValue("30") int jobsPerMinute) {
    }
}
