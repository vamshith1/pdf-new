package com.pdfnew.tool.impl;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Map;
import java.util.Set;

import org.apache.pdfbox.io.IOUtils;
import org.apache.pdfbox.multipdf.PDFMergerUtility;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.springframework.stereotype.Component;

import com.pdfnew.tool.PdfTool;
import com.pdfnew.tool.ToolContext;
import com.pdfnew.tool.ToolContext.InputFile;
import com.pdfnew.tool.ToolResult;
import com.pdfnew.tool.support.Pdfs;

/** Combines PDFs in the order they were uploaded. */
@Component
public class MergeTool implements PdfTool {

    @Override
    public String id() {
        return "merge";
    }

    @Override
    public Set<String> accepts() {
        return Set.of("pdf");
    }

    @Override
    public int minFiles() {
        return 2;
    }

    @Override
    public int maxFiles() {
        return 20;
    }

    @Override
    public ToolResult run(ToolContext ctx) throws IOException {
        PDFMergerUtility merger = new PDFMergerUtility();
        merger.setDocumentMergeMode(PDFMergerUtility.DocumentMergeMode.OPTIMIZE_RESOURCES_MODE);
        int pages = 0;
        for (InputFile file : ctx.files()) {
            // Validate each file first so errors name the culprit (and catch protected files)
            try (PDDocument doc = Pdfs.open(file)) {
                pages += doc.getNumberOfPages();
                if (doc.isAllSecurityToBeRemoved()) {
                    // Restricted (owner-password) file: save an unrestricted copy to merge from
                    Path copy = ctx.outputDir().resolve("src-" + file.path().getFileName());
                    doc.save(copy.toFile());
                    merger.addSource(copy.toFile());
                    continue;
                }
            }
            merger.addSource(file.path().toFile());
        }
        Path out = ctx.outputDir().resolve("merged.pdf");
        merger.setDestinationFileName(out.toString());
        merger.mergeDocuments(IOUtils.createTempFileOnlyStreamCache());
        return new ToolResult(out, "merged.pdf", Map.of("pages", pages, "files", ctx.files().size()));
    }
}
