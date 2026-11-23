package com.pdfnew.tool.impl;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Set;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.springframework.stereotype.Component;

import com.pdfnew.tool.PdfTool;
import com.pdfnew.tool.ToolContext;
import com.pdfnew.tool.ToolContext.InputFile;
import com.pdfnew.tool.ToolException;
import com.pdfnew.tool.ToolResult;
import com.pdfnew.tool.support.Pdfs;

/**
 * Removes the password and restrictions from a PDF the user can open.
 * Option: password (may be blank for files that only have editing restrictions).
 */
@Component
public class UnlockTool implements PdfTool {

    @Override
    public String id() {
        return "unlock";
    }

    @Override
    public Set<String> accepts() {
        return Set.of("pdf");
    }

    @Override
    public ToolResult run(ToolContext ctx) throws IOException {
        InputFile file = ctx.single();
        String password = ctx.options().values().getOrDefault("password", "");
        try (PDDocument doc = Pdfs.open(file, password)) {
            if (!doc.isEncrypted()) {
                throw new ToolException("This PDF isn't password-protected.");
            }
            doc.setAllSecurityToBeRemoved(true);
            String name = file.stem() + "_unlocked.pdf";
            Path out = Pdfs.save(doc, ctx.outputDir().resolve(name));
            return ToolResult.of(out, name);
        } catch (InvalidPasswordException e) {
            throw new ToolException(password.isEmpty() ? "This PDF needs its password to unlock." : "Wrong password.", e);
        }
    }
}
