package com.pdfnew.tool.support;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.pdfnew.tool.ToolException;

/**
 * Document conversion with LibreOffice in headless mode. Each conversion gets its own
 * throwaway LibreOffice profile, so conversions never share state.
 */
@Component
public class Office {

    private final String binary;
    private final Duration timeout;

    public Office(@Value("${app.office.binary:soffice}") String binary,
                  @Value("${app.office.timeout:120s}") Duration timeout) {
        this.binary = binary;
        this.timeout = timeout;
    }

    /**
     * Converts {@code input} into {@code outDir}, e.g. target "pdf" or "docx:MS Word 2007 XML".
     * Returns the produced file.
     */
    public Path convert(Path input, Path outDir, String target, String importFilter, String toolName) throws IOException {
        Commands.require(binary, "--version", toolName);
        Path profile = Files.createTempDirectory("lo-profile-" + UUID.randomUUID());
        try {
            List<String> cmd = new ArrayList<>(List.of(binary, "--headless", "--norestore", "--nolockcheck",
                    "--nodefault", "--nofirststartwizard",
                    "-env:UserInstallation=" + profile.toUri()));
            if (importFilter != null) {
                cmd.add("--infilter=" + importFilter);
            }
            cmd.addAll(List.of("--convert-to", target, "--outdir", outDir.toString(), input.toString()));
            Commands.run(cmd, outDir, timeout);

            String ext = target.contains(":") ? target.substring(0, target.indexOf(':')) : target;
            String stem = input.getFileName().toString().replaceFirst("\\.[^.]+$", "");
            Path produced = outDir.resolve(stem + "." + ext);
            if (!Files.isRegularFile(produced) || Files.size(produced) == 0) {
                throw new ToolException("This file couldn't be converted. It may be damaged, password-protected or in an unsupported format.");
            }
            return produced;
        } finally {
            deleteTree(profile);
        }
    }

    private static void deleteTree(Path root) {
        try (Stream<Path> walk = Files.walk(root)) {
            walk.sorted(Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
        } catch (IOException ignored) {
            // temp dir; best effort
        }
    }
}
