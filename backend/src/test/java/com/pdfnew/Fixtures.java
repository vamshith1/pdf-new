package com.pdfnew;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import javax.imageio.ImageIO;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.encryption.AccessPermission;
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;

/** Builds small test PDFs and images in memory. */
public final class Fixtures {

    private Fixtures() {
    }

    /** Blank pages whose widths are 200, 201, 202... so page order can be checked. */
    public static byte[] pdf(int pages) throws IOException {
        return pdf(pages, 200);
    }

    public static byte[] pdf(int pages, int baseWidth) throws IOException {
        try (PDDocument doc = new PDDocument()) {
            for (int i = 0; i < pages; i++) {
                doc.addPage(new PDPage(new PDRectangle(baseWidth + i, 300)));
            }
            return bytes(doc);
        }
    }

    /** Pages containing the text "Hello page N" (Helvetica), optionally with /Rotate set. */
    public static byte[] textPdf(int pages, int rotation) throws IOException {
        try (PDDocument doc = new PDDocument()) {
            var font = new org.apache.pdfbox.pdmodel.font.PDType1Font(
                    org.apache.pdfbox.pdmodel.font.Standard14Fonts.FontName.HELVETICA);
            for (int i = 1; i <= pages; i++) {
                PDPage page = new PDPage(PDRectangle.A4);
                page.setRotation(rotation);
                doc.addPage(page);
                try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                    cs.beginText();
                    cs.setFont(font, 14);
                    cs.newLineAtOffset(72, 700);
                    cs.showText("Hello page " + i);
                    cs.endText();
                }
            }
            return bytes(doc);
        }
    }

    /** Extracted text of each page. */
    public static List<String> pageTexts(byte[] pdf) throws IOException {
        try (PDDocument doc = load(pdf)) {
            List<String> list = new ArrayList<>();
            var stripper = new org.apache.pdfbox.text.PDFTextStripper();
            for (int p = 1; p <= doc.getNumberOfPages(); p++) {
                stripper.setStartPage(p);
                stripper.setEndPage(p);
                list.add(stripper.getText(doc));
            }
            return list;
        }
    }

    /** One page with a large, noisy, losslessly stored image: very compressible. */
    public static byte[] photoPdf() throws IOException {
        return photoPdf(false);
    }

    /** withAlpha: stored with an (all-opaque) soft mask, as browser/screenshot PNGs often are. */
    public static byte[] photoPdf(boolean withAlpha) throws IOException {
        BufferedImage img = new BufferedImage(2400, 1800, withAlpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        Random rnd = new Random(1);
        for (int y = 0; y < img.getHeight(); y++) {
            for (int x = 0; x < img.getWidth(); x++) {
                int r = (x * 255 / 2400 + rnd.nextInt(40)) % 256;
                img.setRGB(x, y, new Color(r, y * 255 / 1800, 128).getRGB());
            }
        }
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            PDImageXObject image = LosslessFactory.createFromImage(doc, img);
            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                cs.drawImage(image, 0, 0, 595, 446);
            }
            return bytes(doc);
        }
    }

    public static byte[] protectedPdf(String password) throws IOException {
        try (PDDocument doc = Loader.loadPDF(pdf(3))) {
            StandardProtectionPolicy policy = new StandardProtectionPolicy(password, password, new AccessPermission());
            policy.setEncryptionKeyLength(256);
            doc.protect(policy);
            return bytes(doc);
        }
    }

    public static byte[] image(int w, int h, String format) throws IOException {
        boolean alpha = format.equals("png");
        BufferedImage img = new BufferedImage(w, h, alpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        var g = img.createGraphics();
        g.setColor(new Color(200, 30, 30, alpha ? 128 : 255));
        g.fillRect(0, 0, w, h);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, format, out);
        return out.toByteArray();
    }

    public static PDDocument load(byte[] pdf) throws IOException {
        return Loader.loadPDF(pdf);
    }

    public static List<Integer> widths(byte[] pdf) throws IOException {
        try (PDDocument doc = load(pdf)) {
            List<Integer> list = new ArrayList<>();
            doc.getPages().forEach(p -> list.add(Math.round(p.getMediaBox().getWidth())));
            return list;
        }
    }

    public static List<Integer> rotations(byte[] pdf) throws IOException {
        try (PDDocument doc = load(pdf)) {
            List<Integer> list = new ArrayList<>();
            doc.getPages().forEach(p -> list.add(p.getRotation()));
            return list;
        }
    }

    public static BufferedImage readImage(byte[] data) throws IOException {
        return ImageIO.read(new ByteArrayInputStream(data));
    }

    private static byte[] bytes(PDDocument doc) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        doc.save(out);
        return out.toByteArray();
    }
}
