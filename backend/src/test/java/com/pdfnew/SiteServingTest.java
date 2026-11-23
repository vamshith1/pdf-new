package com.pdfnew;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/** The exported website is served with clean URLs and a real 404 page. */
@SpringBootTest
@AutoConfigureMockMvc
class SiteServingTest {

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) throws IOException {
        Path site = Files.createTempDirectory("site");
        Files.writeString(site.resolve("index.html"), "<h1>home</h1>");
        Files.writeString(site.resolve("merge-pdf.html"), "<h1>merge</h1>");
        Files.writeString(site.resolve("404.html"), "<h1>missing</h1>");
        Files.createDirectories(site.resolve("_next/static"));
        Files.writeString(site.resolve("_next/static/app.js"), "console.log(1)");
        registry.add("app.site-location", () -> site.toUri().toString());
        registry.add("app.storage.dir", () -> site.resolve("jobs").toString());
    }

    @Autowired
    MockMvc mvc;

    @Test
    void servesPagesByCleanUrl() throws Exception {
        // MockMvc records forwards instead of following them; the real server serves index.html
        mvc.perform(get("/")).andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl("/index.html"));
        mvc.perform(get("/index.html")).andExpect(content().string("<h1>home</h1>"));
        mvc.perform(get("/merge-pdf")).andExpect(status().isOk()).andExpect(content().string("<h1>merge</h1>"));
        mvc.perform(get("/merge-pdf/")).andExpect(status().isOk());
    }

    @Test
    void hashedAssetsAreCachedLong() throws Exception {
        mvc.perform(get("/_next/static/app.js")).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("immutable")));
    }

    @Test
    void unknownPagesGetTheSite404AndUnknownApiGetsJson() throws Exception {
        mvc.perform(get("/no-such-page")).andExpect(status().isNotFound())
                .andExpect(content().string("<h1>missing</h1>"));
        mvc.perform(get("/api/v1/nothing")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }
}
