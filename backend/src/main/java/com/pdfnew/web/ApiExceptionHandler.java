package com.pdfnew.web;

import java.io.IOException;

import org.slf4j.Logger;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.pdfnew.config.AppProperties;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;

import com.pdfnew.job.ServerBusyException;
import com.pdfnew.tool.ToolException;

/** Every error is an RFC 9457 problem+json body whose {@code detail} can be shown to the user. */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    private final AppProperties props;
    private final ResourceLoader resources;

    public ApiExceptionHandler(AppProperties props, ResourceLoader resources) {
        this.props = props;
        this.resources = resources;
    }

    @ExceptionHandler(ToolException.class)
    ProblemDetail badInput(ToolException e) {
        return problem(HttpStatus.BAD_REQUEST, "Invalid request", e.getMessage());
    }

    @ExceptionHandler(NotFoundException.class)
    ProblemDetail notFound(NotFoundException e) {
        return problem(HttpStatus.NOT_FOUND, "Not found", e.getMessage());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ProblemDetail tooLarge(MaxUploadSizeExceededException e) {
        return problem(HttpStatus.CONTENT_TOO_LARGE, "Upload too large", "Your files are larger than the upload limit.");
    }

    @ExceptionHandler(MultipartException.class)
    ProblemDetail badUpload(MultipartException e) {
        return problem(HttpStatus.BAD_REQUEST, "Invalid upload", "Upload files as multipart/form-data in 'files' fields.");
    }

    @ExceptionHandler(ServerBusyException.class)
    ResponseEntity<ProblemDetail> busy(ServerBusyException e) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).header("Retry-After", "10")
                .body(problem(HttpStatus.SERVICE_UNAVAILABLE, "Server busy", e.getMessage()));
    }

    /** Unknown website paths get the site's styled 404 page; unknown API paths get JSON. */
    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<?> noResource(NoResourceFoundException e, HttpServletRequest request) throws IOException {
        if (!request.getRequestURI().startsWith("/api/")) {
            String location = props.siteLocation().endsWith("/") ? props.siteLocation() : props.siteLocation() + "/";
            Resource page = resources.getResource(location + "404.html");
            if (page.isReadable()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).contentType(MediaType.TEXT_HTML)
                        .body(page.getContentAsByteArray());
            }
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(problem(HttpStatus.NOT_FOUND, "Not found", "There's nothing at this address."));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ProblemDetail> unexpected(Exception e) {
        if (e instanceof ErrorResponse standard) {
            // Spring's own errors (404 for unknown paths, 405, bad params...) keep their status
            return ResponseEntity.status(standard.getStatusCode()).body(standard.getBody());
        }
        log.error("Unhandled error", e);
        return ResponseEntity.internalServerError()
                .body(problem(HttpStatus.INTERNAL_SERVER_ERROR, "Server error", "Something went wrong. Please try again."));
    }

    private static ProblemDetail problem(HttpStatus status, String title, String detail) {
        ProblemDetail p = ProblemDetail.forStatusAndDetail(status, detail);
        p.setTitle(title);
        return p;
    }
}
