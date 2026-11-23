package com.pdfnew.tool.support;

import java.util.ArrayList;
import java.util.List;

import com.pdfnew.tool.ToolException;

/**
 * Parses page selections typed by users: "1-3, 5, 8-" (open-ended ranges allowed).
 * Page numbers are 1-based in the input and 0-based in the output.
 */
public final class PageRanges {

    public record Range(int from, int to) {
        /** Zero-based, inclusive. */
        public List<Integer> indices() {
            List<Integer> list = new ArrayList<>();
            for (int i = from; i <= to; i++) {
                list.add(i);
            }
            return list;
        }

        public String label() {
            return from == to ? String.valueOf(from + 1) : (from + 1) + "-" + (to + 1);
        }
    }

    private PageRanges() {
    }

    /** Each comma-separated part becomes one range. Blank or "all" means every page. */
    public static List<Range> parse(String spec, int pageCount) {
        String s = spec == null ? "" : spec.replace(" ", "").toLowerCase();
        if (s.isEmpty() || s.equals("all")) {
            return List.of(new Range(0, pageCount - 1));
        }
        List<Range> ranges = new ArrayList<>();
        for (String part : s.split(",")) {
            if (part.isEmpty()) {
                continue;
            }
            int from;
            int to;
            try {
                int dash = part.indexOf('-');
                if (dash >= 0) {
                    String a = part.substring(0, dash);
                    String b = part.substring(dash + 1);
                    from = a.isEmpty() ? 1 : Integer.parseInt(a);
                    to = b.isEmpty() ? pageCount : Integer.parseInt(b);
                } else {
                    from = to = Integer.parseInt(part);
                }
            } catch (NumberFormatException e) {
                throw new ToolException("'" + part + "' isn't a valid page or range. Use e.g. 1-3, 5.");
            }
            if (from < 1 || to > pageCount || from > to) {
                throw new ToolException("Pages '" + part + "' are out of range: this PDF has " + pageCount
                        + (pageCount == 1 ? " page." : " pages."));
            }
            ranges.add(new Range(from - 1, to - 1));
        }
        if (ranges.isEmpty()) {
            throw new ToolException("No pages selected.");
        }
        return ranges;
    }

    /** All selected page indices, in the order given. */
    public static List<Integer> indices(String spec, int pageCount) {
        List<Integer> all = new ArrayList<>();
        for (Range r : parse(spec, pageCount)) {
            all.addAll(r.indices());
        }
        return all;
    }
}
