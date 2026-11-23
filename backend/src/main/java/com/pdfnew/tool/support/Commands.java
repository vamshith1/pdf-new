package com.pdfnew.tool.support;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.pdfnew.tool.ToolException;

/** Runs external programs (LibreOffice, Tesseract) safely: no shell, a time limit, captured output. */
public final class Commands {

    private static final Logger log = LoggerFactory.getLogger(Commands.class);
    private static final Map<String, Boolean> AVAILABLE = new ConcurrentHashMap<>();

    public record Result(int exitCode, String output) {
    }

    private Commands() {
    }

    /** True if the program starts (checked once, then cached). */
    public static boolean available(String binary, String versionFlag) {
        return AVAILABLE.computeIfAbsent(binary, b -> {
            try {
                Process p = new ProcessBuilder(b, versionFlag).redirectErrorStream(true).start();
                p.getInputStream().readAllBytes();
                boolean done = p.waitFor(60, TimeUnit.SECONDS);
                if (!done) {
                    p.destroyForcibly();
                }
                return done;
            } catch (IOException e) {
                return false;
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            }
        });
    }

    public static void require(String binary, String versionFlag, String toolName) {
        if (!available(binary, versionFlag)) {
            throw new ToolException(toolName + " isn't available on this server right now. Please try again later.");
        }
    }

    /** Runs the command in {@code workDir}; throws if it doesn't finish in time. */
    public static Result run(List<String> command, Path workDir, Duration timeout) throws IOException {
        Path log = Files.createTempFile(workDir, "cmd", ".log");
        Process process = new ProcessBuilder(command)
                .directory(workDir.toFile())
                .redirectErrorStream(true)
                .redirectOutput(log.toFile())
                .start();
        try {
            if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
                process.descendants().forEach(ProcessHandle::destroyForcibly);
                process.destroyForcibly();
                throw new ToolException("This file took too long to process. Try a smaller or simpler file.");
            }
        } catch (InterruptedException e) {
            process.destroyForcibly();
            Thread.currentThread().interrupt();
            throw new ToolException("Processing was interrupted. Please try again.");
        }
        String output = Files.readString(log, StandardCharsets.UTF_8);
        Files.deleteIfExists(log);
        if (process.exitValue() != 0) {
            Commands.log.warn("{} exited with {}: {}", command.getFirst(), process.exitValue(),
                    output.length() > 500 ? output.substring(0, 500) : output);
        }
        return new Result(process.exitValue(), output);
    }
}
