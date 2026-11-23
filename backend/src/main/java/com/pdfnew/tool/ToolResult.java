package com.pdfnew.tool;

import java.nio.file.Path;
import java.util.Map;

/**
 * The single file a tool produces (a PDF, an image, or a ZIP of several) plus optional
 * stats shown to the user, e.g. how much a compression saved.
 */
public record ToolResult(Path file, String downloadName, Map<String, Object> stats) {

    public static ToolResult of(Path file, String downloadName) {
        return new ToolResult(file, downloadName, Map.of());
    }
}
