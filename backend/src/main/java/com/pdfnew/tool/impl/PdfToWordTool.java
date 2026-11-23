package com.pdfnew.tool.impl;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Set;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.springframework.stereotype.Component;

import com.pdfnew.tool.PdfTool;
import com.pdfnew.tool.ToolContext;
import com.pdfnew.tool.ToolContext.InputFile;
import com.pdfnew.tool.ToolException;
import com.pdfnew.tool.ToolResult;
import com.pdfnew.tool.support.Office;
import com.pdfnew.tool.support.Pdfs;

/**
 * PDF to an editable Word (.docx) file via LibreOffice's PDF import. Text stays editable;
 * complex layouts may shift. Scanned PDFs need OCR first.
 */
@Component
public class PdfToWordTool implements PdfTool {

    private static final int MAX_PAGES = 60;
    private final Office office;

    public PdfToWordTool(Office office) {
        this.office = office;
    }

    @Override
    public String id() {
        return "pdf-to-word";
    }

    @Override
    public Set<String> accepts() {
        return Set.of("pdf");
    }

    @Override
    public ToolResult run(ToolContext ctx) throws IOException {
        InputFile file = ctx.single();
        int pages;
        try (PDDocument doc = Pdfs.open(file)) { // friendly errors for broken/protected files
            pages = doc.getNumberOfPages();
        }
        if (pages > MAX_PAGES) {
            throw new ToolException("PDF to Word supports up to " + MAX_PAGES + " pages. Split the PDF first.");
        }
        Path docx = office.convert(file.path(), ctx.outputDir(), "docx:MS Word 2007 XML", "writer_pdf_import", "PDF to Word conversion");
        String name = file.stem() + ".docx";
        Path out = Files.move(docx, ctx.outputDir().resolve(name));
        return new ToolResult(out, name, Map.of("pages", pages));
    }
}
