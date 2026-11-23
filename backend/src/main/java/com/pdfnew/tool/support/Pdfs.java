package com.pdfnew.tool.support;

import java.io.IOException;
import java.nio.file.Path;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.io.IOUtils;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;

import com.pdfnew.tool.ToolContext.InputFile;
import com.pdfnew.tool.ToolException;

/** Loading and saving PDFs with friendly errors and low memory use. */
public final class Pdfs {

    private Pdfs() {
    }

    /**
     * Opens a PDF for editing. Buffers to temp files instead of the heap, so large files
     * work on small instances. Owner-only restrictions are dropped; files that need a
     * password to open are rejected with a message pointing to the Unlock tool.
     */
    public static PDDocument open(InputFile file) {
        try {
            PDDocument doc = Loader.loadPDF(file.path().toFile(), "", null, null,
                    IOUtils.createTempFileOnlyStreamCache());
            if (doc.isEncrypted()) {
                doc.setAllSecurityToBeRemoved(true);
            }
            return doc;
        } catch (InvalidPasswordException e) {
            throw new ToolException("'" + file.originalName() + "' is password-protected. Unlock it first.", e);
        } catch (IOException | RuntimeException e) {
            throw new ToolException("'" + file.originalName() + "' isn't a valid PDF or is damaged.", e);
        }
    }

    /** Opens with a password; throws {@link InvalidPasswordException} if it's wrong. */
    public static PDDocument open(InputFile file, String password) throws IOException {
        try {
            return Loader.loadPDF(file.path().toFile(), password, null, null,
                    IOUtils.createTempFileOnlyStreamCache());
        } catch (InvalidPasswordException e) {
            throw e;
        } catch (IOException | RuntimeException e) {
            throw new ToolException("'" + file.originalName() + "' isn't a valid PDF or is damaged.", e);
        }
    }

    public static PDDocument newDocument() {
        return new PDDocument(IOUtils.createTempFileOnlyStreamCache());
    }

    public static Path save(PDDocument doc, Path target) throws IOException {
        doc.save(target.toFile());
        return target;
    }
}
