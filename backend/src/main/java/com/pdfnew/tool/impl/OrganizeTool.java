package com.pdfnew.tool.impl;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageTree;
import org.springframework.stereotype.Component;

import com.pdfnew.tool.PdfTool;
import com.pdfnew.tool.ToolContext;
import com.pdfnew.tool.ToolContext.InputFile;
import com.pdfnew.tool.ToolException;
import com.pdfnew.tool.ToolResult;
import com.pdfnew.tool.support.Pdfs;

/**
 * Reorder, remove and rotate individual pages, driven by the page grid in the UI.
 * Options: order = "3,1,2" (1-based pages to keep, in new order; omitted pages are removed),
 * rotations = "0,90,0" (optional, one clockwise angle per entry in order).
 */
@Component
public class OrganizeTool implements PdfTool {

    @Override
    public String id() {
        return "organize";
    }

    @Override
    public Set<String> accepts() {
        return Set.of("pdf");
    }

    @Override
    public ToolResult run(ToolContext ctx) throws IOException {
        InputFile file = ctx.single();
        try (PDDocument doc = Pdfs.open(file)) {
            int count = doc.getNumberOfPages();
            List<Integer> order = parseList(ctx.options().required("order", "Keep at least one page."), "page order");
            List<Integer> angles = parseList(ctx.options().string("rotations", ""), "rotations");
            if (order.isEmpty()) {
                throw new ToolException("Keep at least one page.");
            }
            if (new HashSet<>(order).size() != order.size()) {
                throw new ToolException("A page can only appear once.");
            }
            for (int p : order) {
                if (p < 1 || p > count) {
                    throw new ToolException("Page " + p + " doesn't exist: this PDF has " + count + " pages.");
                }
            }
            if (!angles.isEmpty() && (angles.size() != order.size() || angles.stream().anyMatch(a -> a % 90 != 0))) {
                throw new ToolException("Invalid page rotations.");
            }

            // Rebuild the page tree in place, which keeps document-level data (metadata, outlines, forms)
            PDPageTree tree = doc.getPages();
            List<PDPage> original = new ArrayList<>();
            tree.forEach(original::add);
            original.forEach(tree::remove);
            for (int i = 0; i < order.size(); i++) {
                PDPage page = original.get(order.get(i) - 1);
                if (!angles.isEmpty()) {
                    page.setRotation(Math.floorMod(page.getRotation() + angles.get(i), 360));
                }
                tree.add(page);
            }

            String name = file.stem() + "_organized.pdf";
            Path out = Pdfs.save(doc, ctx.outputDir().resolve(name));
            return new ToolResult(out, name, Map.of("pages", order.size(), "removed", count - order.size()));
        }
    }

    private static List<Integer> parseList(String csv, String what) {
        List<Integer> list = new ArrayList<>();
        for (String part : csv.split(",")) {
            if (!part.isBlank()) {
                try {
                    list.add(Integer.parseInt(part.trim()));
                } catch (NumberFormatException e) {
                    throw new ToolException("Invalid " + what + ".");
                }
            }
        }
        return list;
    }
}
