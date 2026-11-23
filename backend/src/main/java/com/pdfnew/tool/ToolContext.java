package com.pdfnew.tool;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Everything a tool needs: the uploaded files (in upload order), a folder for its output,
 * the user's options and the configured limits.
 */
public record ToolContext(List<InputFile> files, Path outputDir, ToolOptions options, int maxRenderPages) {

    /** An uploaded file stored on disk, with its original (sanitised) name. */
    public record InputFile(Path path, String originalName) {

        public String stem() {
            int dot = originalName.lastIndexOf('.');
            return dot > 0 ? originalName.substring(0, dot) : originalName;
        }
    }

    public InputFile single() {
        return files.getFirst();
    }

    public static ToolContext of(List<InputFile> files, Path outputDir, Map<String, String> options) {
        return new ToolContext(files, outputDir, new ToolOptions(options), 100);
    }

    /** Typed, validated access to option values sent as form fields. */
    public record ToolOptions(Map<String, String> values) {

        public String string(String name, String fallback) {
            String v = values.get(name);
            return v == null || v.isBlank() ? fallback : v.trim();
        }

        public String required(String name, String message) {
            String v = values.get(name);
            if (v == null || v.isBlank()) {
                throw new ToolException(message);
            }
            return v;
        }

        public String oneOf(String name, String fallback, Set<String> allowed) {
            String v = string(name, fallback).toLowerCase();
            if (!allowed.contains(v)) {
                throw new ToolException("Invalid value for '" + name + "'. Allowed: " + String.join(", ", allowed) + ".");
            }
            return v;
        }

        public int integer(String name, int fallback, int min, int max) {
            String v = string(name, null);
            if (v == null) {
                return fallback;
            }
            try {
                int n = Integer.parseInt(v);
                if (n < min || n > max) {
                    throw new ToolException("'" + name + "' must be between " + min + " and " + max + ".");
                }
                return n;
            } catch (NumberFormatException e) {
                throw new ToolException("'" + name + "' must be a whole number.");
            }
        }
    }
}
