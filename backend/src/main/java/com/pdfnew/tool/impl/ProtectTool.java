package com.pdfnew.tool.impl;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Map;
import java.util.Set;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.AccessPermission;
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy;
import org.springframework.stereotype.Component;

import com.pdfnew.tool.PdfTool;
import com.pdfnew.tool.ToolContext;
import com.pdfnew.tool.ToolContext.InputFile;
import com.pdfnew.tool.ToolException;
import com.pdfnew.tool.ToolResult;
import com.pdfnew.tool.support.Pdfs;

/** Encrypts with AES-256; the password is needed to open the file. Option: password. */
@Component
public class ProtectTool implements PdfTool {

    @Override
    public String id() {
        return "protect";
    }

    @Override
    public Set<String> accepts() {
        return Set.of("pdf");
    }

    @Override
    public ToolResult run(ToolContext ctx) throws IOException {
        InputFile file = ctx.single();
        String password = ctx.options().values().getOrDefault("password", "");
        if (password.length() < 4) {
            throw new ToolException("Password must be at least 4 characters.");
        }
        if (password.length() > 128) {
            throw new ToolException("Password must be at most 128 characters.");
        }
        try (PDDocument doc = Pdfs.open(file)) {
            StandardProtectionPolicy policy = new StandardProtectionPolicy(password, password, new AccessPermission());
            policy.setEncryptionKeyLength(256);
            doc.setAllSecurityToBeRemoved(false);
            doc.protect(policy);
            String name = file.stem() + "_protected.pdf";
            Path out = Pdfs.save(doc, ctx.outputDir().resolve(name));
            return new ToolResult(out, name, Map.of("encryption", "AES-256"));
        }
    }
}
