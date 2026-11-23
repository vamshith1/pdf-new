package com.pdfnew;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipInputStream;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;

import com.jayway.jsonpath.JsonPath;
import com.pdfnew.job.JobService;

/** End-to-end through HTTP: upload, poll, download, delete, and error handling. */
@SpringBootTest
@AutoConfigureMockMvc
class ApiIntegrationTest {

    static Path storage;

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) throws IOException {
        storage = Files.createTempDirectory("pdfnew-test");
        registry.add("app.storage.dir", storage::toString);
        registry.add("app.rate-limit.jobs-per-minute", () -> "1000");
        registry.add("app.office.binary", () -> "no-such-soffice-binary");
        registry.add("app.ocr.binary", () -> "no-such-tesseract-binary");
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    JobService jobService;

    // ---------------------------------------------------------------- helpers

    static MockMultipartFile pdf(String name, byte[] data) {
        return new MockMultipartFile("files", name, "application/pdf", data);
    }

    MockMultipartHttpServletRequestBuilder job(String tool, MockMultipartFile... files) {
        MockMultipartHttpServletRequestBuilder b = multipart("/api/v1/tools/" + tool + "/jobs");
        for (MockMultipartFile f : files) {
            b.file(f);
        }
        return b;
    }

    /** Starts a job, waits for it, and returns the final status JSON. */
    String run(MockMultipartHttpServletRequestBuilder request, Map<String, String> options) throws Exception {
        options.forEach(request::param);
        MvcResult started = mvc.perform(request).andExpect(status().isAccepted())
                .andExpect(header().exists("Location")).andReturn();
        String id = JsonPath.read(started.getResponse().getContentAsString(), "$.id");
        long deadline = System.nanoTime() + Duration.ofSeconds(30).toNanos();
        while (System.nanoTime() < deadline) {
            String body = mvc.perform(get("/api/v1/jobs/" + id)).andExpect(status().isOk())
                    .andReturn().getResponse().getContentAsString();
            String state = JsonPath.read(body, "$.status");
            if (state.equals("DONE") || state.equals("FAILED")) {
                return body;
            }
            Thread.sleep(20);
        }
        throw new AssertionError("job did not finish");
    }

    byte[] runAndDownload(MockMultipartHttpServletRequestBuilder request, Map<String, String> options) throws Exception {
        String body = run(request, options);
        assertThat((String) JsonPath.read(body, "$.status")).as(body).isEqualTo("DONE");
        String url = JsonPath.read(body, "$.result.downloadUrl");
        return mvc.perform(get(url)).andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("attachment")))
                .andReturn().getResponse().getContentAsByteArray();
    }

    static List<String> zipEntries(byte[] zip) throws IOException {
        List<String> names = new ArrayList<>();
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zip))) {
            for (var e = in.getNextEntry(); e != null; e = in.getNextEntry()) {
                names.add(e.getName());
            }
        }
        return names.stream().sorted().toList();
    }

    // ------------------------------------------------------------------ tools

    @Test
    void mergeKeepsUploadOrder() throws Exception {
        byte[] out = runAndDownload(job("merge", pdf("a.pdf", Fixtures.pdf(2, 100)), pdf("b.pdf", Fixtures.pdf(3, 500))), Map.of());
        assertThat(Fixtures.widths(out)).containsExactly(100, 101, 500, 501, 502);
    }

    @Test
    void splitByRangesReturnsZip() throws Exception {
        String body = run(job("split", pdf("report.pdf", Fixtures.pdf(6))), Map.of("mode", "ranges", "ranges", "1-2, 5-6"));
        assertThat((String) JsonPath.read(body, "$.result.filename")).isEqualTo("report_split.zip");
        byte[] zip = mvc.perform(get((String) JsonPath.read(body, "$.result.downloadUrl"))).andReturn().getResponse()
                .getContentAsByteArray();
        assertThat(zipEntries(zip)).containsExactly("report_pages_1-2.pdf", "report_pages_5-6.pdf");
    }

    @Test
    void splitSingleRangeReturnsPdf() throws Exception {
        byte[] out = runAndDownload(job("split", pdf("x.pdf", Fixtures.pdf(4))), Map.of("ranges", "3"));
        assertThat(Fixtures.widths(out)).containsExactly(202);
    }

    @Test
    void splitEveryNPages() throws Exception {
        byte[] zip = runAndDownload(job("split", pdf("x.pdf", Fixtures.pdf(5))), Map.of("mode", "every", "every", "2"));
        assertThat(zipEntries(zip)).hasSize(3);
    }

    @Test
    void rotateSelectedPages() throws Exception {
        byte[] out = runAndDownload(job("rotate", pdf("x.pdf", Fixtures.pdf(3))), Map.of("angle", "90", "pages", "2-3"));
        assertThat(Fixtures.rotations(out)).containsExactly(0, 90, 90);
    }

    @Test
    void rotateWithOneAnglePerPage() throws Exception {
        String body = run(job("rotate", pdf("scan.pdf", Fixtures.pdf(3))), Map.of("rotations", "90,0,-90"));
        assertThat((String) JsonPath.read(body, "$.result.filename")).isEqualTo("scan_rotated.pdf");
        byte[] out = mvc.perform(get((String) JsonPath.read(body, "$.result.downloadUrl"))).andReturn().getResponse()
                .getContentAsByteArray();
        assertThat(Fixtures.rotations(out)).containsExactly(90, 0, 270);

        String wrongCount = run(job("rotate", pdf("scan.pdf", Fixtures.pdf(3))), Map.of("rotations", "90,0"));
        assertThat((String) JsonPath.read(wrongCount, "$.error")).contains("one rotation per page");
    }

    @Test
    void organizeReordersRemovesAndRotates() throws Exception {
        byte[] out = runAndDownload(job("organize", pdf("x.pdf", Fixtures.pdf(4))),
                Map.of("order", "4,1,3", "rotations", "0,180,0"));
        assertThat(Fixtures.widths(out)).containsExactly(203, 200, 202);
        assertThat(Fixtures.rotations(out)).containsExactly(0, 180, 0);
    }

    @Test
    void compressShrinksImageHeavyPdf() throws Exception {
        byte[] original = Fixtures.photoPdf();
        String body = run(job("compress", pdf("scan.pdf", original)), Map.of("level", "medium"));
        assertThat((String) JsonPath.read(body, "$.status")).as(body).isEqualTo("DONE");
        double saved = ((Number) JsonPath.read(body, "$.result.stats.savedPercent")).doubleValue();
        int size = JsonPath.read(body, "$.result.size");
        assertThat(saved).isGreaterThan(50);
        assertThat(size).isLessThan(original.length / 2);
    }

    @Test
    void compressHandlesImagesWithSoftMasks() throws Exception {
        byte[] original = Fixtures.photoPdf(true);
        try (var doc = Fixtures.load(original)) {
            var images = doc.getPage(0).getResources().getXObjectNames();
            var image = (org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject)
                    doc.getPage(0).getResources().getXObject(images.iterator().next());
            assertThat(image.getCOSObject().getItem(org.apache.pdfbox.cos.COSName.SMASK)).as("fixture has a soft mask").isNotNull();
        }
        String body = run(job("compress", pdf("screens.pdf", original)), Map.of("level", "medium"));
        double saved = ((Number) JsonPath.read(body, "$.result.stats.savedPercent")).doubleValue();
        assertThat(saved).as(body).isGreaterThan(50);
    }

    @Test
    void compressNeverGrowsAFile() throws Exception {
        byte[] original = Fixtures.pdf(2);
        byte[] out = runAndDownload(job("compress", pdf("x.pdf", original)), Map.of("level", "high"));
        assertThat(out.length).isLessThanOrEqualTo(original.length);
    }

    @Test
    void imagesToPdfOnePagePerImageOnA4() throws Exception {
        byte[] out = runAndDownload(job("jpg-to-pdf",
                new MockMultipartFile("files", "a.jpg", "image/jpeg", Fixtures.image(400, 300, "jpg")),
                new MockMultipartFile("files", "b.png", "image/png", Fixtures.image(300, 400, "png"))),
                Map.of("pageSize", "a4", "orientation", "auto", "margin", "small"));
        try (var doc = Fixtures.load(out)) {
            assertThat(doc.getNumberOfPages()).isEqualTo(2);
            assertThat(Math.round(doc.getPage(0).getMediaBox().getWidth())).isEqualTo(842); // landscape image -> landscape page
            assertThat(Math.round(doc.getPage(1).getMediaBox().getWidth())).isEqualTo(595);
        }
    }

    @Test
    void pdfToJpgZipAndSinglePage() throws Exception {
        byte[] zip = runAndDownload(job("pdf-to-jpg", pdf("x.pdf", Fixtures.pdf(3))), Map.of("quality", "low"));
        assertThat(zipEntries(zip)).containsExactly("x_page_1.jpg", "x_page_2.jpg", "x_page_3.jpg");

        byte[] jpg = runAndDownload(job("pdf-to-jpg", pdf("x.pdf", Fixtures.pdf(3))), Map.of("quality", "normal", "pages", "2"));
        var img = Fixtures.readImage(jpg);
        assertThat(img.getWidth()).isCloseTo(Math.round(201 * 150 / 72f), org.assertj.core.data.Offset.offset(1)); // page 2 is 201pt wide
    }

    @Test
    void protectThenUnlock() throws Exception {
        byte[] locked = runAndDownload(job("protect", pdf("x.pdf", Fixtures.pdf(3))), Map.of("password", "s3cret!"));
        assertThat(Files.exists(storage)).isTrue();
        try {
            Fixtures.load(locked).close();
            throw new AssertionError("expected password prompt");
        } catch (org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException expected) {
            // good: needs a password to open
        }

        String rotate = run(job("rotate", pdf("x.pdf", locked)), Map.of());
        assertThat((String) JsonPath.read(rotate, "$.error")).contains("password-protected");

        String wrong = run(job("unlock", pdf("x.pdf", locked)), Map.of("password", "nope"));
        assertThat((String) JsonPath.read(wrong, "$.error")).isEqualTo("Wrong password.");

        byte[] unlocked = runAndDownload(job("unlock", pdf("x.pdf", locked)), Map.of("password", "s3cret!"));
        try (var doc = Fixtures.load(unlocked)) {
            assertThat(doc.isEncrypted()).isFalse();
            assertThat(doc.getNumberOfPages()).isEqualTo(3);
        }
    }

    // ------------------------------------------------------- phase 2 tools

    @Test
    void watermarkAddsTextToSelectedPages() throws Exception {
        String body = run(job("watermark", pdf("doc.pdf", Fixtures.textPdf(3, 0))),
                Map.of("text", "CONFIDENTIAL", "pages", "1-2", "layout", "diagonal"));
        assertThat((String) JsonPath.read(body, "$.result.filename")).isEqualTo("doc_watermarked.pdf");
        byte[] out = mvc.perform(get((String) JsonPath.read(body, "$.result.downloadUrl"))).andReturn().getResponse()
                .getContentAsByteArray();
        // Diagonal text is extracted in fragments, so compare without whitespace
        List<String> texts = Fixtures.pageTexts(out).stream().map(t -> t.replaceAll("\\s+", "")).toList();
        assertThat(texts.get(0)).contains("CONFIDENTIAL").contains("Hellopage1");
        assertThat(texts.get(1)).contains("CONFIDENTIAL");
        assertThat(texts.get(2)).doesNotContain("CONFIDENTIAL");
    }

    @Test
    void watermarkRequiresTextAndRejectsUnsupportedCharacters() throws Exception {
        String empty = run(job("watermark", pdf("doc.pdf", Fixtures.textPdf(1, 0))), Map.of());
        assertThat((String) JsonPath.read(empty, "$.error")).isEqualTo("Type the watermark text.");
        String hindi = run(job("watermark", pdf("doc.pdf", Fixtures.textPdf(1, 0))), Map.of("text", "गोपनीय"));
        assertThat((String) JsonPath.read(hindi, "$.error")).contains("aren't supported yet");
    }

    @Test
    void pageNumbersCountSelectedPagesAndHandleRotation() throws Exception {
        byte[] out = runAndDownload(job("page-numbers", pdf("doc.pdf", Fixtures.textPdf(3, 90))),
                Map.of("format", "of", "position", "bottom-right", "pages", "2-", "start", "1"));
        List<String> texts = Fixtures.pageTexts(out);
        assertThat(texts.get(0)).doesNotContain("Page");
        assertThat(texts.get(1)).contains("Page 1 of 2");
        assertThat(texts.get(2)).contains("Page 2 of 2");
    }

    @Test
    void pdfToTextReturnsTxtWithPageHeadings() throws Exception {
        String body = run(job("pdf-to-text", pdf("notes.pdf", Fixtures.textPdf(2, 0))), Map.of());
        assertThat((String) JsonPath.read(body, "$.result.filename")).isEqualTo("notes.txt");
        String text = mvc.perform(get((String) JsonPath.read(body, "$.result.downloadUrl"))).andReturn().getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        assertThat(text).contains("----- Page 1 -----").contains("Hello page 1").contains("Hello page 2");

        String scanned = run(job("pdf-to-text", pdf("scan.pdf", Fixtures.pdf(1))), Map.of());
        assertThat((String) JsonPath.read(scanned, "$.error")).contains("OCR PDF first");
    }

    @Test
    void extractImagesFindsEmbeddedImages() throws Exception {
        String body = run(job("extract-images", pdf("photos.pdf", Fixtures.photoPdf())), Map.of());
        assertThat((int) JsonPath.read(body, "$.result.stats.images")).isEqualTo(1);
        assertThat((String) JsonPath.read(body, "$.result.filename")).isEqualTo("photos_page1_1.png");

        String none = run(job("extract-images", pdf("blank.pdf", Fixtures.pdf(2))), Map.of());
        assertThat((String) JsonPath.read(none, "$.error")).isEqualTo("No images found in this PDF.");
    }

    @Test
    void officeAndOcrToolsExplainWhenTheEngineIsMissing() throws Exception {
        // The test profile points both engines at programs that don't exist
        String office = run(job("office-to-pdf",
                new MockMultipartFile("files", "report.docx", "application/octet-stream", new byte[]{1, 2, 3})), Map.of());
        assertThat((String) JsonPath.read(office, "$.error")).contains("isn't available on this server");

        String ocr = run(job("ocr", pdf("scan.pdf", Fixtures.pdf(1))), Map.of());
        assertThat((String) JsonPath.read(ocr, "$.error")).contains("isn't available on this server");

        mvc.perform(job("office-to-pdf", new MockMultipartFile("files", "virus.exe", "application/octet-stream", new byte[]{1})))
                .andExpect(status().isBadRequest());
    }

    // ------------------------------------------------------------- validation

    @Test
    void validationErrorsAreProblemJson() throws Exception {
        mvc.perform(job("merge", pdf("a.pdf", Fixtures.pdf(1))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Choose at least 2 files."));

        mvc.perform(job("compress", new MockMultipartFile("files", "x.docx", "application/msword", new byte[]{1, 2})))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("isn't a supported file type")));

        mvc.perform(job("compress", pdf("fake.pdf", "hello".getBytes())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("'fake.pdf' isn't a valid PDF."));

        mvc.perform(job("nope", pdf("a.pdf", Fixtures.pdf(1)))).andExpect(status().isNotFound());
    }

    @Test
    void badOptionsFailTheJobWithAClearMessage() throws Exception {
        String body = run(job("split", pdf("x.pdf", Fixtures.pdf(3))), Map.of("ranges", "2-9"));
        assertThat((String) JsonPath.read(body, "$.status")).isEqualTo("FAILED");
        assertThat((String) JsonPath.read(body, "$.error")).contains("this PDF has 3 pages");

        body = run(job("rotate", pdf("x.pdf", Fixtures.pdf(1))), Map.of("angle", "45"));
        assertThat((String) JsonPath.read(body, "$.error")).contains("Allowed");
    }

    @Test
    void corruptPdfFailsGracefully() throws Exception {
        byte[] broken = "%PDF-1.7\nthis is not really a pdf".getBytes();
        String body = run(job("rotate", pdf("broken.pdf", broken)), Map.of());
        assertThat((String) JsonPath.read(body, "$.error")).isEqualTo("'broken.pdf' isn't a valid PDF or is damaged.");
    }

    // ---------------------------------------------------------------- storage

    @Test
    void inputsAreRemovedAndDeleteWorks() throws Exception {
        String body = run(job("rotate", pdf("x.pdf", Fixtures.pdf(2))), Map.of());
        String id = JsonPath.read(body, "$.id");
        assertThat(storage.resolve(id).resolve("in")).doesNotExist();
        assertThat(storage.resolve(id).resolve("out")).isNotEmptyDirectory();

        mvc.perform(delete("/api/v1/jobs/" + id)).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/jobs/" + id)).andExpect(status().isNotFound());
        assertThat(storage.resolve(id)).doesNotExist();
    }

    @Test
    void unknownJobIs404AndMetaEndpointsWork() throws Exception {
        mvc.perform(get("/api/v1/jobs/does-not-exist")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("This file has expired or doesn't exist."));
        mvc.perform(get("/api/v1/tools")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(16));
        mvc.perform(get("/api/v1/limits")).andExpect(jsonPath("$.fileTtlMinutes").value(60));
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }

    @Test
    void securityHeadersArePresent() throws Exception {
        mvc.perform(get("/api/v1/tools"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Cache-Control", "no-store"));
    }
}
