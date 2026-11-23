package com.pdfnew.tool.impl;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import javax.imageio.ImageIO;

import org.apache.pdfbox.cos.COSBase;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.pdmodel.graphics.PDXObject;
import org.apache.pdfbox.pdmodel.graphics.form.PDFormXObject;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Component;

import com.pdfnew.tool.PdfTool;
import com.pdfnew.tool.ToolContext;
import com.pdfnew.tool.ToolContext.InputFile;
import com.pdfnew.tool.ToolException;
import com.pdfnew.tool.ToolResult;
import com.pdfnew.tool.support.Outputs;
import com.pdfnew.tool.support.Pdfs;

/**
 * Saves every embedded image. JPEGs are copied byte-for-byte (no quality loss);
 * everything else is saved as PNG. Duplicates and tiny icons (under 32 px) are skipped.
 */
@Component
public class ExtractImagesTool implements PdfTool {

    private static final int MAX_IMAGES = 500;

    @Override
    public String id() {
        return "extract-images";
    }

    @Override
    public Set<String> accepts() {
        return Set.of("pdf");
    }

    @Override
    public ToolResult run(ToolContext ctx) throws IOException {
        InputFile file = ctx.single();
        try (PDDocument doc = Pdfs.open(file)) {
            Walker walker = new Walker(ctx.outputDir(), file.stem());
            int pageNo = 1;
            for (PDPage page : doc.getPages()) {
                walker.page = pageNo++;
                walker.visit(page.getResources());
            }
            if (walker.files.isEmpty()) {
                throw new ToolException("No images found in this PDF.");
            }
            ToolResult result = Outputs.singleOrZip(walker.files, ctx.outputDir(), file.stem() + "_images.zip");
            return new ToolResult(result.file(), result.downloadName(), Map.of("images", walker.files.size()));
        }
    }

    private static final class Walker {
        final Path outDir;
        final String stem;
        final List<Path> files = new ArrayList<>();
        final Set<COSBase> seen = new HashSet<>();
        int page;
        int count;

        Walker(Path outDir, String stem) {
            this.outDir = outDir;
            this.stem = stem;
        }

        void visit(PDResources resources) throws IOException {
            if (resources == null) {
                return;
            }
            for (COSName name : resources.getXObjectNames()) {
                PDXObject x;
                try {
                    x = resources.getXObject(name);
                } catch (IOException e) {
                    continue;
                }
                if (x instanceof PDImageXObject image && seen.add(image.getCOSObject())) {
                    save(image);
                } else if (x instanceof PDFormXObject form && seen.add(form.getCOSObject())) {
                    visit(form.getResources());
                }
            }
        }

        private void save(PDImageXObject image) {
            if (files.size() >= MAX_IMAGES || image.isStencil() || image.getWidth() < 32 || image.getHeight() < 32) {
                return;
            }
            String base = stem + "_page" + page + "_" + (++count);
            try {
                if ("jpg".equals(image.getSuffix()) && !image.getColorSpace().getName().contains("CMYK")) {
                    Path target = outDir.resolve(base + ".jpg");
                    try (InputStream in = image.createInputStream(List.of(COSName.DCT_DECODE.getName()))) {
                        Files.copy(in, target);
                    }
                    files.add(target);
                } else {
                    BufferedImage img = image.getImage();
                    Path target = outDir.resolve(base + ".png");
                    ImageIO.write(img, "png", target.toFile());
                    files.add(target);
                }
            } catch (IOException | RuntimeException e) {
                count--; // unreadable image: skip it
            }
        }
    }
}
