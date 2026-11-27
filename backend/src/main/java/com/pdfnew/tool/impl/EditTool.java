package com.pdfnew.tool.impl;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState;
import org.apache.pdfbox.pdmodel.interactive.form.PDAcroForm;
import org.apache.pdfbox.pdmodel.interactive.form.PDCheckBox;
import org.apache.pdfbox.pdmodel.interactive.form.PDField;
import org.apache.pdfbox.pdmodel.interactive.form.PDRadioButton;
import org.apache.pdfbox.util.Matrix;
import org.springframework.stereotype.Component;

import com.pdfnew.tool.PdfTool;
import com.pdfnew.tool.ToolContext;
import com.pdfnew.tool.ToolContext.InputFile;
import com.pdfnew.tool.ToolException;
import com.pdfnew.tool.ToolResult;
import com.pdfnew.tool.support.PageText;
import com.pdfnew.tool.support.Pdfs;

import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

/**
 * Adds things on top of a PDF: text, images and signatures, white-out boxes and highlights,
 * and fills in form fields.
 *
 * Files: the PDF first, then any images the edits use (PNG or JPG).
 * Options:
 * <ul>
 *   <li>{@code edits}: JSON list of {@link Edit}. Positions are fractions (0..1) of the page
 *       as the reader sees it, measured from the top-left corner.</li>
 *   <li>{@code fields}: JSON object of form field name to value ("true"/"false" for checkboxes).</li>
 * </ul>
 */
@Component
public class EditTool implements PdfTool {

    static final int MAX_EDITS = 500;
    static final int MAX_TEXT = 2000;
    /** Distance from the top of a text box to the first baseline, as a fraction of the font size
     *  (matches the browser preview: Helvetica/Arial with line-height 1.2). */
    static final float FIRST_BASELINE = 0.95f;
    static final float LINE_HEIGHT = 1.2f;

    private static final JsonMapper JSON = JsonMapper.builder()
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();

    /** One thing to add. {@code type}: text | image | whiteout | highlight. */
    public record Edit(Integer page, String type, Double x, Double y, Double w, Double h,
                       String text, Double size, String color, Boolean bold, Integer image) {

        /** Missing numbers count as 0 (text boxes, for example, send no width or height). */
        public Edit {
            page = page == null ? 0 : page;
            x = x == null ? 0 : x;
            y = y == null ? 0 : y;
            w = w == null ? 0 : w;
            h = h == null ? 0 : h;
        }
    }

    @Override
    public String id() {
        return "edit";
    }

    @Override
    public Set<String> accepts() {
        return Set.of("pdf", "png", "jpg", "jpeg");
    }

    @Override
    public int maxFiles() {
        return 20;
    }

    @Override
    public ToolResult run(ToolContext ctx) throws IOException {
        List<InputFile> files = ctx.files();
        InputFile pdf = files.getFirst();
        if (!pdf.originalName().toLowerCase().endsWith(".pdf")) {
            throw new ToolException("Choose a PDF to edit.");
        }
        List<InputFile> images = files.subList(1, files.size());
        for (InputFile img : images) {
            if (img.originalName().toLowerCase().endsWith(".pdf")) {
                throw new ToolException("Edit one PDF at a time.");
            }
        }

        List<Edit> edits = parse(ctx.options().string("edits", "[]"), new TypeReference<List<Edit>>() { }, "edits");
        Map<String, String> fields = parse(ctx.options().string("fields", "{}"), new TypeReference<Map<String, String>>() { }, "fields");
        if (edits.size() > MAX_EDITS) {
            throw new ToolException("That's a lot of changes. Please keep it under " + MAX_EDITS + ".");
        }
        if (edits.isEmpty() && fields.isEmpty()) {
            throw new ToolException("Add some text, a signature or another change first.");
        }

        try (PDDocument doc = Pdfs.open(pdf)) {
            int pageCount = doc.getNumberOfPages();
            Map<Integer, List<Edit>> byPage = new HashMap<>();
            for (Edit e : edits) {
                check(e, pageCount, images.size());
                byPage.computeIfAbsent(e.page(), k -> new ArrayList<>()).add(e);
            }

            Map<Integer, PDImageXObject> loaded = new HashMap<>();
            for (var entry : byPage.entrySet()) {
                PDPage page = doc.getPage(entry.getKey() - 1);
                apply(doc, page, entry.getValue(), images, loaded);
            }
            int filled = fill(doc, fields);

            String name = pdf.stem() + "_edited.pdf";
            Path out = Pdfs.save(doc, ctx.outputDir().resolve(name));
            return new ToolResult(out, name, Map.of("changes", edits.size(), "fields", filled, "pages", byPage.size()));
        }
    }

    private static <T> T parse(String json, TypeReference<T> type, String what) {
        try {
            T value = JSON.readValue(json, type);
            if (value == null) {
                throw new ToolException("The " + what + " sent by the editor couldn't be read.");
            }
            return value;
        } catch (JacksonException e) {
            throw new ToolException("The " + what + " sent by the editor couldn't be read.", e);
        }
    }

    private static void check(Edit e, int pageCount, int imageCount) {
        if (e.page() < 1 || e.page() > pageCount) {
            throw new ToolException("An edit points to page " + e.page() + ", but the PDF has " + pageCount + " pages.");
        }
        if (!inRange(e.x(), -0.5, 1.5) || !inRange(e.y(), -0.5, 1.5) || !inRange(e.w(), 0, 2) || !inRange(e.h(), 0, 2)) {
            throw new ToolException("An edit has an invalid position.");
        }
        switch (e.type() == null ? "" : e.type()) {
            case "text" -> {
                if (e.text() == null || e.text().length() > MAX_TEXT) {
                    throw new ToolException("Text boxes can hold up to " + MAX_TEXT + " characters.");
                }
                double size = e.size() == null ? 14 : e.size();
                if (!inRange(size, 4, 144)) {
                    throw new ToolException("Text size must be between 4 and 144.");
                }
            }
            case "image" -> {
                if (e.image() == null || e.image() < 1 || e.image() > imageCount) {
                    throw new ToolException("An image or signature is missing. Please add it again.");
                }
            }
            case "whiteout", "highlight" -> {
                // position checks above are enough
            }
            default -> throw new ToolException("Unknown kind of edit '" + e.type() + "'.");
        }
    }

    private static boolean inRange(double v, double min, double max) {
        return Double.isFinite(v) && v >= min && v <= max;
    }

    /** Draws a page's edits in the order given (later ones on top). */
    private static void apply(PDDocument doc, PDPage page, List<Edit> edits, List<InputFile> images,
                              Map<Integer, PDImageXObject> loaded) throws IOException {
        float pw = PageText.visualWidth(page);
        float ph = PageText.visualHeight(page);
        // Check every text box first, so a bad character doesn't leave a half-edited page
        for (Edit e : edits) {
            if ("text".equals(e.type())) {
                PageText.width(font(e), e.text().replace("\r", "").replace("\n", ""), 12);
            }
        }
        try (PDPageContentStream cs = new PDPageContentStream(doc, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
            cs.transform(visualToPage(page));
            for (Edit e : edits) {
                float x = (float) (e.x() * pw);
                float w = (float) (e.w() * pw);
                float h = (float) (e.h() * ph);
                float top = (float) (ph - e.y() * ph); // visual y of the box's top edge
                switch (e.type()) {
                    case "whiteout" -> rect(cs, x, top - h, w, h, rgb(e.color(), "#ffffff"), 1f);
                    case "highlight" -> rect(cs, x, top - h, w, h, rgb(e.color(), "#ffe066"), 0.4f);
                    case "image" -> {
                        PDImageXObject img = loaded.get(e.image());
                        if (img == null) {
                            img = image(doc, images.get(e.image() - 1));
                            loaded.put(e.image(), img);
                        }
                        cs.drawImage(img, x, top - h, w, h);
                    }
                    case "text" -> text(cs, e, x, top);
                    default -> throw new IllegalStateException(e.type());
                }
            }
        }
    }

    private static PDFont font(Edit e) {
        return Boolean.TRUE.equals(e.bold()) ? PageText.BOLD : PageText.REGULAR;
    }

    private static void text(PDPageContentStream cs, Edit e, float x, float top) throws IOException {
        float size = (float) (e.size() == null ? 14 : e.size().doubleValue());
        PDFont font = font(e);
        float[] c = rgb(e.color(), "#000000");
        String[] lines = e.text().replace("\r", "").split("\n", -1);
        cs.saveGraphicsState();
        cs.setNonStrokingColor(c[0], c[1], c[2]);
        cs.beginText();
        cs.setFont(font, size);
        cs.setLeading(size * LINE_HEIGHT);
        cs.newLineAtOffset(x, top - size * FIRST_BASELINE);
        for (int i = 0; i < lines.length; i++) {
            if (i > 0) {
                cs.newLine();
            }
            cs.showText(lines[i]);
        }
        cs.endText();
        cs.restoreGraphicsState();
    }

    private static void rect(PDPageContentStream cs, float x, float y, float w, float h, float[] c, float opacity) throws IOException {
        cs.saveGraphicsState();
        if (opacity < 1f) {
            PDExtendedGraphicsState gs = new PDExtendedGraphicsState();
            gs.setNonStrokingAlphaConstant(opacity);
            cs.setGraphicsStateParameters(gs);
        }
        cs.setNonStrokingColor(c[0], c[1], c[2]);
        cs.addRect(x, y, w, h);
        cs.fill();
        cs.restoreGraphicsState();
    }

    private static PDImageXObject image(PDDocument doc, InputFile file) {
        try {
            return PDImageXObject.createFromFileByContent(file.path().toFile(), doc);
        } catch (IOException | IllegalArgumentException e) {
            throw new ToolException("'" + file.originalName() + "' isn't a valid PNG or JPG image.", e);
        }
    }

    /** "#rrggbb" to 0..1 components; anything else falls back. */
    static float[] rgb(String hex, String fallback) {
        String h = hex != null && hex.matches("#[0-9a-fA-F]{6}") ? hex : fallback;
        int v = Integer.parseInt(h.substring(1), 16);
        return new float[] {((v >> 16) & 0xff) / 255f, ((v >> 8) & 0xff) / 255f, (v & 0xff) / 255f};
    }

    /**
     * Maps "visual" coordinates (origin at the bottom-left of the page as the reader sees it)
     * to the page's own coordinates, taking /Rotate and the crop box into account.
     */
    static Matrix visualToPage(PDPage page) {
        PDRectangle box = page.getCropBox();
        float x0 = box.getLowerLeftX();
        float y0 = box.getLowerLeftY();
        float w = box.getWidth();
        float h = box.getHeight();
        return switch (Math.floorMod(page.getRotation(), 360)) {
            case 90 -> new Matrix(0, 1, -1, 0, x0 + w, y0);
            case 180 -> new Matrix(-1, 0, 0, -1, x0 + w, y0 + h);
            case 270 -> new Matrix(0, -1, 1, 0, x0, y0 + h);
            default -> new Matrix(1, 0, 0, 1, x0, y0);
        };
    }

    /** Fills form fields; returns how many were set. */
    private static int fill(PDDocument doc, Map<String, String> values) throws IOException {
        if (values.isEmpty()) {
            return 0;
        }
        PDAcroForm form = doc.getDocumentCatalog().getAcroForm();
        if (form == null) {
            return 0;
        }
        int count = 0;
        for (var entry : values.entrySet()) {
            PDField field = form.getField(entry.getKey());
            String value = entry.getValue() == null ? "" : entry.getValue();
            if (field == null || field.isReadOnly() || value.length() > MAX_TEXT) {
                continue;
            }
            try {
                if (field instanceof PDCheckBox box) {
                    if (Boolean.parseBoolean(value)) {
                        box.check();
                    } else {
                        box.unCheck();
                    }
                } else if (field instanceof PDRadioButton radio) {
                    if (!value.isEmpty()) {
                        radio.setValue(value);
                    }
                } else {
                    field.setValue(value);
                }
                count++;
            } catch (IllegalArgumentException e) {
                throw new ToolException("The form field '" + field.getPartialName()
                        + "' can't show some of the characters you typed. Try plain letters and numbers.", e);
            }
        }
        return count;
    }
}
