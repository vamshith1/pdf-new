package com.pdfnew.tool.impl;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

import org.apache.pdfbox.io.IOUtils;
import org.apache.pdfbox.multipdf.PDFMergerUtility;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.pdfnew.tool.PdfTool;
import com.pdfnew.tool.ToolContext;
import com.pdfnew.tool.ToolContext.InputFile;
import com.pdfnew.tool.ToolException;
import com.pdfnew.tool.ToolResult;
import com.pdfnew.tool.support.Commands;
import com.pdfnew.tool.support.Outputs;
import com.pdfnew.tool.support.Pdfs;

/**
 * Makes scanned PDFs searchable: each page is rendered and run through Tesseract, which
 * returns the page image with an invisible text layer, so text can be selected and searched.
 * Option: language = eng | hin (installed language packs).
 */
@Component
public class OcrTool implements PdfTool {

    private static final Map<String, String> LANGUAGES = Map.of("eng", "eng", "hin", "hin+eng");

    private final String binary;
    private final int maxPages;

    public OcrTool(@Value("${app.ocr.binary:tesseract}") String binary,
                   @Value("${app.ocr.max-pages:30}") int maxPages) {
        this.binary = binary;
        this.maxPages = maxPages;
    }

    @Override
    public String id() {
        return "ocr";
    }

    @Override
    public Set<String> accepts() {
        return Set.of("pdf");
    }

    @Override
    public ToolResult run(ToolContext ctx) throws IOException {
        InputFile file = ctx.single();
        String language = LANGUAGES.get(ctx.options().oneOf("language", "eng", LANGUAGES.keySet()));
        Commands.require(binary, "--version", "OCR");

        Path work = Files.createDirectories(ctx.outputDir().resolve("ocr-work"));
        PDFMergerUtility merger = new PDFMergerUtility();
        int pages;
        try (PDDocument doc = Pdfs.open(file)) {
            pages = doc.getNumberOfPages();
            if (pages > maxPages) {
                throw new ToolException("OCR supports up to " + maxPages + " pages at a time. Split the PDF first.");
            }
            PDFRenderer renderer = new PDFRenderer(doc);
            for (int i = 0; i < pages; i++) {
                BufferedImage image = renderer.renderImageWithDPI(i, 300, ImageType.RGB);
                Path jpg = work.resolve(String.format("p%03d.jpg", i));
                Outputs.writeJpeg(image, 0.85f, jpg);
                image.flush();
                Path base = work.resolve(String.format("p%03d", i));
                Commands.Result r = Commands.run(
                        List.of(binary, jpg.toString(), base.toString(), "-l", language, "--dpi", "300", "pdf"),
                        work, Duration.ofSeconds(90));
                Path pagePdf = work.resolve(base.getFileName() + ".pdf");
                if (r.exitCode() != 0 || !Files.isRegularFile(pagePdf)) {
                    throw new ToolException("Text recognition failed on page " + (i + 1) + ".");
                }
                Files.delete(jpg);
                merger.addSource(pagePdf.toFile());
            }
        }

        String name = file.stem() + "_ocr.pdf";
        Path out = ctx.outputDir().resolve(name);
        merger.setDestinationFileName(out.toString());
        merger.mergeDocuments(IOUtils.createTempFileOnlyStreamCache());
        try (Stream<Path> files = Files.list(work)) {
            files.forEach(p -> p.toFile().delete());
        }
        Files.deleteIfExists(work);
        return new ToolResult(out, name, Map.of("pages", pages));
    }
}
