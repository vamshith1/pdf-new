package com.pdfnew.tool.support;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;

import com.pdfnew.tool.ToolResult;

/** Writing results: JPEGs with a chosen quality, and ZIPs when a tool yields several files. */
public final class Outputs {

    private Outputs() {
    }

    public static void writeJpeg(BufferedImage image, float quality, Path target) throws IOException {
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        try (OutputStream out = Files.newOutputStream(target);
             ImageOutputStream ios = ImageIO.createImageOutputStream(out)) {
            writer.setOutput(ios);
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(quality);
            writer.write(null, new IIOImage(image, null, null), param);
        } finally {
            writer.dispose();
        }
    }

    /** One file is returned as-is; several are zipped into {@code zipName}. */
    public static ToolResult singleOrZip(List<Path> files, Path outputDir, String zipName) throws IOException {
        if (files.size() == 1) {
            Path only = files.getFirst();
            return ToolResult.of(only, only.getFileName().toString());
        }
        Path zip = outputDir.resolve(zipName);
        try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(zip))) {
            for (Path f : files) {
                zos.putNextEntry(new ZipEntry(f.getFileName().toString()));
                Files.copy(f, zos);
                zos.closeEntry();
            }
        }
        for (Path f : files) {
            Files.deleteIfExists(f);
        }
        return ToolResult.of(zip, zipName);
    }
}
