package com.sena.cold_day.shared;

import java.util.List;

/**
 * Canonical error payload for module REST APIs.
 */
public record ApiError(int status, String message, List<String> fieldErrors) {
}
