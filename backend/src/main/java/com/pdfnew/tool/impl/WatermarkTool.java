package com.pdfnew.tool.impl;

import java.io.IOException;
import java.nio.file.Path;
import java.util.HashSet;
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
import com.pdfnew.tool.support.PageText;
import com.pdfnew.tool.support.Pdfs;

/**
 * Stamps a text watermark across pages.
 * Options: text (required), layout = diagonal | horizontal, size = small | medium | large,
 * opacity = light | medium | strong, pages = "all" or "1-3, 5".
 */
@Component
public class WatermarkTool implements PdfTool {

    private static final Map<String, Float> SIZES = Map.of("small", 36f, "medium", 60f, "large", 90f);
    private static final Map<String, Float> OPACITY = Map.of("light", 0.15f, "medium", 0.3f, "strong", 0.5f);

    @Override
    public String id() {
        return "watermark";
    }

    @Override
    public Set<String> accepts() {
        return Set.of("pdf");
    }

    @Override
    public ToolResult run(ToolContext ctx) throws IOException {
        InputFile file = ctx.single();
        String text = ctx.options().required("text", "Type the watermark text.").strip();
        if (text.length() > 60) {
            throw new ToolException("Keep the watermark under 60 characters.");
        }
        boolean diagonal = ctx.options().oneOf("layout", "diagonal", Set.of("diagonal", "horizontal")).equals("diagonal");
        float size = SIZES.get(ctx.options().oneOf("size", "medium", SIZES.keySet()));
        float opacity = OPACITY.get(ctx.options().oneOf("opacity", "medium", OPACITY.keySet()));
        PageText.width(PageText.BOLD, text, size); // fail early on unsupported characters

        try (PDDocument doc = Pdfs.open(file)) {
            Set<Integer> selected = new HashSet<>(PageRanges.indices(ctx.options().string("pages", "all"), doc.getNumberOfPages()));
            int i = 0;
            for (PDPage page : doc.getPages()) {
                if (!selected.contains(i++)) {
                    continue;
                }
                float w = PageText.visualWidth(page);
                float h = PageText.visualHeight(page);
                float angle = diagonal ? (float) Math.toDegrees(Math.atan2(h, w)) : 0f;
                float room = (diagonal ? (float) Math.hypot(w, h) : w) * 0.85f;
                // Shrink long text so it always fits on the page
                float fitted = Math.min(size, size * room / PageText.width(PageText.BOLD, text, size));
                // Centre the text vertically around the middle of the page
                float lift = fitted * 0.35f;
                float cx = w / 2 + (diagonal ? (float) (lift * Math.sin(Math.toRadians(angle))) : 0);
                float cy = h / 2 - (diagonal ? (float) (lift * Math.cos(Math.toRadians(angle))) : lift);
                PageText.draw(doc, page, text, PageText.BOLD, fitted, cx, cy, angle, PageText.Align.CENTER, 0.45f, opacity);
            }
            String name = file.stem() + "_watermarked.pdf";
            Path out = Pdfs.save(doc, ctx.outputDir().resolve(name));
            return new ToolResult(out, name, Map.of("pages", selected.size()));
        }
    }
}
