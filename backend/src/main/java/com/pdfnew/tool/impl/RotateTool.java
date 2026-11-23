package com.pdfnew.tool.impl;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Map;
import java.util.Set;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.springframework.stereotype.Component;

import com.pdfnew.tool.PdfTool;
import com.pdfnew.tool.ToolContext;
import com.pdfnew.tool.ToolContext.InputFile;
import com.pdfnew.tool.ToolException;
import com.pdfnew.tool.ToolResult;
import com.pdfnew.tool.support.PageRanges;
import com.pdfnew.tool.support.Pdfs;

/**
 * Two ways to call it:
 * <ul>
 * <li>angle = 90 | 180 | 270 (clockwise) and pages = "all" or "1-3, 5"</li>
 * <li>rotations = "90,0,270" with one clockwise angle per page (used by the page grid in the UI)</li>
 * </ul>
 */
@Component
public class RotateTool implements PdfTool {

    @Override
    public String id() {
        return "rotate";
    }

    @Override
    public Set<String> accepts() {
        return Set.of("pdf");
    }

    @Override
    public ToolResult run(ToolContext ctx) throws IOException {
        InputFile file = ctx.single();
        String perPage = ctx.options().string("rotations", null);
        try (PDDocument doc = Pdfs.open(file)) {
            int count = doc.getNumberOfPages();
            int[] angles = perPage != null ? perPageAngles(perPage, count) : uniformAngles(ctx, count);
            int rotated = 0;
            int i = 0;
            for (PDPage page : doc.getPages()) {
                int angle = angles[i++];
                if (angle != 0) {
                    page.setRotation(Math.floorMod(page.getRotation() + angle, 360));
                    rotated++;
                }
            }
            if (rotated == 0) {
                throw new ToolException("Choose at least one page to rotate.");
            }
            String name = file.stem() + "_rotated.pdf";
            Path out = Pdfs.save(doc, ctx.outputDir().resolve(name));
            return new ToolResult(out, name, Map.of("pages", rotated));
        }
    }

    private static int[] uniformAngles(ToolContext ctx, int count) {
        int angle = Integer.parseInt(ctx.options().oneOf("angle", "90", Set.of("90", "180", "270")));
        int[] angles = new int[count];
        for (int index : PageRanges.indices(ctx.options().string("pages", "all"), count)) {
            angles[index] = angle;
        }
        return angles;
    }

    private static int[] perPageAngles(String csv, int count) {
        String[] parts = csv.split(",");
        if (parts.length != count) {
            throw new ToolException("Give one rotation per page: this PDF has " + count + " pages.");
        }
        int[] angles = new int[count];
        for (int i = 0; i < count; i++) {
            try {
                angles[i] = Math.floorMod(Integer.parseInt(parts[i].trim()), 360);
            } catch (NumberFormatException e) {
                throw new ToolException("Invalid page rotations.");
            }
            if (angles[i] % 90 != 0) {
                throw new ToolException("Pages can only be rotated by 90, 180 or 270 degrees.");
            }
        }
        return angles;
    }
}
