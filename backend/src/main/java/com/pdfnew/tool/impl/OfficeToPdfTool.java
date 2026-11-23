package com.pdfnew.tool.impl;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Set;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.springframework.stereotype.Component;

import com.pdfnew.tool.PdfTool;
import com.pdfnew.tool.ToolContext;
import com.pdfnew.tool.ToolContext.InputFile;
import com.pdfnew.tool.ToolResult;
import com.pdfnew.tool.support.Office;

/** Word, Excel, PowerPoint (and OpenDocument) to PDF, using LibreOffice. */
@Component
public class OfficeToPdfTool implements PdfTool {

    private final Office office;

    public OfficeToPdfTool(Office office) {
        this.office = office;
    }

    @Override
    public String id() {
        return "office-to-pdf";
    }

    @Override
    public Set<String> accepts() {
        return Set.of("doc", "docx", "odt", "rtf", "txt",
                "xls", "xlsx", "ods", "csv",
                "ppt", "pptx", "odp");
    }

    @Override
    public ToolResult run(ToolContext ctx) throws IOException {
        InputFile file = ctx.single();
        Path pdf = office.convert(file.path(), ctx.outputDir(), "pdf", null, "Office to PDF conversion");
        String name = file.stem() + ".pdf";
        Path out = Files.move(pdf, ctx.outputDir().resolve(name));
        int pages;
        try (PDDocument doc = Loader.loadPDF(out.toFile())) {
            pages = doc.getNumberOfPages();
        }
        return new ToolResult(out, name, Map.of("pages", pages));
    }
}
