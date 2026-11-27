package com.pdfnew.web;

import java.net.URI;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;

import com.pdfnew.config.AppProperties;
import com.pdfnew.job.Job;
import com.pdfnew.job.JobService;
import com.pdfnew.tool.PdfTool;
import com.pdfnew.tool.ToolRegistry;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Tools", description = "Start a job by uploading files to a tool")
public class ToolController {

    public record ToolInfo(String id, Set<String> accepts, int minFiles, int maxFiles) {
    }

    public record Limits(long maxFileSizeMb, long maxTotalSizeMb, int maxFiles, long fileTtlMinutes) {
    }

    /** Options that carry JSON from the editor, so they may be longer than plain settings. */
    private static final Set<String> LARGE_OPTIONS = Set.of("edits", "fields");

    private final ToolRegistry registry;
    private final JobService jobs;
    private final AppProperties props;

    public ToolController(ToolRegistry registry, JobService jobs, AppProperties props) {
        this.registry = registry;
        this.jobs = jobs;
        this.props = props;
    }

    @GetMapping("/tools")
    @Operation(summary = "List available tools")
    public List<ToolInfo> tools() {
        return registry.all().stream()
                .sorted(Comparator.comparing(PdfTool::id))
                .map(t -> new ToolInfo(t.id(), t.accepts(), t.minFiles(), Math.min(t.maxFiles(), props.limits().maxFiles())))
                .toList();
    }

    @GetMapping("/limits")
    @Operation(summary = "Upload limits and how long results are kept")
    public Limits limits() {
        var l = props.limits();
        return new Limits(l.maxFileSize().toMegabytes(), l.maxTotalSize().toMegabytes(), l.maxFiles(),
                props.storage().ttl().toMinutes());
    }

    /**
     * Multipart form: one or more {@code files} parts plus tool options as plain fields.
     * Returns 202 with the job; poll {@code GET /api/v1/jobs/{id}} until DONE or FAILED.
     */
    @PostMapping(path = "/tools/{toolId}/jobs", consumes = "multipart/form-data")
    @Operation(summary = "Start a job", description = "Upload files as 'files' parts; options as form fields.")
    public ResponseEntity<JobView> start(@PathVariable String toolId, MultipartHttpServletRequest request) {
        PdfTool tool = registry.find(toolId).orElseThrow(() -> new NotFoundException("Unknown tool '" + toolId + "'."));
        List<MultipartFile> files = request.getFiles("files");
        Map<String, String> options = new HashMap<>();
        request.getParameterMap().forEach((k, v) -> {
            int maxLength = LARGE_OPTIONS.contains(k) ? 300_000 : 2000;
            if (v.length > 0 && k.length() <= 40 && v[0].length() <= maxLength) {
                options.put(k, v[0]);
            }
        });
        Job job = jobs.submit(tool, files, options);
        return ResponseEntity.accepted()
                .location(URI.create("/api/v1/jobs/" + job.id()))
                .body(JobView.of(job));
    }
}
