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
import com.pdfnew.tool.ToolResult;
import com.pdfnew.tool.support.PageRanges;
import com.pdfnew.tool.support.PageText;
import com.pdfnew.tool.support.Pdfs;

/**
 * Adds page numbers.
 * Options: position = bottom-center | bottom-right | bottom-left | top-center | top-right | top-left,
 * format = number ("3") | page ("Page 3") | of ("Page 3 of 10"), start (first number, default 1),
 * pages = which pages get a number ("all" or "2-"); numbering counts only those pages.
 */
@Component
public class PageNumbersTool implements PdfTool {

    private static final Set<String> POSITIONS =
            Set.of("bottom-center", "bottom-right", "bottom-left", "top-center", "top-right", "top-left");
    private static final float MARGIN = 28f;
    private static final float SIZE = 11f;

    @Override
    public String id() {
        return "page-numbers";
    }

    @Override
    public Set<String> accepts() {
        return Set.of("pdf");
    }

    @Override
    public ToolResult run(ToolContext ctx) throws IOException {
        InputFile file = ctx.single();
        String position = ctx.options().oneOf("position", "bottom-center", POSITIONS);
        String format = ctx.options().oneOf("format", "number", Set.of("number", "page", "of"));
        int start = ctx.options().integer("start", 1, 0, 100_000);
        boolean top = position.startsWith("top");
        PageText.Align align = position.endsWith("left") ? PageText.Align.LEFT
                : position.endsWith("right") ? PageText.Align.RIGHT : PageText.Align.CENTER;

        try (PDDocument doc = Pdfs.open(file)) {
            Set<Integer> selected = new HashSet<>(PageRanges.indices(ctx.options().string("pages", "all"), doc.getNumberOfPages()));
            int total = start + selected.size() - 1;
            int number = start;
            int i = 0;
            for (PDPage page : doc.getPages()) {
                if (!selected.contains(i++)) {
                    continue;
                }
                String label = switch (format) {
                    case "page" -> "Page " + number;
                    case "of" -> "Page " + number + " of " + total;
                    default -> String.valueOf(number);
                };
                float w = PageText.visualWidth(page);
                float h = PageText.visualHeight(page);
                float x = switch (align) {
                    case LEFT -> MARGIN;
                    case RIGHT -> w - MARGIN;
                    case CENTER -> w / 2;
                };
                float y = top ? h - MARGIN - SIZE : MARGIN;
                PageText.draw(doc, page, label, PageText.REGULAR, SIZE, x, y, 0f, align, 0.2f, 1f);
                number++;
            }
            String name = file.stem() + "_numbered.pdf";
            Path out = Pdfs.save(doc, ctx.outputDir().resolve(name));
            return new ToolResult(out, name, Map.of("pages", selected.size()));
        }
    }
}
