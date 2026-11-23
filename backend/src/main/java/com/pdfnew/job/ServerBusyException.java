package com.pdfnew.job;

/** The work queue is full. Returned as HTTP 503 so the client can retry. */
public class ServerBusyException extends RuntimeException {

    public ServerBusyException() {
        super("The server is busy right now. Please try again in a moment.");
    }
}
