package com.pdfnew.tool.support;

import java.io.IOException;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState;
import org.apache.pdfbox.util.Matrix;

import com.pdfnew.tool.ToolException;

/**
 * Draws text on a page in "visual" coordinates: (0,0) is the bottom-left corner of the page
 * as the reader sees it, even when the page has a /Rotate. Text always reads upright.
 */
public final class PageText {

    public enum Align { LEFT, CENTER, RIGHT }

    public static final PDFont BOLD = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
    public static final PDFont REGULAR = new PDType1Font(Standard14Fonts.FontName.HELVETICA);

    private PageText() {
    }

    /** Page size as displayed (width/height swapped for 90/270 rotation). */
    public static float visualWidth(PDPage page) {
        PDRectangle box = page.getCropBox();
        return sideways(page) ? box.getHeight() : box.getWidth();
    }

    public static float visualHeight(PDPage page) {
        PDRectangle box = page.getCropBox();
        return sideways(page) ? box.getWidth() : box.getHeight();
    }

    private static boolean sideways(PDPage page) {
        int r = Math.floorMod(page.getRotation(), 360);
        return r == 90 || r == 270;
    }

    /** Width of the text in points; rejects characters the built-in fonts can't draw. */
    public static float width(PDFont font, String text, float size) {
        try {
            return font.getStringWidth(text) / 1000f * size;
        } catch (IllegalArgumentException | IOException e) {
            throw new ToolException("Use letters, numbers and common symbols only (other alphabets aren't supported yet).");
        }
    }

    /**
     * Draws {@code text} with its anchor at visual point (vx, vy), rotated by {@code angle}
     * degrees counter-clockwise (as seen by the reader), aligned around the anchor.
     */
    public static void draw(PDDocument doc, PDPage page, String text, PDFont font, float size,
                            float vx, float vy, float angle, Align align, float gray, float opacity) throws IOException {
        PDRectangle box = page.getCropBox();
        float x0 = box.getLowerLeftX();
        float y0 = box.getLowerLeftY();
        float w = box.getWidth();
        float h = box.getHeight();
        int rotation = Math.floorMod(page.getRotation(), 360);

        // Map the reader's coordinates back to the page's unrotated coordinates
        float ux;
        float uy;
        switch (rotation) {
            case 90 -> { ux = x0 + w - vy; uy = y0 + vx; }
            case 180 -> { ux = x0 + w - vx; uy = y0 + h - vy; }
            case 270 -> { ux = x0 + vy; uy = y0 + h - vx; }
            default -> { ux = x0 + vx; uy = y0 + vy; }
        }

        float textWidth = width(font, text, size);
        float shift = switch (align) {
            case LEFT -> 0;
            case CENTER -> textWidth / 2;
            case RIGHT -> textWidth;
        };

        try (PDPageContentStream cs = new PDPageContentStream(doc, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
            if (opacity < 1f) {
                PDExtendedGraphicsState state = new PDExtendedGraphicsState();
                state.setNonStrokingAlphaConstant(opacity);
                cs.setGraphicsStateParameters(state);
            }
            cs.setNonStrokingColor(gray, gray, gray);
            cs.beginText();
            cs.setFont(font, size);
            cs.setTextMatrix(Matrix.getRotateInstance(Math.toRadians(angle + rotation), ux, uy));
            cs.newLineAtOffset(-shift, 0);
            cs.showText(text);
            cs.endText();
        }
    }
}
