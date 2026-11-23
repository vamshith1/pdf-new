package com.pdfnew.tool.impl;

import java.io.IOException;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Set;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;

import com.pdfnew.tool.PdfTool;
import com.pdfnew.tool.ToolContext;
import com.pdfnew.tool.ToolContext.InputFile;
import com.pdfnew.tool.ToolException;
import com.pdfnew.tool.ToolResult;
import com.pdfnew.tool.support.Pdfs;

/** Extracts all text, in reading order, to a UTF-8 .txt file with a heading per page. */
@Component
public class PdfToTextTool implements PdfTool {

    @Override
    public String id() {
        return "pdf-to-text";
    }

    @Override
    public Set<String> accepts() {
        return Set.of("pdf");
    }

    @Override
    public ToolResult run(ToolContext ctx) throws IOException {
        InputFile file = ctx.single();
        try (PDDocument doc = Pdfs.open(file)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            StringBuilder all = new StringBuilder();
            int words = 0;
            for (int p = 1; p <= doc.getNumberOfPages(); p++) {
                stripper.setStartPage(p);
                stripper.setEndPage(p);
                StringWriter page = new StringWriter();
                stripper.writeText(doc, page);
                String text = page.toString().strip();
                if (!text.isEmpty()) {
                    words += text.split("\\s+").length;
                }
                all.append("----- Page ").append(p).append(" -----\n\n").append(text).append("\n\n");
            }
            if (words == 0) {
                throw new ToolException("No text found. This PDF looks scanned (pictures of text): run OCR PDF first, then try again.");
            }
            String name = file.stem() + ".txt";
            Path out = ctx.outputDir().resolve(name);
            Files.writeString(out, all.toString(), StandardCharsets.UTF_8);
            return new ToolResult(out, name, Map.of("pages", doc.getNumberOfPages(), "words", words));
        }
    }
}
