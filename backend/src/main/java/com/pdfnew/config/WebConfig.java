package com.pdfnew.config;

import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.util.List;

import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.resource.PathResourceResolver;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final AppProperties props;

    public WebConfig(AppProperties props) {
        this.props = props;
    }

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        List<String> origins = props.corsOrigins().stream().filter(s -> !s.isBlank()).toList();
        if (!origins.isEmpty()) {
            registry.addMapping("/api/**")
                    .allowedOrigins(origins.toArray(String[]::new))
                    .allowedMethods("GET", "POST", "DELETE")
                    .exposedHeaders("Content-Disposition", "Retry-After");
        }
    }

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/").setViewName("forward:/index.html");
    }

    /**
     * Serves the exported Next.js site. Clean URLs map to their HTML file:
     * "/" -> index.html, "/merge-pdf" -> merge-pdf.html. Hashed assets under /_next are cached for a year.
     */
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String location = props.siteLocation().endsWith("/") ? props.siteLocation() : props.siteLocation() + "/";
        registry.addResourceHandler("/_next/**")
                .addResourceLocations(location + "_next/")
                .setCacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable());
        registry.addResourceHandler("/**")
                .addResourceLocations(location)
                .setCacheControl(CacheControl.noCache())
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String path, Resource base) throws IOException {
                        if (path.startsWith("api/")) {
                            return null;
                        }
                        String clean = path.endsWith("/") ? path.substring(0, path.length() - 1) : path;
                        if (clean.equals(".")) {
                            clean = ""; // the root URL arrives as "."
                        }
                        for (String candidate : clean.isEmpty()
                                ? List.of("index.html")
                                : List.of(clean, clean + ".html")) {
                            Resource r = super.getResource(candidate, base);
                            if (r != null && r.isReadable()) {
                                return r;
                            }
                        }
                        return null;
                    }
                });
    }

    @Bean
    FilterRegistrationBean<SecurityHeadersFilter> securityHeaders() {
        FilterRegistrationBean<SecurityHeadersFilter> bean = new FilterRegistrationBean<>(new SecurityHeadersFilter());
        bean.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return bean;
    }

    @Bean
    FilterRegistrationBean<RateLimitFilter> rateLimit(Clock clock) {
        FilterRegistrationBean<RateLimitFilter> bean = new FilterRegistrationBean<>(new RateLimitFilter(props, clock));
        bean.addUrlPatterns("/api/v1/tools/*");
        bean.setOrder(Ordered.HIGHEST_PRECEDENCE + 1);
        return bean;
    }
}
