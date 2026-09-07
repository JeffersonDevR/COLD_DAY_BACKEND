package com.sena.cold_day.core.shared.errors;

import java.util.List;

/**
 * Canonical error payload for module REST APIs.
 */
public record ApiError(int status, String message, List<String> fieldErrors) {
}
