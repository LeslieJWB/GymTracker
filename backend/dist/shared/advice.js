export function buildFallbackAdvice(targetDate, rows) {
    if (rows.length === 0) {
        return `No previous records found before ${targetDate}. Start with a moderate full-body day and log each set for future personalized advice.`;
    }
    const recent = rows.slice(-8).join("; ");
    return `Based on your recent sessions (${recent}), target progressive overload with strict form, small load/rep increases, and controlled total volume.`;
}
