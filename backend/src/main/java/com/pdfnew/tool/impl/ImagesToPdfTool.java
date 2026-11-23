package com.pdfnew.tool.impl;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.JPEGFactory;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Component;

import com.drew.imaging.ImageMetadataReader;
import com.drew.metadata.Metadata;
import com.drew.metadata.exif.ExifIFD0Directory;
import com.pdfnew.tool.PdfTool;
import com.pdfnew.tool.ToolContext;
import com.pdfnew.tool.ToolContext.InputFile;
import com.pdfnew.tool.ToolException;
import com.pdfnew.tool.ToolResult;
import com.pdfnew.tool.support.Images;
import com.pdfnew.tool.support.Pdfs;

/**
 * One page per image, in upload order. JPEGs are embedded as-is (no quality loss); other
 * formats are stored losslessly. EXIF orientation is honoured so phone photos aren't sideways.
 * Options: pageSize = fit | a4 | letter, orientation = auto | portrait | landscape,
 * margin = none | small | large.
 */
@Component
public class ImagesToPdfTool implements PdfTool {

    private static final Map<String, Float> MARGINS = Map.of("none", 0f, "small", 20f, "large", 40f);
    private static final float PX_TO_PT = 0.75f; // 96 dpi when the page fits the image

    @Override
    public String id() {
        return "jpg-to-pdf";
    }

    @Override
    public Set<String> accepts() {
        return Set.of("jpg", "jpeg", "png", "webp", "gif", "bmp", "tif", "tiff");
    }

    @Override
    public int maxFiles() {
        return 20;
    }

    @Override
    public ToolResult run(ToolContext ctx) throws IOException {
        String pageSize = ctx.options().oneOf("pageSize", "fit", Set.of("fit", "a4", "letter"));
        String orientation = ctx.options().oneOf("orientation", "auto", Set.of("auto", "portrait", "landscape"));
        float margin = MARGINS.get(ctx.options().oneOf("margin", "none", MARGINS.keySet()));

        try (PDDocument doc = Pdfs.newDocument()) {
            for (InputFile file : ctx.files()) {
                PDImageXObject image = load(doc, file);
                int rotation = exifRotation(file.path());
                boolean sideways = rotation == 90 || rotation == 270;
                // Size of the image as the viewer will see it
                float visualW = (sideways ? image.getHeight() : image.getWidth()) * PX_TO_PT;
                float visualH = (sideways ? image.getWidth() : image.getHeight()) * PX_TO_PT;

                float pageW;
                float pageH;
                if (pageSize.equals("fit")) {
                    pageW = visualW + 2 * margin;
                    pageH = visualH + 2 * margin;
                } else {
                    PDRectangle base = pageSize.equals("a4") ? PDRectangle.A4 : PDRectangle.LETTER;
                    boolean landscape = orientation.equals("landscape")
                            || (orientation.equals("auto") && visualW > visualH);
                    pageW = landscape ? base.getHeight() : base.getWidth();
                    pageH = landscape ? base.getWidth() : base.getHeight();
                }

                // The page is stored unrotated and given a /Rotate so the image shows upright.
                float boxW = sideways ? pageH : pageW;
                float boxH = sideways ? pageW : pageH;
                PDPage page = new PDPage(new PDRectangle(boxW, boxH));
                page.setRotation(rotation);
                doc.addPage(page);

                float availW = boxW - 2 * margin;
                float availH = boxH - 2 * margin;
                float scale = Math.min(availW / image.getWidth(), availH / image.getHeight());
                if (pageSize.equals("fit")) {
                    scale = PX_TO_PT;
                }
                float drawW = image.getWidth() * scale;
                float drawH = image.getHeight() * scale;
                try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                    cs.drawImage(image, (boxW - drawW) / 2, (boxH - drawH) / 2, drawW, drawH);
                }
            }
            String name = ctx.files().size() == 1 ? ctx.single().stem() + ".pdf" : "images.pdf";
            Path out = Pdfs.save(doc, ctx.outputDir().resolve(name));
            return new ToolResult(out, name, Map.of("pages", ctx.files().size()));
        }
    }

    private static PDImageXObject load(PDDocument doc, InputFile file) throws IOException {
        String format;
        int bands = -1;
        try (ImageInputStream iis = ImageIO.createImageInputStream(file.path().toFile())) {
            Iterator<ImageReader> readers = iis == null ? null : ImageIO.getImageReaders(iis);
            if (readers == null || !readers.hasNext()) {
                throw new ToolException("'" + file.originalName() + "' isn't a supported image.");
            }
            ImageReader reader = readers.next();
            format = reader.getFormatName().toLowerCase();
            if (format.contains("jp")) {
                try {
                    reader.setInput(iis);
                    bands = reader.getRawImageType(0) == null ? -1 : reader.getRawImageType(0).getNumBands();
                } catch (IOException | RuntimeException ignored) {
                    bands = -1;
                } finally {
                    reader.dispose();
                }
            }
        }
        try {
            if (format.contains("jp") && (bands == 1 || bands == 3)) {
                try (InputStream in = Files.newInputStream(file.path())) {
                    return JPEGFactory.createFromStream(doc, in); // embedded as-is
                }
            }
            BufferedImage img = ImageIO.read(file.path().toFile());
            if (img == null) {
                throw new ToolException("'" + file.originalName() + "' isn't a supported image.");
            }
            if (img.getColorModel().hasAlpha() && Images.fullyOpaque(img)) {
                img = Images.onWhite(img); // avoids a pointless soft mask (common with screenshots)
            }
            return LosslessFactory.createFromImage(doc, img);
        } catch (ToolException e) {
            throw e;
        } catch (IOException | RuntimeException e) {
            throw new ToolException("'" + file.originalName() + "' couldn't be read as an image.", e);
        }
    }

    /** Clockwise page rotation that undoes the camera's EXIF orientation. */
    private static int exifRotation(Path path) {
        try {
            Metadata metadata = ImageMetadataReader.readMetadata(path.toFile());
            ExifIFD0Directory exif = metadata.getFirstDirectoryOfType(ExifIFD0Directory.class);
            if (exif == null || !exif.containsTag(ExifIFD0Directory.TAG_ORIENTATION)) {
                return 0;
            }
            return switch (exif.getInt(ExifIFD0Directory.TAG_ORIENTATION)) {
                case 3 -> 180;
                case 6 -> 90;
                case 8 -> 270;
                default -> 0;
            };
        } catch (Exception e) {
            return 0;
        }
    }
}
