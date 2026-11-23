package com.pdfnew.tool.impl;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.stereotype.Component;

import com.pdfnew.tool.PdfTool;
import com.pdfnew.tool.ToolContext;
import com.pdfnew.tool.ToolContext.InputFile;
import com.pdfnew.tool.ToolException;
import com.pdfnew.tool.ToolResult;
import com.pdfnew.tool.support.Outputs;
import com.pdfnew.tool.support.PageRanges;
import com.pdfnew.tool.support.Pdfs;

/**
 * Renders pages to JPEG. Options: quality = normal (150 dpi) | high (300 dpi) | low (72 dpi),
 * pages = "all" or "1-3, 5". One page returns a JPG, several a ZIP.
 */
@Component
public class PdfToImagesTool implements PdfTool {

    private static final Map<String, Integer> DPI = Map.of("low", 72, "normal", 150, "high", 300);

    @Override
    public String id() {
        return "pdf-to-jpg";
    }

    @Override
    public Set<String> accepts() {
        return Set.of("pdf");
    }

    @Override
    public ToolResult run(ToolContext ctx) throws IOException {
        InputFile file = ctx.single();
        int dpi = DPI.get(ctx.options().oneOf("quality", "normal", DPI.keySet()));
        try (PDDocument doc = Pdfs.open(file)) {
            List<Integer> pages = PageRanges.indices(ctx.options().string("pages", "all"), doc.getNumberOfPages());
            if (pages.size() > ctx.maxRenderPages()) {
                throw new ToolException("At most " + ctx.maxRenderPages() + " pages can be converted at once.");
            }
            PDFRenderer renderer = new PDFRenderer(doc);
            List<Path> images = new ArrayList<>();
            for (int index : pages) {
                BufferedImage image = renderer.renderImageWithDPI(index, dpi, ImageType.RGB);
                Path target = ctx.outputDir().resolve(file.stem() + "_page_" + (index + 1) + ".jpg");
                Outputs.writeJpeg(image, 0.9f, target);
                image.flush();
                images.add(target);
            }
            ToolResult result = Outputs.singleOrZip(images, ctx.outputDir(), file.stem() + "_images.zip");
            return new ToolResult(result.file(), result.downloadName(), Map.of("images", images.size(), "dpi", dpi));
        }
    }
}
