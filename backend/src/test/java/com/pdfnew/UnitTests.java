package com.pdfnew;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.util.unit.DataSize;

import com.pdfnew.config.AppProperties;
import com.pdfnew.config.RateLimitFilter;
import com.pdfnew.job.JobService;
import com.pdfnew.tool.ToolException;
import com.pdfnew.tool.impl.RotateTool;
import com.pdfnew.tool.support.PageRanges;

class UnitTests {

    @TempDir
    Path tmp;

    static AppProperties props(Path dir, int perMinute) {
        return new AppProperties(
                new AppProperties.Storage(dir, Duration.ofMinutes(60)),
                new AppProperties.Jobs(1, 5),
                new AppProperties.Limits(DataSize.ofMegabytes(1), DataSize.ofMegabytes(2), 20, 100),
                new AppProperties.RateLimit(true, perMinute),
                List.of(), false, "classpath:/static/");
    }

    /** A clock the test can move forward. */
    static final class MovableClock extends Clock {
        Instant now = Instant.parse("2026-01-01T00:00:10Z");

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    // ------------------------------------------------------------ page ranges

    @Test
    void parsesRangesListsAndOpenEnds() {
        assertThat(PageRanges.indices("1-3, 5, 8-", 9)).containsExactly(0, 1, 2, 4, 7, 8);
        assertThat(PageRanges.indices("", 3)).containsExactly(0, 1, 2);
        assertThat(PageRanges.indices("all", 2)).containsExactly(0, 1);
        assertThat(PageRanges.parse("-2,4", 5)).extracting(PageRanges.Range::label).containsExactly("1-2", "4");
    }

    @Test
    void rejectsBadRanges() {
        assertThatThrownBy(() -> PageRanges.parse("0", 3)).isInstanceOf(ToolException.class);
        assertThatThrownBy(() -> PageRanges.parse("3-1", 3)).isInstanceOf(ToolException.class);
        assertThatThrownBy(() -> PageRanges.parse("a-b", 3)).hasMessageContaining("isn't a valid page");
        assertThatThrownBy(() -> PageRanges.parse("1-4", 3)).hasMessageContaining("this PDF has 3 pages");
    }

    // ------------------------------------------------------------ job service

    @Test
    void expiredJobsAreDeleted() throws Exception {
        MovableClock clock = new MovableClock();
        JobService service = new JobService(props(tmp, 10), clock);
        var job = service.submit(new RotateTool(),
                List.of(new MockMultipartFile("files", "a.pdf", "application/pdf", Fixtures.pdf(1))), Map.of());
        waitUntilFinished(service, job.id());
        assertThat(service.find(job.id())).isPresent();

        clock.now = clock.now.plus(Duration.ofMinutes(61));
        assertThat(service.cleanup()).isEqualTo(1);
        assertThat(service.find(job.id())).isEmpty();
        assertThat(tmp.resolve(job.id())).doesNotExist();
    }

    @Test
    void enforcesSizeLimitsAndSanitisesNames() throws Exception {
        JobService service = new JobService(props(tmp, 10), new MovableClock());
        byte[] big = new byte[(int) DataSize.ofMegabytes(1).toBytes() + 1];
        assertThatThrownBy(() -> service.submit(new RotateTool(),
                List.of(new MockMultipartFile("files", "big.pdf", "application/pdf", big)), Map.of()))
                .hasMessageContaining("larger than 1 MB");

        var job = service.submit(new RotateTool(),
                List.of(new MockMultipartFile("files", "..\\..\\evil<name>.pdf", "application/pdf", Fixtures.pdf(1))), Map.of());
        waitUntilFinished(service, job.id());
        assertThat(job.resultName()).isEqualTo("evil_name__rotated.pdf");
        try (var files = Files.walk(tmp)) {
            assertThat(files.allMatch(p -> p.startsWith(tmp))).isTrue();
        }
    }

    @Test
    void startupOnlyPurgesJobFolders() throws Exception {
        Path keep = Files.createDirectory(tmp.resolve("important-folder"));
        Path orphan = Files.createDirectory(tmp.resolve("abcdefghijklmnopqrstuvwx"));
        new JobService(props(tmp, 10), new MovableClock());
        assertThat(keep).exists();
        assertThat(orphan).doesNotExist();
    }

    private static void waitUntilFinished(JobService service, String id) throws InterruptedException {
        for (int i = 0; i < 500; i++) {
            var status = service.find(id).orElseThrow().status();
            if (status.name().equals("DONE") || status.name().equals("FAILED")) {
                return;
            }
            Thread.sleep(10);
        }
        throw new AssertionError("job did not finish");
    }

    // ------------------------------------------------------------ rate limit

    @Test
    void rateLimitBlocksAfterQuotaAndResetsNextMinute() throws Exception {
        MovableClock clock = new MovableClock();
        RateLimitFilter filter = new RateLimitFilter(props(tmp, 2), clock);
        assertThat(post(filter)).isEqualTo(200);
        assertThat(post(filter)).isEqualTo(200);
        assertThat(post(filter)).isEqualTo(429);
        clock.now = clock.now.plusSeconds(60);
        assertThat(post(filter)).isEqualTo(200);
    }

    private static int post(RateLimitFilter filter) throws IOException, jakarta.servlet.ServletException {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/v1/tools/merge/jobs");
        req.setRemoteAddr("10.0.0.1");
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(req, res, (rq, rs) -> { });
        return res.getStatus();
    }
}
