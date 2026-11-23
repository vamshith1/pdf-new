package com.pdfnew.tool.impl;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.apache.pdfbox.multipdf.PageExtractor;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.springframework.stereotype.Component;

import com.pdfnew.tool.PdfTool;
import com.pdfnew.tool.ToolContext;
import com.pdfnew.tool.ToolContext.InputFile;
import com.pdfnew.tool.ToolResult;
import com.pdfnew.tool.support.Outputs;
import com.pdfnew.tool.support.PageRanges;
import com.pdfnew.tool.support.PageRanges.Range;
import com.pdfnew.tool.support.Pdfs;

/**
 * Options: mode = ranges (ranges="1-3, 4-6") | every (every=N pages per file) | all (one file per page).
 * One output is returned as a PDF, several as a ZIP.
 */
@Component
public class SplitTool implements PdfTool {

    @Override
    public String id() {
        return "split";
    }

    @Override
    public Set<String> accepts() {
        return Set.of("pdf");
    }

    @Override
    public ToolResult run(ToolContext ctx) throws IOException {
        InputFile file = ctx.single();
        String mode = ctx.options().oneOf("mode", "ranges", Set.of("ranges", "every", "all"));
        try (PDDocument doc = Pdfs.open(file)) {
            int count = doc.getNumberOfPages();
            List<Range> ranges = switch (mode) {
                case "ranges" -> PageRanges.parse(
                        ctx.options().required("ranges", "Enter the page ranges to extract, e.g. 1-3, 4-6."), count);
                case "every" -> chunks(count, ctx.options().integer("every", 1, 1, Math.max(1, count)));
                default -> chunks(count, 1);
            };
            List<Path> parts = new ArrayList<>();
            for (Range range : ranges) {
                try (PDDocument part = new PageExtractor(doc, range.from() + 1, range.to() + 1).extract()) {
                    parts.add(Pdfs.save(part, ctx.outputDir().resolve(file.stem() + "_pages_" + range.label() + ".pdf")));
                }
            }
            ToolResult result = Outputs.singleOrZip(parts, ctx.outputDir(), file.stem() + "_split.zip");
            return new ToolResult(result.file(), result.downloadName(), Map.of("files", parts.size()));
        }
    }

    private static List<Range> chunks(int count, int size) {
        List<Range> list = new ArrayList<>();
        for (int i = 0; i < count; i += size) {
            list.add(new Range(i, Math.min(i + size, count) - 1));
        }
        return list;
    }
}
