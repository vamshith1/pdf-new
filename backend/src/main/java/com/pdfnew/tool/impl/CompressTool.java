package com.pdfnew.tool.impl;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import org.apache.pdfbox.cos.COSBase;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.pdmodel.graphics.PDXObject;
import org.apache.pdfbox.pdmodel.graphics.color.PDDeviceGray;
import org.apache.pdfbox.pdmodel.graphics.form.PDFormXObject;
import org.apache.pdfbox.pdmodel.graphics.image.JPEGFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.pdfnew.tool.PdfTool;
import com.pdfnew.tool.ToolContext;
import com.pdfnew.tool.ToolContext.InputFile;
import com.pdfnew.tool.ToolResult;
import com.pdfnew.tool.support.Images;
import com.pdfnew.tool.support.Pdfs;

/**
 * Shrinks PDFs by downscaling and re-encoding embedded images as JPEG, then saving with
 * compressed object streams. Text and vector graphics stay sharp.
 * Options: level = low (best quality) | medium (recommended) | high (smallest file).
 * Never returns a file larger than the input.
 */
@Component
public class CompressTool implements PdfTool {

    private static final Logger log = LoggerFactory.getLogger(CompressTool.class);

    /** Longest image side in pixels and JPEG quality per level. */
    private record Level(int maxSide, float quality) {
    }

    private static final Map<String, Level> LEVELS = Map.of(
            "low", new Level(2400, 0.85f),
            "medium", new Level(1600, 0.70f),
            "high", new Level(1100, 0.50f));

    @Override
    public String id() {
        return "compress";
    }

    @Override
    public Set<String> accepts() {
        return Set.of("pdf");
    }

    @Override
    public ToolResult run(ToolContext ctx) throws IOException {
        InputFile file = ctx.single();
        Level level = LEVELS.get(ctx.options().oneOf("level", "medium", LEVELS.keySet()));
        String name = file.stem() + "_compressed.pdf";
        Path out = ctx.outputDir().resolve(name);

        int replaced;
        try (PDDocument doc = Pdfs.open(file)) {
            Pass pass = new Pass(doc, level);
            for (PDPage page : doc.getPages()) {
                pass.process(page.getResources());
            }
            replaced = pass.replaced;
            Pdfs.save(doc, out);
        }

        long before = Files.size(file.path());
        if (Files.size(out) >= before) {
            Files.copy(file.path(), out, StandardCopyOption.REPLACE_EXISTING); // already optimal
        }
        long after = Files.size(out);
        double saved = Math.max(0, Math.round((1 - (double) after / before) * 1000) / 10.0);
        return new ToolResult(out, name, Map.of(
                "originalSize", before, "compressedSize", after, "savedPercent", saved, "imagesOptimized", replaced));
    }

    /** One walk over the document's resources; shared images are converted once. */
    private static final class Pass {
        private final PDDocument doc;
        private final Level level;
        private final Map<COSBase, PDImageXObject> converted = new HashMap<>();
        private final Set<COSBase> skipped = new HashSet<>();
        private final Set<COSBase> visitedForms = new HashSet<>();
        int replaced;

        Pass(PDDocument doc, Level level) {
            this.doc = doc;
            this.level = level;
        }

        void process(PDResources resources) throws IOException {
            if (resources == null) {
                return;
            }
            for (COSName name : resources.getXObjectNames()) {
                PDXObject xobject;
                try {
                    xobject = resources.getXObject(name);
                } catch (IOException e) {
                    continue;
                }
                if (xobject instanceof PDImageXObject image) {
                    PDImageXObject smaller = convert(image);
                    if (smaller != null) {
                        resources.put(name, smaller);
                    }
                } else if (xobject instanceof PDFormXObject form && visitedForms.add(form.getCOSObject())) {
                    process(form.getResources());
                }
            }
        }

        private PDImageXObject convert(PDImageXObject image) {
            COSBase key = image.getCOSObject();
            if (converted.containsKey(key)) {
                return converted.get(key);
            }
            if (skipped.contains(key)) {
                return null;
            }
            PDImageXObject result = null;
            try {
                if (eligible(image)) {
                    BufferedImage source = image.getImage(); // soft mask (transparency) already applied as alpha
                    boolean gray = image.getColorSpace() instanceof PDDeviceGray;
                    boolean alpha = source.getColorModel().hasAlpha() && !Images.fullyOpaque(source);
                    BufferedImage scaled = scale(source, level.maxSide(), gray, alpha);
                    PDImageXObject jpeg = JPEGFactory.createFromImage(doc, scaled, level.quality());
                    if (jpeg.getCOSObject().getLength() < image.getCOSObject().getLength()) {
                        result = jpeg;
                        replaced++;
                    }
                }
            } catch (IOException | RuntimeException e) {
                log.debug("Skipping image that couldn't be re-encoded: {}", e.getMessage());
            }
            if (result == null) {
                skipped.add(key);
            } else {
                converted.put(key, result);
            }
            return result;
        }

        private static boolean eligible(PDImageXObject image) {
            var dict = image.getCOSObject();
            // Soft masks are kept (re-encoded alongside the image); colour-key/stencil masks are left alone
            return !image.isStencil()
                    && image.getBitsPerComponent() >= 8
                    && dict.getItem(COSName.MASK) == null
                    && image.getWidth() * (long) image.getHeight() > 64 * 64; // tiny images aren't worth it
        }

        private static BufferedImage scale(BufferedImage src, int maxSide, boolean gray, boolean alpha) {
            int w = src.getWidth();
            int h = src.getHeight();
            double factor = Math.min(1.0, (double) maxSide / Math.max(w, h));
            int nw = Math.max(1, (int) Math.round(w * factor));
            int nh = Math.max(1, (int) Math.round(h * factor));
            int type = alpha ? BufferedImage.TYPE_INT_ARGB : gray ? BufferedImage.TYPE_BYTE_GRAY : BufferedImage.TYPE_INT_RGB;
            BufferedImage dst = new BufferedImage(nw, nh, type);
            Graphics2D g = dst.createGraphics();
            try {
                g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
                g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
                if (!alpha) {
                    g.setColor(java.awt.Color.WHITE);
                    g.fillRect(0, 0, nw, nh);
                }
                g.drawImage(src, 0, 0, nw, nh, null);
            } finally {
                g.dispose();
            }
            return dst;
        }
    }
}
