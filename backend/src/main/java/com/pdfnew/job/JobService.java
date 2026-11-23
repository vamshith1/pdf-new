package com.pdfnew.job;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.pdfnew.config.AppProperties;
import com.pdfnew.tool.PdfTool;
import com.pdfnew.tool.ToolContext;
import com.pdfnew.tool.ToolContext.InputFile;
import com.pdfnew.tool.ToolException;
import com.pdfnew.tool.ToolResult;

import jakarta.annotation.PreDestroy;

/**
 * Accepts uploads, runs tools on a small bounded worker pool, and deletes everything
 * once a job expires. Sized for a single small instance; swap for a queue (e.g. Redis)
 * when running several instances.
 */
@Service
public class JobService {

    private static final Logger log = LoggerFactory.getLogger(JobService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final AppProperties props;
    private final Clock clock;
    private final Map<String, Job> jobs = new ConcurrentHashMap<>();
    private final ThreadPoolExecutor workers;

    public JobService(AppProperties props, Clock clock) throws IOException {
        this.props = props;
        this.clock = clock;
        Files.createDirectories(props.storage().dir());
        int n = Math.max(1, props.jobs().workers());
        this.workers = new ThreadPoolExecutor(n, n, 0, TimeUnit.MILLISECONDS,
                new LinkedBlockingQueue<>(Math.max(1, props.jobs().queueCapacity())),
                Thread.ofPlatform().name("pdf-worker-", 0).factory(),
                new ThreadPoolExecutor.AbortPolicy());
        purgeStorageDir(); // jobs don't survive restarts, so leftovers are orphans
    }

    /** Validates and stores the uploads, then queues the tool. Returns immediately. */
    public Job submit(PdfTool tool, List<MultipartFile> uploads, Map<String, String> options) {
        List<MultipartFile> files = uploads.stream().filter(f -> f != null && !f.isEmpty()).toList();
        validate(tool, files);

        Instant now = clock.instant();
        String id = newId();
        Job job = new Job(id, tool.id(), props.storage().dir().resolve(id), now, now.plus(props.storage().ttl()));
        List<InputFile> inputs;
        try {
            Files.createDirectories(job.inputDir());
            Files.createDirectories(job.outputDir());
            inputs = store(job, tool, files);
        } catch (IOException e) {
            delete(job);
            throw new UncheckedIOException("Couldn't store upload", e);
        } catch (RuntimeException e) {
            delete(job);
            throw e;
        }

        jobs.put(id, job);
        ToolContext context = new ToolContext(inputs, job.outputDir(), new ToolContext.ToolOptions(Map.copyOf(options)),
                props.limits().maxRenderPages());
        try {
            workers.execute(() -> execute(job, tool, context));
        } catch (RejectedExecutionException e) {
            jobs.remove(id);
            delete(job);
            throw new ServerBusyException();
        }
        return job;
    }

    public Optional<Job> find(String id) {
        Job job = id == null ? null : jobs.get(id);
        if (job != null && job.expired(clock.instant())) {
            remove(id);
            return Optional.empty();
        }
        return Optional.ofNullable(job);
    }

    public void remove(String id) {
        Job job = jobs.remove(id);
        if (job != null) {
            delete(job);
        }
    }

    /** Deletes expired jobs. Runs every minute. */
    @Scheduled(fixedDelay = 60_000, initialDelay = 60_000)
    public int cleanup() {
        Instant now = clock.instant();
        List<String> expired = jobs.values().stream().filter(j -> j.expired(now)).map(Job::id).toList();
        expired.forEach(this::remove);
        if (!expired.isEmpty()) {
            log.info("Deleted {} expired job(s)", expired.size());
        }
        return expired.size();
    }

    public int queued() {
        return workers.getQueue().size();
    }

    @PreDestroy
    void shutdown() {
        workers.shutdownNow();
    }

    // ---------------------------------------------------------------------

    private void execute(Job job, PdfTool tool, ToolContext context) {
        if (!jobs.containsKey(job.id())) {
            return; // deleted while queued
        }
        job.processing();
        long start = System.nanoTime();
        try {
            ToolResult result = tool.run(context);
            long size = Files.size(result.file());
            job.done(result.file(), result.downloadName(), size, result.stats());
            log.info("Job {} ({}) done in {} ms, {} bytes", shortId(job), tool.id(),
                    (System.nanoTime() - start) / 1_000_000, size);
        } catch (ToolException e) {
            job.failed(e.getMessage());
            log.info("Job {} ({}) rejected: {}", shortId(job), tool.id(), e.getMessage());
        } catch (OutOfMemoryError e) {
            job.failed("This file is too large or complex to process. Try a smaller file.");
            log.warn("Job {} ({}) ran out of memory", shortId(job), tool.id());
        } catch (Exception e) {
            job.failed("Something went wrong while processing your file. Please try again.");
            log.error("Job {} ({}) failed", shortId(job), tool.id(), e);
        } finally {
            deleteTree(job.inputDir()); // originals are no longer needed
        }
    }

    private void validate(PdfTool tool, List<MultipartFile> files) {
        int max = Math.min(tool.maxFiles(), props.limits().maxFiles());
        if (files.isEmpty()) {
            throw new ToolException(tool.minFiles() > 1 ? "Choose at least " + tool.minFiles() + " files." : "Choose a file.");
        }
        if (files.size() < tool.minFiles()) {
            throw new ToolException("Choose at least " + tool.minFiles() + " files.");
        }
        if (files.size() > max) {
            throw new ToolException(max == 1 ? "This tool takes one file at a time." : "You can upload at most " + max + " files.");
        }
        long total = 0;
        long perFile = props.limits().maxFileSize().toBytes();
        for (MultipartFile f : files) {
            String name = safeName(f.getOriginalFilename());
            if (!tool.accepts().contains(extension(name))) {
                throw new ToolException("'" + name + "' isn't a supported file type. Accepted: "
                        + String.join(", ", tool.accepts().stream().sorted().toList()) + ".");
            }
            if (f.getSize() > perFile) {
                throw new ToolException("'" + name + "' is larger than " + props.limits().maxFileSize().toMegabytes() + " MB.");
            }
            total += f.getSize();
        }
        if (total > props.limits().maxTotalSize().toBytes()) {
            throw new ToolException("Files together are larger than " + props.limits().maxTotalSize().toMegabytes() + " MB.");
        }
    }

    private List<InputFile> store(Job job, PdfTool tool, List<MultipartFile> files) throws IOException {
        List<InputFile> inputs = new ArrayList<>();
        for (int i = 0; i < files.size(); i++) {
            MultipartFile f = files.get(i);
            String name = safeName(f.getOriginalFilename());
            Path target = job.inputDir().resolve(String.format("%03d.%s", i, extension(name)));
            try (InputStream in = f.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
            if (extension(name).equals("pdf") && !looksLikePdf(target)) {
                throw new ToolException("'" + name + "' isn't a valid PDF.");
            }
            inputs.add(new InputFile(target, name));
        }
        return inputs;
    }

    private static boolean looksLikePdf(Path file) throws IOException {
        try (InputStream in = Files.newInputStream(file)) {
            byte[] head = in.readNBytes(1024);
            String s = new String(head, java.nio.charset.StandardCharsets.ISO_8859_1);
            return s.contains("%PDF-");
        }
    }

    static String safeName(String original) {
        String name = original == null ? "" : original.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).strip();
        name = name.replaceAll("[^\\p{L}\\p{N} ._()\\-]", "_");
        if (name.length() > 120) {
            String ext = extension(name);
            name = name.substring(0, 115 - ext.length()) + "." + ext;
        }
        return name.isBlank() || name.startsWith(".") ? "file" + name : name;
    }

    static String extension(String name) {
        int dot = name.lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private static String newId() {
        byte[] bytes = new byte[18];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String shortId(Job job) {
        return job.id().substring(0, 6);
    }

    private void delete(Job job) {
        deleteTree(job.dir());
    }

    private void purgeStorageDir() {
        try (Stream<Path> children = Files.list(props.storage().dir())) {
            // Only touch folders that look like job ids, in case STORAGE_DIR points somewhere shared
            children.filter(p -> p.getFileName().toString().matches("[A-Za-z0-9_-]{24}"))
                    .forEach(JobService::deleteTree);
        } catch (IOException e) {
            log.warn("Couldn't clean storage dir: {}", e.getMessage());
        }
    }

    private static void deleteTree(Path root) {
        if (!Files.exists(root)) {
            return;
        }
        try (Stream<Path> walk = Files.walk(root)) {
            walk.sorted(Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException ignored) {
                    // retried by the next cleanup
                }
            });
        } catch (IOException ignored) {
            // already gone
        }
    }
}
