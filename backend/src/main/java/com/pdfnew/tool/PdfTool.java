package com.pdfnew.tool;

import java.io.IOException;
import java.util.Set;

/**
 * One tool on the site (merge, compress, ...). Implementations are Spring beans and are
 * discovered automatically by {@link ToolRegistry}, so adding a tool means adding one class.
 */
public interface PdfTool {

    /** URL id, e.g. "merge". Used in /api/v1/tools/{id}/jobs. */
    String id();

    /** Accepted lowercase file extensions, without dots. */
    Set<String> accepts();

    default int minFiles() {
        return 1;
    }

    default int maxFiles() {
        return 1;
    }

    /** Runs the tool. Throw {@link ToolException} for user-facing problems. */
    ToolResult run(ToolContext context) throws IOException;
}
