package com.pdfnew.tool.support;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.awt.image.WritableRaster;

/** Small image helpers shared by tools. */
public final class Images {

    private Images() {
    }

    /** True if the image has no alpha channel or every pixel is fully opaque. */
    public static boolean fullyOpaque(BufferedImage image) {
        WritableRaster alpha = image.getAlphaRaster();
        if (alpha == null) {
            return true;
        }
        int w = alpha.getWidth();
        int[] row = new int[w];
        for (int y = 0; y < alpha.getHeight(); y++) {
            alpha.getSamples(0, y, w, 1, 0, row);
            for (int a : row) {
                if (a != 255) {
                    return false;
                }
            }
        }
        return true;
    }

    /** Copies the image onto a white RGB canvas (drops an unused or unwanted alpha channel). */
    public static BufferedImage onWhite(BufferedImage image) {
        BufferedImage rgb = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = rgb.createGraphics();
        try {
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, rgb.getWidth(), rgb.getHeight());
            g.drawImage(image, 0, 0, null);
        } finally {
            g.dispose();
        }
        return rgb;
    }
}
