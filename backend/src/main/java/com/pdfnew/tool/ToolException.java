package com.pdfnew.tool;

/**
 * A problem with the user's input (bad file, bad option, wrong password).
 * The message is safe to show to the user and is returned as HTTP 400 / a failed job.
 */
public class ToolException extends RuntimeException {

    public ToolException(String message) {
        super(message);
    }

    public ToolException(String message, Throwable cause) {
        super(message, cause);
    }
}
