package com.pdfnew.tool;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

/** Looks tools up by id. Every {@link PdfTool} bean registers itself. */
@Component
public class ToolRegistry {

    private final Map<String, PdfTool> tools;

    public ToolRegistry(List<PdfTool> tools) {
        this.tools = tools.stream().collect(Collectors.toUnmodifiableMap(PdfTool::id, Function.identity()));
    }

    public Optional<PdfTool> find(String id) {
        return Optional.ofNullable(tools.get(id));
    }

    public Collection<PdfTool> all() {
        return tools.values();
    }
}
